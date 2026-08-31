import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  REFRESH_TOKEN_COOKIE,
  rotateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
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

