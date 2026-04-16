import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug, checkUserOrgRole } from '@/lib/services/org-service';
import { getHackathonsByOrgId } from '@/lib/services/hackathon-service';
import { HackathonList } from './_components/hackathon-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Hackathons — ${orgSlug} — HackForge` };
}

export default async function HackathonsPage({
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

  // Fetch with archived included for filtering
  const hackathons = await getHackathonsByOrgId({
    orgId: org.id,
    includeArchived: true,
  });

  // Determine user role for permission gating
  const orgRole = await checkUserOrgRole({
    userId: session.user.id,
    orgId: org.id,
  });

  const isAdmin = orgRole?.role === 'org_admin';

  return (
    <div className="space-y-6">
      <HackathonList
        hackathons={hackathons}
        orgSlug={orgSlug}
        orgId={org.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
