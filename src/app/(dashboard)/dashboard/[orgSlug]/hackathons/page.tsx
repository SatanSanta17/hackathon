import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

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
      <Link
        href={`/dashboard/${orgSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Dashboard
      </Link>
      <HackathonList
        hackathons={hackathons}
        orgSlug={orgSlug}
        orgId={org.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
