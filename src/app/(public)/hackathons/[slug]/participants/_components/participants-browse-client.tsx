'use client';

import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { DiscoverableParticipant } from '@/lib/services/registration-service';
import { ParticipantCard } from './participant-card';

interface ParticipantsBrowseClientProps {
  hackathonId: string;
  hackathonSlug: string;
  hackathonTitle: string;
  viewerUserId: string;
  isRegistered: boolean;
  hasTeam: boolean;
  viewerRole: 'lead' | 'member' | null;
  viewerTeamId: string | null;
}

export function ParticipantsBrowseClient({
  hackathonId,
  hackathonSlug,
  hackathonTitle,
  viewerUserId,
  isRegistered,
  hasTeam,
  viewerRole,
  viewerTeamId,
}: ParticipantsBrowseClientProps) {
  const [participants, setParticipants] = useState<DiscoverableParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/hackathons/${hackathonId}/participants`)
      .then((r) => r.json())
      .then((d) => setParticipants(d.participants ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hackathonId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return participants.filter(
      (p) =>
        p.userId !== viewerUserId &&
        (!q || p.user.name.toLowerCase().includes(q)),
    );
  }, [participants, search, viewerUserId]);

  const viewerIsRegisteredUnteamed = isRegistered && !hasTeam;
  const viewerIsLead = viewerRole === 'lead';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Participants</h1>
        <p className="mt-1 text-sm text-muted-foreground">{hackathonTitle}</p>
      </div>

      <Input
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-64"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No participants available to team up with right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              hackathonId={hackathonId}
              hackathonSlug={hackathonSlug}
              viewerIsRegisteredUnteamed={viewerIsRegisteredUnteamed}
              viewerIsLead={viewerIsLead}
              viewerTeamId={viewerTeamId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
