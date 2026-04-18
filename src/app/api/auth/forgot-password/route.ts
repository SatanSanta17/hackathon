import { NextResponse } from 'next/server';

import { forgotPasswordSchema } from '@/lib/validations/auth';
import { requestPasswordReset } from '@/lib/services/auth-service';
import { rateLimit, getClientIp, forgotPasswordLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/forgot-password] POST');

  const ip = getClientIp(request);
  const limit = await rateLimit(ip, forgotPasswordLimiter);
  if (!limit.success) {
    console.log('[api/auth/forgot-password] Rate limited:', ip);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } },
    );
  }

  try {
    const body = await request.json();

    // Validate input
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/forgot-password] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Always returns success to prevent email enumeration
    await requestPasswordReset({ email: parsed.data.email });

    console.log('[api/auth/forgot-password] Success');
    return NextResponse.json(
      { message: 'If an account exists, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/forgot-password] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
