import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';
import { ERR } from '@/lib/constants/error-codes';
import { resendVerificationEmail } from '@/lib/services/auth-service';
import { rateLimit, getClientIp, resendVerificationLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/resend-verification] POST');

  const ip = getClientIp(request);
  const limit = await rateLimit(ip, resendVerificationLimiter);
  if (!limit.success) {
    console.log('[api/auth/resend-verification] Rate limited:', ip);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } },
    );
  }

  try {
    // Requires authenticated session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Authentication required.' },
        { status: 401 },
      );
    }

    const result = await resendVerificationEmail({ userId: session.user.id });

    if (!result.success) {
      if (result.error === ERR.ALREADY_VERIFIED) {
        return NextResponse.json(
          { message: 'Email is already verified.' },
          { status: 400 },
        );
      }
      if (result.error === ERR.EMAIL_FAILED) {
        return NextResponse.json(
          { message: 'Failed to send verification email. Please try again.' },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/resend-verification] Success');
    return NextResponse.json(
      { message: 'Verification email sent.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/resend-verification] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
