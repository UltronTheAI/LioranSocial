import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/constants';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify'];
const PUBLIC_PREFIXES = ['/api', '/_next', '/favicon.ico', '/public'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore all API endpoints, Next.js internals, and static assets
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

  // If user is not authenticated and visits a protected page route, redirect to login
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
     * Match all request paths except for:
     * - api (handled in route handlers with JSON)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
