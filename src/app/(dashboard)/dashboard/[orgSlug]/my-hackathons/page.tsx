import { inArray } from 'drizzle-orm';

import { db } from '@/db';
import { phases as phasesTable } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { getRegistrationsByUser } from '@/lib/services/registration-service';
import { getStorageProvider } from '@/lib/storage';
import { MyHackathonCard } from './_components/my-hackathon-card';

export default async function MyHackathonsPage() {
  const session = await auth();
  const summaries = await getRegistrationsByUser(session!.user.id);
  const storage = getStorageProvider();

  const hackathonIds = summaries.map((s) => s.hackathonId);
  const allPhases =
    hackathonIds.length > 0
      ? await db
          .select({
            hackathonId: phasesTable.hackathonId,
            name: phasesTable.name,
            status: phasesTable.status,
            endDate: phasesTable.endDate,
            order: phasesTable.order,
          })
          .from(phasesTable)
          .where(inArray(phasesTable.hackathonId, hackathonIds))
      : [];

  function getActivePhase(hackathonId: string): { label: string; deadline: string } | null {
    const active = allPhases
      .filter((p) => p.hackathonId === hackathonId && p.status === 'active' && p.endDate)
      .sort((a, b) => a.order - b.order)[0];
    if (!active) return null;
    return { label: active.name, deadline: active.endDate!.toISOString() };
  }

  const withUrls = await Promise.all(
    summaries.map(async (s) => ({
      ...s,
      coverImageUrl: s.hackathon.coverImageKey
        ? await storage.getSignedUrl(s.hackathon.coverImageKey)
        : null,
      activePhase: getActivePhase(s.hackathonId),
    })),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Hackathons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hackathons you&apos;re registered for.
        </p>
      </div>

      {withUrls.length === 0 ? (
        <p className="text-muted-foreground">
          You haven&apos;t registered for any hackathons yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withUrls.map((s) => (
            <MyHackathonCard
              key={s.registrationId}
              summary={{ ...s, coverImageUrl: s.coverImageUrl ?? null }}
              activePhase={s.activePhase ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
