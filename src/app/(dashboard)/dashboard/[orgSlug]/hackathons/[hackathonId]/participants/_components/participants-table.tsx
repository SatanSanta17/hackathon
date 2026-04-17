'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { RegistrationWithUser } from '@/lib/services/registration-service';
import type { RegistrationField } from '@/db/schema';

interface ParticipantsTableProps {
  registrations: RegistrationWithUser[];
  fields: RegistrationField[];
  orgSlug: string;
  hackathonId: string;
}

type TeamFilter = 'all' | 'has_team' | 'no_team';

export function ParticipantsTable({
  registrations,
  fields,
  hackathonId,
}: ParticipantsTableProps) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');

  const tracks = useMemo(() => {
    const names = new Set<string>();
    for (const r of registrations) {
      if (r.team?.trackName) names.add(r.team.trackName);
    }
    return Array.from(names).sort();
  }, [registrations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return registrations.filter((r) => {
      if (q && !r.user.name.toLowerCase().includes(q) && !r.user.email.toLowerCase().includes(q)) {
        return false;
      }
      if (teamFilter === 'has_team' && !r.team) return false;
      if (teamFilter === 'no_team' && r.team) return false;
      if (trackFilter !== 'all' && r.team?.trackName !== trackFilter) return false;
      return true;
    });
  }, [registrations, search, teamFilter, trackFilter]);

  if (registrations.length === 0) {
    return (
      <p className="text-muted-foreground">No participants yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />

        <div className="flex gap-1.5">
          {(['all', 'has_team', 'no_team'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTeamFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                teamFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f === 'all' ? 'All' : f === 'has_team' ? 'Has Team' : 'No Team'}
            </button>
          ))}
        </div>

        {tracks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTrackFilter('all')}
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
                key={t}
                onClick={() => setTrackFilter(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  trackFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Registered</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Team</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Track</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Discoverable</th>
              {fields.map((f) => (
                <th key={f.id} className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6 + fields.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No participants match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.registeredAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {r.team ? (
                      <Link
                        href={`/api/hackathons/${hackathonId}/teams/${r.team.id}`}
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        {r.team.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.team?.trackName ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.isDiscoverable ? (
                      <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15">
                        Visible
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Hidden</span>
                    )}
                  </td>
                  {fields.map((f) => (
                    <td key={f.id} className="px-4 py-3 text-muted-foreground">
                      {r.formData?.[f.id] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
