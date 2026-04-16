import { NextResponse } from 'next/server';
import { eq, and, isNull, max } from 'drizzle-orm';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { createTrackSchema } from '@/lib/validations/hackathon';
import { db } from '@/db';
import { hackathons, tracks } from '@/db/schema';

/**
 * POST /api/hackathons/[hackathonId]/tracks — Add a track
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/tracks] POST:', { hackathonId });

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

    const parsed = createTrackSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Auto-assign order as max(order) + 1
    const [maxOrderResult] = await db
      .select({ maxOrder: max(tracks.order) })
      .from(tracks)
      .where(eq(tracks.hackathonId, hackathonId));

    const nextOrder = parsed.data.order ?? ((maxOrderResult?.maxOrder ?? -1) + 1);

    const [track] = await db
      .insert(tracks)
      .values({
        hackathonId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        resourcesUrl: parsed.data.resourcesUrl || null,
        order: nextOrder,
      })
      .returning();

    console.log('[api/hackathons/[id]/tracks] POST: created:', { id: track.id });
    return NextResponse.json(
      { message: 'Track created.', track },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/tracks] POST error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
