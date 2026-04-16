import { Trophy } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Hackathons — ${orgSlug} — HackForge` };
}

export default function HackathonsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Hackathons</h1>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
        <Trophy className="size-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">No hackathons yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hackathon management is coming in Phase 2.
        </p>
      </div>
    </div>
  );
}
