import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import VerificationToken from '@/models/VerificationToken';
import { verifyOtpSchema } from '@/validators/auth.schema';
import { hashToken } from '@/lib/security';
import { createAuthSession, setAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = verifyOtpSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, otp, type } = parseResult.data;

    await connectToDatabase();

    // Look for active verification token
    const tokenRecord = await VerificationToken.findOne({
      identifier: email,
      type,
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Verification code not found or expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      await VerificationToken.deleteOne({ _id: tokenRecord._id });
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check attempts limit (max 5)
    if (tokenRecord.attempts >= 5) {
      await VerificationToken.deleteOne({ _id: tokenRecord._id });
      return NextResponse.json(
        { error: 'Too many failed attempts. This verification code has been invalidated. Please request a new one.' },
        { status: 429 }
      );
    }

    // Hash provided OTP and verify
    const providedOtpHash = hashToken(otp);
    if (tokenRecord.tokenHash !== providedOtpHash) {
      tokenRecord.attempts += 1;
      await tokenRecord.save();

      const remainingAttempts = 5 - tokenRecord.attempts;
      return NextResponse.json(
        {
          error: `Invalid verification code. ${remainingAttempts} ${
            remainingAttempts === 1 ? 'attempt' : 'attempts'
          } remaining.`,
        },
        { status: 400 }
      );
    }

    // Valid OTP - clean up token record
    await VerificationToken.deleteOne({ _id: tokenRecord._id });

    if (type === 'EMAIL_VERIFICATION') {
      // Mark user as verified
      const user = await User.findOneAndUpdate(
        { email },
        { emailVerified: true },
        { new: true }
      ).select('-passwordHash');

      if (!user) {
        return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
      }

      // Establish authenticated session
      const userAgent = req.headers.get('user-agent') || '';
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

      const { accessToken, refreshToken } = await createAuthSession(
        {
          _id: user._id.toString(),
          email: user.email,
          username: user.username,
        },
        userAgent,
        ipAddress
      );

      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.json({
        message: 'Account successfully verified!',
        user: {
          _id: user._id.toString(),
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          emailVerified: user.emailVerified,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
        },
      });
    }

    // For password reset, return verified state
    return NextResponse.json({
      message: 'Verification code confirmed. You may now reset your password.',
      verified: true,
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during verification. Please try again.' },
      { status: 500 }
    );
  }
}

