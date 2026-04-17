import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ERR } from '@/lib/constants/error-codes';
import { verifyEmail } from '@/lib/services/auth-service';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function POST(request: Request) {
  console.log('[api/auth/verify-email] POST');

  try {
    const body = await request.json();

    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/verify-email] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Token is required.' },
        { status: 400 },
      );
    }

    const result = await verifyEmail({ token: parsed.data.token });

    if (!result.success) {
      if (result.error === ERR.INVALID_TOKEN) {
        return NextResponse.json(
          { message: 'Invalid or expired verification link.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/verify-email] Success');
    return NextResponse.json(
      { message: 'Email verified successfully.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/verify-email] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
