import { redirect } from 'next/navigation';
import { Trophy, Zap, FileEdit, Users, UserCheck } from 'lucide-react';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug } from '@/lib/services/org-service';
import { getHackathonStats } from '@/lib/services/hackathon-service';
import { getOrgParticipantStats } from '@/lib/services/registration-service';
import { StatCard } from './_components/stat-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Dashboard — ${orgSlug} — HackForge` };
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  const [stats, participantStats] = await Promise.all([
    getHackathonStats(org.id),
    getOrgParticipantStats(org.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Hackathons"
          value={stats.total}
          icon={<Trophy className="size-5" />}
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={<Zap className="size-5" />}
        />
        <StatCard
          title="Drafts"
          value={stats.draft}
          icon={<FileEdit className="size-5" />}
        />
        <StatCard
          title="Registered"
          value={participantStats.registered}
          icon={<Users className="size-5" />}
        />
        <StatCard
          title="Participating"
          value={participantStats.participating}
          icon={<UserCheck className="size-5" />}
        />
      </div>
    </div>
  );
}
