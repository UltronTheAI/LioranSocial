import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  REFRESH_TOKEN_COOKIE,
  revokeSessionByRefreshToken,
  clearAuthCookies,
} from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (rawRefreshToken) {
      await revokeSessionByRefreshToken(rawRefreshToken);
    }

    await clearAuthCookies();

    return NextResponse.json({
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    await clearAuthCookies();
    return NextResponse.json(
      { error: 'An unexpected error occurred during logout.' },
      { status: 500 }
    );
  }
}

