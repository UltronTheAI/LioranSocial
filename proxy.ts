import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/constants';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify'];
const PUBLIC_PREFIXES = ['/api/auth', '/_next', '/favicon.ico', '/public'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore API, Next.js internal and static routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const hasRefreshToken = request.cookies.has(REFRESH_TOKEN_COOKIE);
  const isAuthenticated = hasAccessToken || hasRefreshToken;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // If user is already authenticated and visits login/register/etc., redirect to home
  if (isAuthenticated && isAuthRoute && pathname !== '/verify') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is not authenticated and visits a protected route, redirect to login
  if (!isAuthenticated && !isAuthRoute) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled inside route handlers)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

