import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug } from '@/lib/services/org-service';
import {
  getTemplates,
  getDraftsByUser,
  getHackathonById,
} from '@/lib/services/hackathon-service';
import { WizardShell } from './_components/wizard-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Create Hackathon — ${orgSlug} — HackForge` };
}

export default async function CreateHackathonPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  // Verify session
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Resolve org from slug
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  // Fetch templates for Step 1
  const templates = await getTemplates();

  // Check for existing drafts by this user (for resume-draft flow)
  const drafts = await getDraftsByUser({
    orgId: org.id,
    userId: session.user.id,
  });

  // If there's a draft, load its full relations so WizardShell can resume
  const existingDraft =
    drafts.length > 0
      ? await getHackathonById({ hackathonId: drafts[0].id, orgId: org.id })
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Hackathon</h1>
        <p className="text-sm text-muted-foreground">
          Set up your hackathon step by step. You can save as a draft and continue later.
        </p>
      </div>

      <WizardShell
        orgSlug={orgSlug}
        orgId={org.id}
        templates={templates}
        existingDraft={existingDraft ?? undefined}
      />
    </div>
  );
}
