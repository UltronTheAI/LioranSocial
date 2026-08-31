import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import VerificationToken from '@/models/VerificationToken';
import { resendOtpSchema } from '@/validators/auth.schema';
import { generateOtp, hashToken } from '@/lib/security';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/services/email.service';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = resendOtpSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, type } = parseResult.data;

    // Rate-limit resend: max 3 per 5 minutes per email
    const rateLimit = checkRateLimit(`resend:${email}:${type}`, 3, 300);
    if (!rateLimit.success) {
      const waitSeconds = Math.ceil(rateLimit.reset / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before requesting another code.` },
        { status: 429 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email });
    if (!user) {
      // Don't leak user existence for password reset, but for email verification give clear message
      if (type === 'EMAIL_VERIFICATION') {
        return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
      }
      return NextResponse.json({
        message: 'If an account exists with this email, a verification code has been sent.',
      });
    }

    if (type === 'EMAIL_VERIFICATION' && user.emailVerified) {
      return NextResponse.json(
        { error: 'This email is already verified. Please log in.' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete existing token records of this type for the identifier
    await VerificationToken.deleteMany({ identifier: email, type });

    // Store new token
    await VerificationToken.create({
      identifier: email,
      type,
      tokenHash,
      attempts: 0,
      expiresAt,
    });

    if (type === 'EMAIL_VERIFICATION') {
      await sendVerificationEmail(email, otp);
    } else {
      await sendPasswordResetEmail(email, otp);
    }

    return NextResponse.json({
      message: 'A new verification code has been sent to your email.',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification code. Please try again.' },
      { status: 500 }
    );
  }
}

