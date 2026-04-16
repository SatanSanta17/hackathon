import { NextResponse } from 'next/server';

import { auth } from './auth';
import './types';

interface VerifiedUser {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  isEmailVerified: boolean;
}

type RequireSuperAdminResult =
  | { user: VerifiedUser }
  | { error: NextResponse };

/**
 * Platform-level guard for super admin API routes.
 *
 * Returns 401 (unauthenticated), 403 (unverified or not super_admin), or the user.
 *
 * Usage:
 * ```ts
 * const result = await requireSuperAdmin();
 * if ('error' in result) return result.error;
 * const { user } = result;
 * ```
 */
export async function requireSuperAdmin(): Promise<RequireSuperAdminResult> {
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

  if (session.user.platformRole !== 'super_admin') {
    return {
      error: NextResponse.json(
        { message: 'Super admin access required.' },
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
