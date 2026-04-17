'use client';

import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { TeamBrowseItem } from '@/lib/services/team-service';
import { TeamBrowseCard } from './team-browse-card';

interface TeamBrowseClientProps {
  hackathonId: string;
  hackathonSlug: string;
  tracks: { id: string; name: string }[];
  isAuthenticated: boolean;
  isRegistered: boolean;
  hasTeam: boolean;
  userTeamId: string | null;
}

export function TeamBrowseClient({
  hackathonId,
  hackathonSlug,
  tracks,
  isAuthenticated,
  isRegistered,
  hasTeam,
  userTeamId,
}: TeamBrowseClientProps) {
  const [teams, setTeams] = useState<TeamBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState<string>('all');

  async function fetchTeams(trackId?: string) {
    setLoading(true);
    try {
      const url = trackId
        ? `/api/hackathons/${hackathonId}/teams?trackId=${trackId}`
        : `/api/hackathons/${hackathonId}/teams`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeams();
  }, [hackathonId]);

  function handleTrackFilter(trackId: string) {
    setTrackFilter(trackId);
    fetchTeams(trackId === 'all' ? undefined : trackId);
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tracks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleTrackFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              trackFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            All Tracks
          </button>
          {tracks.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTrackFilter(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                trackFilter === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {teams.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No open teams yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamBrowseCard
              key={team.id}
              team={team}
              hackathonSlug={hackathonSlug}
              hackathonId={hackathonId}
              isAuthenticated={isAuthenticated}
              isRegistered={isRegistered}
              hasTeam={hasTeam}
              userTeamId={userTeamId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
