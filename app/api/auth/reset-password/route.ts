import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Session from '@/models/Session';
import VerificationToken from '@/models/VerificationToken';
import { resetPasswordSchema } from '@/validators/auth.schema';
import { hashPassword, hashToken } from '@/lib/security';
import { clearAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = resetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, otp, newPassword } = parseResult.data;

    await connectToDatabase();

    const tokenRecord = await VerificationToken.findOne({
      identifier: email,
      type: 'PASSWORD_RESET',
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Password reset code not found or expired. Please request a new code.' },
        { status: 400 }
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      await VerificationToken.deleteOne({ _id: tokenRecord._id });
      return NextResponse.json(
        { error: 'Password reset code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    if (tokenRecord.attempts >= 5) {
      await VerificationToken.deleteOne({ _id: tokenRecord._id });
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new reset code.' },
        { status: 429 }
      );
    }

    // Verify OTP hash
    const providedOtpHash = hashToken(otp);
    if (tokenRecord.tokenHash !== providedOtpHash) {
      tokenRecord.attempts += 1;
      await tokenRecord.save();

      const remaining = 5 - tokenRecord.attempts;
      return NextResponse.json(
        { error: `Invalid reset code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.` },
        { status: 400 }
      );
    }

    // OTP is valid
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    // Hash new password using Argon2id
    const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    user.emailVerified = true; // password reset confirms email ownership
    await user.save();

    // Security: Revoke all existing sessions for this user
    await Session.updateMany({ userId: user._id }, { revokedAt: new Date() });

    // Clean up reset token
    await VerificationToken.deleteOne({ _id: tokenRecord._id });

    // Clear any existing auth cookies
    await clearAuthCookies();

    return NextResponse.json({
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while resetting your password.' },
      { status: 500 }
    );
  }
}

