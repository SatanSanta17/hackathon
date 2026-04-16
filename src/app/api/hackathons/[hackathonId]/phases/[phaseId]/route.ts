import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { updatePhaseSchema } from '@/lib/validations/hackathon';
import { db } from '@/db';
import { hackathons, phases } from '@/db/schema';

/**
 * PATCH /api/hackathons/[hackathonId]/phases/[phaseId] — Update phase dates/name
 *
 * Restriction: Only `name`, `startDate`, and `endDate` can be updated.
 * `type` and `order` are template-locked and cannot be changed after creation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; phaseId: string }> },
) {
  const { hackathonId, phaseId } = await params;
  console.log('[api/hackathons/[id]/phases/[phaseId]] PATCH:', { hackathonId, phaseId });

  try {
    const body = await request.json();
    const { orgId, ...data } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    // Verify hackathon belongs to org
    const hackathon = await db.query.hackathons.findFirst({
      where: and(
        eq(hackathons.id, hackathonId),
        eq(hackathons.orgId, orgId),
        isNull(hackathons.deletedAt),
      ),
      columns: { id: true },
    });

    if (!hackathon) {
      return NextResponse.json(
        { message: 'Hackathon not found.' },
        { status: 404 },
      );
    }

    const parsed = updatePhaseSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Verify phase exists and belongs to hackathon
    const existing = await db.query.phases.findFirst({
      where: and(
        eq(phases.id, phaseId),
        eq(phases.hackathonId, hackathonId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Phase not found.' },
        { status: 404 },
      );
    }

    // Build update payload — convert date strings to Date objects
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    }

    const [updated] = await db
      .update(phases)
      .set(updateData)
      .where(eq(phases.id, phaseId))
      .returning();

    console.log('[api/hackathons/[id]/phases/[phaseId]] PATCH: updated:', { id: updated.id });
    return NextResponse.json({
      message: 'Phase updated.',
      phase: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/phases/[phaseId]] PATCH error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
