import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { TEAM_MEMBER_ROLE } from '@/lib/constants/enums';
import { getHackathonBySlug } from '@/lib/services/hackathon-service';
import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import {
  getJoinRequestsForTeam,
  getTeamWithMembers,
  getUserTeamForHackathon,
} from '@/lib/services/team-service';

import { TeamProfileClient } from './_components/team-profile-client';

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/hackathons/${slug}/teams/${teamId}`);
  }

  const userId = session.user.id;

  const [teamData, hackathonData] = await Promise.all([
    getTeamWithMembers(teamId),
    getHackathonBySlug(slug),
  ]);

  if (!teamData || !hackathonData) notFound();
  const { hackathon } = hackathonData;

  if (teamData.hackathonId !== hackathon.id) notFound();

  const viewerMember = teamData.members.find((m) => m.userId === userId);
  const viewerRole = (viewerMember?.role ?? null) as 'lead' | 'member' | null;

  const [registration, userTeam] = await Promise.all([
    getRegistrationByUserAndHackathon(userId, hackathon.id),
    getUserTeamForHackathon(userId, hackathon.id),
  ]);

  const isOnDifferentTeam = !viewerMember && userTeam !== null;

  const joinRequests = viewerRole === TEAM_MEMBER_ROLE.LEAD ? await getJoinRequestsForTeam(teamId) : [];

  return (
    <TeamProfileClient
      team={teamData}
      hackathon={{
        id: hackathon.id,
        slug,
        title: hackathon.title,
        requiresApproval: hackathon.requiresApproval,
        teamMaxSize: hackathon.teamMaxSize,
      }}
      viewerUserId={userId}
      viewerRole={viewerRole}
      isRegistered={!!registration}
      isOnDifferentTeam={isOnDifferentTeam}
      initialJoinRequests={joinRequests}
    />
  );
}
