import { NextResponse } from 'next/server';

import { resetPasswordSchema } from '@/lib/validations/auth';
import { resetPassword } from '@/lib/services/auth-service';

export async function POST(request: Request) {
  console.log('[api/auth/reset-password] POST');

  try {
    const body = await request.json();

    // Validate input
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/reset-password] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    if (!result.success) {
      if (result.error === 'INVALID_TOKEN') {
        return NextResponse.json(
          { message: 'Invalid or expired reset link.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/reset-password] Success');
    return NextResponse.json(
      { message: 'Password reset successfully.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/reset-password] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
