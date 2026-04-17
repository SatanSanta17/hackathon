'use client';

import { useState, useMemo, useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminTeamRow } from '@/lib/services/team-service';

interface AdminTeamsClientProps {
  teams: AdminTeamRow[];
  requiresApproval: boolean;
  hackathonId: string;
  orgSlug: string;
}

function AdminStatusBadge({ status }: { status: AdminTeamRow['adminStatus'] }) {
  if (status === 'pending_review') {
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Under Review
      </Badge>
    );
  }
  if (status === 'approved') {
    return (
      <Badge className="border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400">
        Approved
      </Badge>
    );
  }
  return <Badge variant="destructive">Rejected</Badge>;
}

export function AdminTeamsClient({
  teams,
  requiresApproval,
  hackathonId,
  orgSlug,
}: AdminTeamsClientProps) {
  const [localTeams, setLocalTeams] = useState(teams);
  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending_review' | 'approved' | 'rejected'
  >('all');
  const [isPending, startTransition] = useTransition();

  const trackOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of teams) {
      if (t.trackId && t.trackName && !seen.has(t.trackId)) {
        seen.set(t.trackId, t.trackName);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [teams]);

  const pendingTeams = useMemo(
    () => localTeams.filter((t) => t.adminStatus === 'pending_review'),
    [localTeams],
  );

  const filteredTeams = useMemo(() => {
    return localTeams.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
      const matchesTrack = trackFilter === 'all' || t.trackId === trackFilter;
      const matchesStatus = statusFilter === 'all' || t.adminStatus === statusFilter;
      return matchesSearch && matchesTrack && matchesStatus;
    });
  }, [localTeams, search, trackFilter, statusFilter]);

  async function handleApprove(teamId: string) {
    startTransition(async () => {
      const res = await fetch(
        `/api/hackathons/${hackathonId}/teams/${teamId}/approve`,
        { method: 'POST' },
      );
      if (!res.ok) {
        toast.error('Failed to approve team.');
        return;
      }
      setLocalTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, adminStatus: 'approved' as const, reviewReason: null } : t,
        ),
      );
      toast.success('Team approved.');
    });
  }

  async function handleReject(teamId: string) {
    startTransition(async () => {
      const res = await fetch(
        `/api/hackathons/${hackathonId}/teams/${teamId}/reject`,
        { method: 'POST' },
      );
      if (!res.ok) {
        toast.error('Failed to reject team.');
        return;
      }
      setLocalTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, adminStatus: 'rejected' as const } : t,
        ),
      );
      toast.success('Team rejected.');
    });
  }

  return (
    <div className="space-y-6">
      {/* Pending Review section */}
      {requiresApproval && pendingTeams.length > 0 && (
        <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="font-semibold text-amber-600 dark:text-amber-400">
            Pending Review ({pendingTeams.length})
          </h2>
          <div className="space-y-2">
            {pendingTeams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded border bg-card p-3"
              >
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Lead: {team.leadName ?? '—'} · {team.memberCount}{' '}
                    {team.memberCount === 1 ? 'member' : 'members'}
                    {team.reviewReason ? ` · ${team.reviewReason}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(team.id)}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(team.id)}
                    disabled={isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        {trackOptions.length > 0 && (
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All tracks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tracks</SelectItem>
              {trackOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {requiresApproval && (
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as typeof statusFilter)
            }
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Teams table */}
      {filteredTeams.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No teams found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Track</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Lead</TableHead>
                {requiresApproval && <TableHead>Status</TableHead>}
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    {team.trackName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={team.isOpen ? 'outline' : 'secondary'}>
                      {team.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </TableCell>
                  <TableCell>{team.memberCount}</TableCell>
                  <TableCell>
                    {team.leadName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {requiresApproval && (
                    <TableCell>
                      <AdminStatusBadge status={team.adminStatus} />
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
