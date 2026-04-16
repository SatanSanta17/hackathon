import { NextResponse } from 'next/server';

import { auth } from './auth';

interface VerifiedUser {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  isEmailVerified: boolean;
}

type RequireVerifiedResult =
  | { user: VerifiedUser }
  | { error: NextResponse };

/**
 * Server-side guard for API routes that require an authenticated AND verified user.
 *
 * Returns 401 if unauthenticated, 403 if unverified, or the user object if both pass.
 *
 * Usage:
 * ```ts
 * const result = await requireVerifiedUser();
 * if ('error' in result) return result.error;
 * const { user } = result;
 * ```
 */
export async function requireVerifiedUser(): Promise<RequireVerifiedResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { message: 'Authentication required.' },
        { status: 401 },
      ),
    };
  }

  if (!session.user.isEmailVerified) {
    return {
      error: NextResponse.json(
        { message: 'Please verify your email to perform this action.' },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      platformRole: session.user.platformRole,
      isEmailVerified: session.user.isEmailVerified,
    },
  };
}
