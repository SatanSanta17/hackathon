import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { updatePrizeSchema } from '@/lib/validations/hackathon';
import { db } from '@/db';
import { hackathons, prizes } from '@/db/schema';

/**
 * PATCH /api/hackathons/[hackathonId]/prizes/[prizeId] — Edit a prize
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; prizeId: string }> },
) {
  const { hackathonId, prizeId } = await params;
  console.log('[api/hackathons/[id]/prizes/[prizeId]] PATCH:', { hackathonId, prizeId });

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

    const parsed = updatePrizeSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Verify prize exists and belongs to hackathon
    const existing = await db.query.prizes.findFirst({
      where: and(
        eq(prizes.id, prizeId),
        eq(prizes.hackathonId, hackathonId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Prize not found.' },
        { status: 404 },
      );
    }

    const [updated] = await db
      .update(prizes)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(prizes.id, prizeId))
      .returning();

    console.log('[api/hackathons/[id]/prizes/[prizeId]] PATCH: updated:', { id: updated.id });
    return NextResponse.json({
      message: 'Prize updated.',
      prize: updated,
    });
  } catch (err) {
    console.error('[api/hackathons/[id]/prizes/[prizeId]] PATCH error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/hackathons/[hackathonId]/prizes/[prizeId] — Remove a prize
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; prizeId: string }> },
) {
  const { hackathonId, prizeId } = await params;
  console.log('[api/hackathons/[id]/prizes/[prizeId]] DELETE:', { hackathonId, prizeId });

  try {
    const body = await request.json();
    const { orgId } = body;

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

    // Verify prize exists and belongs to hackathon
    const existing = await db.query.prizes.findFirst({
      where: and(
        eq(prizes.id, prizeId),
        eq(prizes.hackathonId, hackathonId),
      ),
      columns: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Prize not found.' },
        { status: 404 },
      );
    }

    // Hard delete — prizes are child entities with CASCADE
    await db.delete(prizes).where(eq(prizes.id, prizeId));

    console.log('[api/hackathons/[id]/prizes/[prizeId]] DELETE: removed:', { id: prizeId });
    return NextResponse.json({ message: 'Prize deleted.' });
  } catch (err) {
    console.error('[api/hackathons/[id]/prizes/[prizeId]] DELETE error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
