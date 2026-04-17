import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teams } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { acceptTeamInvite } from '@/lib/services/team-service';
import { z } from 'zod';

const acceptInviteSchema = z.object({ token: z.string().min(1) });

/**
 * POST /api/team-invites/accept
 * Accept a team invite by token.
 */
export async function POST(request: Request) {
  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Token is required.' }, { status: 400 });
  }

  try {
    const { teamId } = await acceptTeamInvite(parsed.data.token);

    const [team] = await db
      .select({ hackathonId: teams.hackathonId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
    }

    const [hackathon] = await db
      .select({ slug: hackathons.slug })
      .from(hackathons)
      .where(and(eq(hackathons.id, team.hackathonId), isNull(hackathons.deletedAt)))
      .limit(1);

    return NextResponse.json({ teamId, hackathonSlug: hackathon?.slug ?? null });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'INVITE_NOT_FOUND') {
        return NextResponse.json({ message: 'Invite not found.' }, { status: 404 });
      }
      if (err.message === 'INVITE_EXPIRED') {
        return NextResponse.json(
          { message: 'This invite has expired. Ask the team lead to re-invite you.' },
          { status: 410 },
        );
      }
      if (err.message === 'INVITE_ALREADY_USED') {
        return NextResponse.json(
          { message: 'This invite has already been used.' },
          { status: 400 },
        );
      }
      if (err.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ message: 'No account found for this invite email.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
