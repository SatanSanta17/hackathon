import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug, getOrgMembers, checkUserOrgRole } from '@/lib/services/org-service';
import { MemberTable } from './_components/member-table';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Members — ${orgSlug} — HackForge` };
}

export default async function MembersPage({
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

  const membership = await checkUserOrgRole({
    userId: session.user.id,
    orgId: org.id,
  });

  if (!membership) {
    redirect('/dashboard');
  }

  const members = await getOrgMembers(org.id);

  // Serialize dates for client component
  const serializedMembers = members.map((m) => ({
    membership: {
      id: m.membership.id,
      userId: m.membership.userId,
      orgId: m.membership.orgId,
      role: m.membership.role,
      joinedAt: m.membership.joinedAt?.toISOString() ?? null,
      createdAt: m.membership.createdAt.toISOString(),
    },
    user: m.user,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Members</h1>
      <MemberTable
        orgId={org.id}
        initialMembers={serializedMembers}
        currentUserRole={membership.role}
      />
    </div>
  );
}
