import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getHackathonBySlug } from '@/lib/services/hackathon-service';
import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import { getUserTeamForHackathon } from '@/lib/services/team-service';

import { CreateTeamButton } from './_components/create-team-button';
import { TeamBrowseClient } from './_components/team-browse-client';

export default async function TeamBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getHackathonBySlug(slug);

  if (!data || !['published', 'active'].includes(data.hackathon.status)) {
    notFound();
  }

  const { hackathon, tracks } = data;
  const session = await auth();

  let registration = null;
  let userTeam = null;

  if (session?.user?.id) {
    registration = await getRegistrationByUserAndHackathon(session.user.id, hackathon.id);
    if (registration) {
      userTeam = await getUserTeamForHackathon(session.user.id, hackathon.id);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">{hackathon.title}</p>
        </div>
        {registration && !userTeam && (
          <CreateTeamButton
            hackathonId={hackathon.id}
            hackathonSlug={slug}
            tracks={tracks.map((t) => ({ id: t.id, name: t.name }))}
          />
        )}
      </div>
      <TeamBrowseClient
        hackathonId={hackathon.id}
        hackathonSlug={slug}
        tracks={tracks.map((t) => ({ id: t.id, name: t.name }))}
        isAuthenticated={!!session?.user?.id}
        isRegistered={!!registration}
        hasTeam={!!userTeam}
      />
    </div>
  );
}
