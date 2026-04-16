import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { updateTrackSchema } from '@/lib/validations/hackathon';
import { db } from '@/db';
import { hackathons, tracks } from '@/db/schema';

/**
 * PATCH /api/hackathons/[hackathonId]/tracks/[trackId] — Edit a track
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; trackId: string }> },
) {
  const { hackathonId, trackId } = await params;
  console.log('[api/hackathons/[id]/tracks/[trackId]] PATCH:', { hackathonId, trackId });

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

    const parsed = updateTrackSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Verify track exists and belongs to hackathon
    const existing = await db.query.tracks.findFirst({
      where: and(
        eq(tracks.id, trackId),
        eq(tracks.hackathonId, hackathonId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Track not found.' },
        { status: 404 },
      );
    }

    const [updated] = await db
      .update(tracks)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId))
      .returning();

    console.log('[api/hackathons/[id]/tracks/[trackId]] PATCH: updated:', { id: updated.id });
    return NextResponse.json({
      message: 'Track updated.',
      track: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/tracks/[trackId]] PATCH error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/hackathons/[hackathonId]/tracks/[trackId] — Remove a track
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; trackId: string }> },
) {
  const { hackathonId, trackId } = await params;
  console.log('[api/hackathons/[id]/tracks/[trackId]] DELETE:', { hackathonId, trackId });

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

    // Verify track exists and belongs to hackathon
    const existing = await db.query.tracks.findFirst({
      where: and(
        eq(tracks.id, trackId),
        eq(tracks.hackathonId, hackathonId),
      ),
      columns: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Track not found.' },
        { status: 404 },
      );
    }

    // Hard delete — tracks are child entities with CASCADE
    await db.delete(tracks).where(eq(tracks.id, trackId));

    console.log('[api/hackathons/[id]/tracks/[trackId]] DELETE: removed:', { id: trackId });
    return NextResponse.json({ message: 'Track deleted.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/tracks/[trackId]] DELETE error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
