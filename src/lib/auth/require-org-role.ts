import { NextResponse } from 'next/server';

import { auth } from './auth';
import { checkUserOrgRole } from '@/lib/services/org-service';
import './types';

interface VerifiedUser {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  isEmailVerified: boolean;
}

type RequireOrgRoleResult =
  | { user: VerifiedUser; role: string }
  | { error: NextResponse };

/**
 * Org-level permission guard for API routes.
 *
 * Combines authentication + email verification + org role check in one call.
 * Returns 401 (unauthenticated), 403 (unverified or insufficient role), or user + role.
 *
 * Usage:
 * ```ts
 * const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
 * if ('error' in result) return result.error;
 * const { user, role } = result;
 * ```
 */
export async function requireOrgRole(params: {
  orgId: string;
  allowedRoles: Array<'org_admin' | 'member'>;
}): Promise<RequireOrgRoleResult> {
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

  const orgRole = await checkUserOrgRole({
    userId: session.user.id,
    orgId: params.orgId,
  });

  if (!orgRole) {
    return {
      error: NextResponse.json(
        { message: 'You are not a member of this organization.' },
        { status: 403 },
      ),
    };
  }

  if (!params.allowedRoles.includes(orgRole.role as 'org_admin' | 'member')) {
    return {
      error: NextResponse.json(
        { message: 'You do not have permission to perform this action.' },
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
    role: orgRole.role,
  };
}
