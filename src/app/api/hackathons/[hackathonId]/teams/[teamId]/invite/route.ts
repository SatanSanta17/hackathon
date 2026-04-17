import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teamMembers } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getTeamWithMembers, inviteMemberByEmail } from '@/lib/services/team-service';
import { inviteByEmailSchema } from '@/lib/validations/team';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/invite
 * Invite a user to the team by email. Lead only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; teamId: string }> },
) {
  const { hackathonId, teamId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const team = await getTeamWithMembers(teamId);
  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  const viewer = team.members.find((m) => m.userId === user.id);
  if (!viewer || viewer.role !== 'lead') {
    return NextResponse.json({ message: 'Only the team lead can invite members.' }, { status: 403 });
  }

  const [hackathon] = await db
    .select({ teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .limit(1);

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId)));

  if (hackathon && memberCount >= hackathon.teamMaxSize) {
    return NextResponse.json({ message: 'The team is full.' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = inviteByEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await inviteMemberByEmail(teamId, user.id, parsed.data.email);
    return NextResponse.json({ message: 'Invite sent.' });
  } catch {
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
