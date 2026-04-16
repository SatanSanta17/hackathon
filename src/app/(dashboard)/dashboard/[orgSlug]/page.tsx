import { Trophy, Users, Calendar } from 'lucide-react';

import { StatCard } from './_components/stat-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Dashboard — ${orgSlug} — HackForge` };
}

export default async function OrgDashboardPage() {
  // Stat values are hardcoded in V1 — wired to real data in Phase 2+
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Hackathons"
          value={0}
          icon={<Trophy className="size-5" />}
        />
        <StatCard
          title="Participants"
          value={0}
          icon={<Users className="size-5" />}
        />
        <StatCard
          title="Upcoming"
          value="None"
          icon={<Calendar className="size-5" />}
        />
      </div>
    </div>
  );
}
