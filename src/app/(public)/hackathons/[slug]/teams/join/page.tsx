import { and, count, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/db';
import { teamMembers } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { getHackathonBySlug } from '@/lib/services/hackathon-service';
import { getTeamByInviteCode } from '@/lib/services/team-service';

import { JoinLinkClient } from './_components/join-link-client';

export default async function JoinLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;

  if (!code) notFound();

  const [teamData, hackathonData] = await Promise.all([
    getTeamByInviteCode(code),
    getHackathonBySlug(slug),
  ]);

  if (!teamData || !hackathonData) notFound();

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamData.id));

  const session = await auth();

  return (
    <JoinLinkClient
      code={code}
      team={{
        id: teamData.id,
        name: teamData.name,
        hackathonId: teamData.hackathonId,
        memberCount,
        maxSize: hackathonData.hackathon.teamMaxSize,
        isOpen: teamData.isOpen,
      }}
      hackathonSlug={slug}
      hackathonTitle={hackathonData.hackathon.title}
      isAuthenticated={!!session?.user?.id}
    />
  );
}
