import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getTeamWithMembers, transferLeadership } from '@/lib/services/team-service';
import { transferLeadSchema } from '@/lib/validations/team';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead
 * Transfer leadership to another member. Lead only.
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
    return NextResponse.json({ message: 'Only the team lead can transfer leadership.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = transferLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const targetMember = team.members.find((m) => m.userId === parsed.data.toUserId);
  if (!targetMember) {
    return NextResponse.json(
      { message: 'Target user is not a member of this team.' },
      { status: 400 },
    );
  }

  try {
    await transferLeadership(teamId, user.id, parsed.data.toUserId);
    return NextResponse.json({ message: 'Leadership transferred.' });
  } catch {
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
