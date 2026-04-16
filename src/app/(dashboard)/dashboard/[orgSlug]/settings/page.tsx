import { Settings } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Settings — ${orgSlug} — HackForge` };
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
        <Settings className="size-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Organization settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization settings are coming in a future phase.
        </p>
      </div>
    </div>
  );
}
