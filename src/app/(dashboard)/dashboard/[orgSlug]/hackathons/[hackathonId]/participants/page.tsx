import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug } from '@/lib/services/org-service';
import { getHackathonById } from '@/lib/services/hackathon-service';
import {
  getRegistrationsByHackathon,
  getRegistrationFields,
} from '@/lib/services/registration-service';
import { ParticipantsTable } from './_components/participants-table';

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; hackathonId: string }>;
}) {
  const { orgSlug, hackathonId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  const hackathon = await getHackathonById({ hackathonId, orgId: org.id });
  if (!hackathon) {
    notFound();
  }

  const [registrations, fields] = await Promise.all([
    getRegistrationsByHackathon(hackathonId),
    getRegistrationFields(hackathonId),
  ]);

  const registeredCount = registrations.length;
  const participatingCount = registrations.filter((r) => r.team !== null).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Participants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hackathon.hackathon.title}
          </p>
        </div>
        <a
          href={`/api/hackathons/${hackathonId}/registrations/export`}
          download
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Export CSV
        </a>
      </div>

      <div className="flex gap-4">
        <div className="rounded-lg border px-4 py-3">
          <p className="text-2xl font-semibold">{registeredCount}</p>
          <p className="text-sm text-muted-foreground">Registered</p>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <p className="text-2xl font-semibold">{participatingCount}</p>
          <p className="text-sm text-muted-foreground">Participating</p>
        </div>
      </div>

      <ParticipantsTable
        registrations={registrations}
        fields={fields}
        orgSlug={orgSlug}
        hackathonId={hackathonId}
      />
    </div>
  );
}
