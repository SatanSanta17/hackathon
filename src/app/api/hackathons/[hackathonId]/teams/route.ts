import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { ERR } from '@/lib/constants/error-codes';
import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import {
  createTeam,
  getTeamsByHackathon,
  getUserTeamForHackathon,
} from '@/lib/services/team-service';
import { createTeamSchema } from '@/lib/validations/team';

/**
 * GET /api/hackathons/[hackathonId]/teams
 * List open, non-full, approved teams for public browse.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId') ?? undefined;

  const [hackathon] = await db
    .select({ teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const teams = await getTeamsByHackathon(hackathonId, {
    isOpen: true,
    adminStatus: 'approved',
    maxSize: hackathon.teamMaxSize,
    trackId,
  });

  return NextResponse.json({ teams });
}

/**
 * POST /api/hackathons/[hackathonId]/teams
 * Create a new team for the authenticated user.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const [hackathon] = await db
    .select({ id: hackathons.id, status: hackathons.status })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const registration = await getRegistrationByUserAndHackathon(user.id, hackathonId);
  if (!registration) {
    return NextResponse.json(
      { message: 'You must register before creating a team.' },
      { status: 403 },
    );
  }

  const existingTeam = await getUserTeamForHackathon(user.id, hackathonId);
  if (existingTeam) {
    return NextResponse.json(
      { message: 'You are already on a team for this hackathon.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const team = await createTeam(hackathonId, user.id, parsed.data);
    return NextResponse.json(
      { team: { id: team.id, name: team.name, hackathonId: team.hackathonId, adminStatus: team.adminStatus, inviteCode: team.inviteCode } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === ERR.ALREADY_IN_TEAM) {
      return NextResponse.json(
        { message: 'You are already on a team for this hackathon.' },
        { status: 403 },
      );
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
