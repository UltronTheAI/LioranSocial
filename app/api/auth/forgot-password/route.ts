import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import VerificationToken from '@/models/VerificationToken';
import { forgotPasswordSchema } from '@/validators/auth.schema';
import { generateOtp, hashToken } from '@/lib/security';
import { sendPasswordResetEmail } from '@/services/email.service';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`forgot-password:${ip}`, 5, 900); // 5 requests per 15 min
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parseResult = forgotPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid email address';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email } = parseResult.data;

    await connectToDatabase();

    const user = await User.findOne({ email });

    if (user) {
      // Generate OTP and token
      const otp = generateOtp();
      const tokenHash = hashToken(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Clean up previous password reset tokens for this email
      await VerificationToken.deleteMany({
        identifier: email,
        type: 'PASSWORD_RESET',
      });

      await VerificationToken.create({
        identifier: email,
        type: 'PASSWORD_RESET',
        tokenHash,
        attempts: 0,
        expiresAt,
      });

      await sendPasswordResetEmail(email, otp);
    }

    // Always respond with success to prevent user enumeration
    return NextResponse.json({
      message: 'If an account exists with this email address, a password reset code has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request. Please try again.' },
      { status: 500 }
    );
  }
}

