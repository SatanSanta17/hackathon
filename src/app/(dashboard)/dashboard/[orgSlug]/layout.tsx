import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug, getUserOrgs } from '@/lib/services/org-service';
import { checkUserOrgRole } from '@/lib/services/org-service';
import { AppSidebar } from '../../_components/app-sidebar';
import { TopBar } from '../../_components/top-bar';
import { SidebarInset } from '@/components/ui/sidebar';

export default async function OrgScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  // Verify session
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch org by slug
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  // Validate user is a member of this org
  const membership = await checkUserOrgRole({
    userId: session.user.id,
    orgId: org.id,
  });

  if (!membership) {
    redirect('/dashboard');
  }

  // Fetch all user orgs for the org switcher
  const userOrgs = await getUserOrgs(session.user.id);

  const currentOrg = {
    id: org.id,
    name: org.name,
    slug: org.slug,
  };

  return (
    <>
      <AppSidebar orgSlug={orgSlug} />
      <SidebarInset>
        <TopBar currentOrg={currentOrg} userOrgs={userOrgs} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
