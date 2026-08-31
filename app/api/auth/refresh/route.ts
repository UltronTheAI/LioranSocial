import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  REFRESH_TOKEN_COOKIE,
  rotateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`refresh:${ip}`, 30, 60); // 30 requests per minute per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many refresh attempts. Please slow down.' },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    const rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!rawRefreshToken) {
      await clearAuthCookies();
      return NextResponse.json(
        { error: 'No refresh token provided. Please log in.' },
        { status: 401 }
      );
    }

    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    const rotationResult = await rotateRefreshToken(rawRefreshToken, userAgent, ipAddress);

    if (!rotationResult) {
      await clearAuthCookies();
      return NextResponse.json(
        { error: 'Session expired or invalidated. Please log in again.' },
        { status: 401 }
      );
    }

    await setAuthCookies(rotationResult.accessToken, rotationResult.refreshToken);

    return NextResponse.json({
      message: 'Token refreshed successfully.',
      user: rotationResult.user,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    await clearAuthCookies();
    return NextResponse.json(
      { error: 'Failed to refresh token.' },
      { status: 500 }
    );
  }
}

