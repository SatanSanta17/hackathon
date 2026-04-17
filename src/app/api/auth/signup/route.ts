import { NextResponse } from 'next/server';

import { ERR } from '@/lib/constants/error-codes';
import { signUpSchema } from '@/lib/validations/auth';
import { signUp } from '@/lib/services/auth-service';

export async function POST(request: Request) {
  console.log('[api/auth/signup] POST');

  try {
    const body = await request.json();

    // Validate input
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/signup] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Call service
    const result = await signUp(parsed.data);

    if (!result.success) {
      if (result.error === ERR.EMAIL_EXISTS) {
        return NextResponse.json(
          { message: 'An account with this email already exists.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/signup] Success');
    return NextResponse.json(
      { message: 'Account created. Check your email to verify.' },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/auth/signup] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
