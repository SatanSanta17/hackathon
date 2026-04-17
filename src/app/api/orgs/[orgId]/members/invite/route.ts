import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { ERR } from '@/lib/constants/error-codes';
import { inviteMemberSchema } from '@/lib/validations/org';
import { inviteMember } from '@/lib/services/org-service';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/orgs/[orgId]/members/invite — Invite a member to the organization
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  console.log('[api/orgs/members/invite] POST:', { orgId });

  try {
    const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in result) return result.error;
    const { user } = result;

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Get org name for the email template
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return NextResponse.json(
        { message: 'Organization not found.' },
        { status: 404 },
      );
    }

    const inviteResult = await inviteMember({
      orgId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedByUserId: user.id,
      inviterName: user.name,
      orgName: org.name,
    });

    if (!inviteResult.success) {
      if (inviteResult.error === ERR.ALREADY_MEMBER) {
        return NextResponse.json(
          { message: 'This user is already a member of the organization.' },
          { status: 400 },
        );
      }
      if (inviteResult.error === ERR.INVITE_PENDING) {
        return NextResponse.json(
          { message: 'A pending invitation already exists for this email.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: inviteResult.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/orgs/members/invite] POST: invitation sent');
    return NextResponse.json(
      { message: 'Invitation sent.' },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/orgs/members/invite] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
