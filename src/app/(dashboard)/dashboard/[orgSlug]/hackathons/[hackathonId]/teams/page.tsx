import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug, checkUserOrgRole } from '@/lib/services/org-service';
import { getHackathonById } from '@/lib/services/hackathon-service';
import { getAllTeamsForHackathon } from '@/lib/services/team-service';
import { AdminTeamsClient } from './_components/admin-teams-client';

export default async function AdminTeamsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; hackathonId: string }>;
}) {
  const { orgSlug, hackathonId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const org = await getOrgBySlug(orgSlug);
  if (!org) redirect('/dashboard');

  const membership = await checkUserOrgRole({ userId: session.user.id, orgId: org.id });
  if (membership?.role !== 'org_admin') redirect(`/dashboard/${orgSlug}`);

  const hackathon = await getHackathonById({ hackathonId, orgId: org.id });
  if (!hackathon) notFound();

  const teams = await getAllTeamsForHackathon(hackathonId);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${orgSlug}/hackathons`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Hackathons
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hackathon.hackathon.title}
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href={`/dashboard/${orgSlug}/hackathons/${hackathonId}/participants`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Participants
          </Link>
          <span className="font-medium">Teams</span>
        </nav>
      </div>

      <AdminTeamsClient
        teams={teams}
        requiresApproval={hackathon.hackathon.requiresApproval}
        hackathonId={hackathonId}
        orgSlug={orgSlug}
      />
    </div>
  );
}
