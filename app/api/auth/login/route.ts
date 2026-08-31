import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { loginSchema } from '@/validators/auth.schema';
import { verifyPassword } from '@/lib/security';
import { createAuthSession, setAuthCookies } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`login:${ip}`, 10, 300); // 10 attempts per 5 minutes per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid login details';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { identifier, password } = parseResult.data;
    const normalizedIdentifier = identifier.toLowerCase().trim();

    await connectToDatabase();

    // Query user by username or email
    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        { username: normalizedIdentifier },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    // Verify Argon2id password hash
    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    // Check if email has been verified
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: 'Your email address is not verified yet. Please enter the verification code.',
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Create session & issue auth tokens
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
      message: 'Logged in successfully.',
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
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}

