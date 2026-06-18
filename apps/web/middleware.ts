import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './src/auth.config';

/**
 * Route protection. Unauthenticated users are redirected to `/login`, except on
 * the public auth pages. The auth, JWKS, and proxy API routes handle their own
 * authorization, so they are excluded via the matcher below.
 *
 * Imports authConfig (edge-safe — no db/bcrypt) instead of the full auth.ts
 * instance to keep Drizzle/postgres/bcrypt out of the Edge bundle.
 */

const PUBLIC_PATHS = ['/login', '/signup', '/forgot', '/reset'];

export default NextAuth(authConfig).auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Already authenticated users shouldn't sit on the auth pages.
  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, the API routes (auth/jwks/proxy
  // manage their own access), and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|icon.png|offline.html|.*\\.(?:png|svg|ico|webmanifest)$).*)',
  ],
};
