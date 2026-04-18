'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { JOIN_REQUEST_STATUS, TEAM_MEMBER_ROLE } from '@/lib/constants/enums';
import type { DiscoverableParticipant } from '@/lib/services/registration-service';
import type { TeamUpRequestWithUser } from '@/lib/services/team-up-service';
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
  viewerTeamIsFull: boolean;
  incomingTeamUpRequests: TeamUpRequestWithUser[];
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
  viewerTeamIsFull,
  incomingTeamUpRequests,
}: ParticipantsBrowseClientProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState<DiscoverableParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingRequests, setPendingRequests] = useState<TeamUpRequestWithUser[]>(incomingTeamUpRequests);
  const [, startTransition] = useTransition();

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
  const viewerIsLead = viewerRole === TEAM_MEMBER_ROLE.LEAD;

  async function handleRespond(requestId: string, status: 'accepted' | 'rejected') {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/hackathons/${hackathonId}/team-up-requests/${requestId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          },
        );
        const body = await res.json();
        if (!res.ok) {
          toast.error(body.message ?? 'Failed to respond to request.');
          return;
        }
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (status === JOIN_REQUEST_STATUS.ACCEPTED) {
          toast.success('Team created! Redirecting…');
          router.push(`/hackathons/${hackathonSlug}/teams/${body.teamId}`);
        } else {
          toast.success('Request declined.');
        }
      } catch {
        toast.error('Network error. Please try again.');
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/hackathons/${hackathonSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to {hackathonTitle}
      </Link>
      <div>
        <h1 className="font-heading text-3xl font-bold">Participants</h1>
        <p className="mt-1 text-sm text-muted-foreground">{hackathonTitle}</p>
      </div>

      {/* Incoming team-up requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team-Up Requests ({pendingRequests.length})
          </h2>
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  <span className="text-foreground">{req.fromUser.name}</span>
                  {' '}wants to team up with you
                </p>
                <p className="text-xs text-muted-foreground">
                  Proposed team: <span className="font-medium text-foreground">{req.proposedTeamName}</span>
                </p>
                {req.message && (
                  <p className="text-xs text-muted-foreground">"{req.message}"</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRespond(req.id, 'rejected')}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRespond(req.id, 'accepted')}
                >
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              viewerTeamIsFull={viewerTeamIsFull}
            />
          ))}
        </div>
      )}
    </div>
  );
}
