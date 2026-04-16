import { redirect, notFound } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug } from '@/lib/services/org-service';
import {
  getHackathonById,
  getTemplates,
} from '@/lib/services/hackathon-service';
import { WizardShell } from '../../create/_components/wizard-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; hackathonId: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Edit Hackathon — ${orgSlug} — HackForge` };
}

export default async function EditHackathonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; hackathonId: string }>;
}) {
  const { orgSlug, hackathonId } = await params;

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

  // Load hackathon with all relations
  const hackathon = await getHackathonById({
    hackathonId,
    orgId: org.id,
  });

  if (!hackathon) {
    notFound();
  }

  // Fetch templates (needed for Step 1 read-only display + Review step)
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Hackathon</h1>
        <p className="text-sm text-muted-foreground">
          Update your hackathon details. Changes are saved per step.
        </p>
      </div>

      <WizardShell
        orgSlug={orgSlug}
        orgId={org.id}
        hackathon={hackathon}
        templates={templates}
      />
    </div>
  );
}
