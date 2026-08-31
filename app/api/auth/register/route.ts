import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import VerificationToken from '@/models/VerificationToken';
import { registerSchema } from '@/validators/auth.schema';
import { hashPassword, generateOtp, hashToken } from '@/lib/security';
import { sendVerificationEmail } from '@/services/email.service';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`register:${ip}`, 10, 3600); // 10 registrations per hour per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { username, displayName, email, password } = parseResult.data;

    await connectToDatabase();

    // Check if email or username is already taken
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: 'An account with this email address already exists.' },
          { status: 409 }
        );
      }
      if (existingUser.username === username) {
        return NextResponse.json(
          { error: 'This username is already taken. Please choose another.' },
          { status: 409 }
        );
      }
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user with unverified email
    const newUser = await User.create({
      username,
      displayName,
      email,
      passwordHash,
      emailVerified: false,
    });

    // Generate 6-digit OTP
    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database (clean up any previous unverified tokens for this email)
    await VerificationToken.deleteMany({
      identifier: email,
      type: 'EMAIL_VERIFICATION',
    });

    await VerificationToken.create({
      identifier: email,
      type: 'EMAIL_VERIFICATION',
      tokenHash,
      attempts: 0,
      expiresAt,
    });

    // Send verification email
    await sendVerificationEmail(email, otp);

    return NextResponse.json(
      {
        message: 'Account registered successfully. Please check your email for the verification code.',
        email: newUser.email,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration. Please try again.' },
      { status: 500 }
    );
  }
}

