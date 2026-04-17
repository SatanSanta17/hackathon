import { and, count, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { db } from '@/db';
import { teamMembers } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { getHackathonBySlug } from '@/lib/services/hackathon-service';
import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import { getUserTeamForHackathon } from '@/lib/services/team-service';
import { getTeamUpRequestsForUser } from '@/lib/services/team-up-service';
import type { TeamUpRequestWithUser } from '@/lib/services/team-up-service';

import { ParticipantsBrowseClient } from './_components/participants-browse-client';

export default async function ParticipantsBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/hackathons/${slug}/participants`);
  }

  const data = await getHackathonBySlug(slug);
  if (!data) notFound();
  const { hackathon } = data;

  const userId = session.user.id;

  const [registration, userTeam, incomingRequests] = await Promise.all([
    getRegistrationByUserAndHackathon(userId, hackathon.id),
    getUserTeamForHackathon(userId, hackathon.id),
    getTeamUpRequestsForUser(userId, hackathon.id),
  ]);

  let viewerRole: 'lead' | 'member' | null = null;
  let viewerTeamMemberCount = 0;
  if (userTeam) {
    const [[membership], [countResult]] = await Promise.all([
      db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, userTeam.id), eq(teamMembers.userId, userId)))
        .limit(1),
      db
        .select({ total: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, userTeam.id)),
    ]);
    viewerRole = (membership?.role as 'lead' | 'member') ?? null;
    viewerTeamMemberCount = countResult?.total ?? 0;
  }

  const viewerTeamIsFull = viewerTeamMemberCount >= hackathon.teamMaxSize;

  return (
    <ParticipantsBrowseClient
      hackathonId={hackathon.id}
      hackathonSlug={slug}
      hackathonTitle={hackathon.title}
      viewerUserId={userId}
      isRegistered={!!registration}
      hasTeam={!!userTeam}
      viewerRole={viewerRole}
      viewerTeamId={userTeam?.id ?? null}
      viewerTeamIsFull={viewerTeamIsFull}
      incomingTeamUpRequests={incomingRequests}
    />
  );
}
