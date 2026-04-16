import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';
import { resendVerificationEmail } from '@/lib/services/auth-service';

export async function POST() {
  console.log('[api/auth/resend-verification] POST');

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
      if (result.error === 'ALREADY_VERIFIED') {
        return NextResponse.json(
          { message: 'Email is already verified.' },
          { status: 400 },
        );
      }
      if (result.error === 'EMAIL_FAILED') {
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
