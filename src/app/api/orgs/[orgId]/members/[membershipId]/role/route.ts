import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { ERR } from '@/lib/constants/error-codes';
import { changeMemberRole } from '@/lib/services/org-service';

const patchSchema = z.object({
  role: z.enum(['org_admin', 'member']),
});

/**
 * PATCH /api/orgs/[orgId]/members/[membershipId]/role — Change a member's role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> },
) {
  const { orgId, membershipId } = await params;
  console.log('[api/orgs/members/role] PATCH:', { orgId, membershipId });

  try {
    const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in result) return result.error;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const changeResult = await changeMemberRole({
      membershipId,
      orgId,
      newRole: parsed.data.role,
    });

    if (!changeResult.success) {
      if (changeResult.error === ERR.MEMBERSHIP_NOT_FOUND) {
        return NextResponse.json(
          { message: 'Membership not found.' },
          { status: 404 },
        );
      }
      if (changeResult.error === ERR.LAST_ADMIN) {
        return NextResponse.json(
          { message: 'Cannot demote the last admin. Promote another member first.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: changeResult.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/orgs/members/role] PATCH: role updated');
    return NextResponse.json({ message: 'Role updated.' });
  } catch (err) {
    console.error('[api/orgs/members/role] PATCH error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
