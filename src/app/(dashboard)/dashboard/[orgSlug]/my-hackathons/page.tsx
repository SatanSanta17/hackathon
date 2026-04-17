import { auth } from '@/lib/auth/auth';
import { getRegistrationsByUser } from '@/lib/services/registration-service';
import { getStorageProvider } from '@/lib/storage';
import { MyHackathonCard } from './_components/my-hackathon-card';

export default async function MyHackathonsPage() {
  const session = await auth();
  const summaries = await getRegistrationsByUser(session!.user.id);
  const storage = getStorageProvider();

  const withUrls = await Promise.all(
    summaries.map(async (s) => ({
      ...s,
      coverImageUrl: s.hackathon.coverImageKey
        ? await storage.getSignedUrl(s.hackathon.coverImageKey)
        : null,
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
