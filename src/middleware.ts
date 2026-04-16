import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  const isAuthPage =
    nextUrl.pathname.startsWith('/login') ||
    nextUrl.pathname.startsWith('/signup') ||
    nextUrl.pathname.startsWith('/forgot-password') ||
    nextUrl.pathname.startsWith('/reset-password');
  const isDashboardPage = nextUrl.pathname.startsWith('/dashboard');
  const isAdminPage = nextUrl.pathname.startsWith('/admin');

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Protect dashboard and admin routes — redirect unauthenticated to login
  if (!isLoggedIn && (isDashboardPage || isAdminPage)) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl),
    );
  }

  // Unverified users ARE allowed into /dashboard (Option B).
  // Action restrictions are enforced at the API route level, not middleware.

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
};
