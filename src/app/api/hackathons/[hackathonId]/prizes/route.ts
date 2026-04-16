import { NextResponse } from 'next/server';
import { eq, and, isNull, max } from 'drizzle-orm';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { createPrizeSchema } from '@/lib/validations/hackathon';
import { db } from '@/db';
import { hackathons, prizes } from '@/db/schema';

/**
 * POST /api/hackathons/[hackathonId]/prizes — Add a prize
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/prizes] POST:', { hackathonId });

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

    const parsed = createPrizeSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Auto-assign rank as max(rank) + 1 if not provided
    let rank = parsed.data.rank;
    if (!rank) {
      const [maxRankResult] = await db
        .select({ maxRank: max(prizes.rank) })
        .from(prizes)
        .where(eq(prizes.hackathonId, hackathonId));

      rank = (maxRankResult?.maxRank ?? 0) + 1;
    }

    const [prize] = await db
      .insert(prizes)
      .values({
        hackathonId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        rank,
        imageKey: parsed.data.imageKey ?? null,
      })
      .returning();

    console.log('[api/hackathons/[id]/prizes] POST: created:', { id: prize.id });
    return NextResponse.json(
      { message: 'Prize created.', prize },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/hackathons/[id]/prizes] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
