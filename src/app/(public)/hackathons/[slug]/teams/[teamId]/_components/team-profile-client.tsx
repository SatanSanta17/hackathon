'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TEAM_ADMIN_STATUS, JOIN_ENTRY_POINT, JOIN_REQUEST_STATUS, TEAM_MEMBER_ROLE } from '@/lib/constants/enums';
import type { JoinRequestForTeam, TeamMemberDetail, TeamProfileData } from '@/lib/services/team-service';
import { JoinRequestDialog } from '../../_components/join-request-dialog';
import { EditTeamDialog } from './edit-team-dialog';
import { InviteByEmailDialog } from './invite-by-email-dialog';
import { TransferLeadDialog } from './transfer-lead-dialog';

interface TeamUpRequestRow {
  id: string;
  fromUserId: string;
  proposedTeamName: string;
  message: string | null;
  fromUser: { name: string; email: string; avatarUrl: string | null };
}

interface TeamProfileClientProps {
  team: TeamProfileData;
  hackathon: { id: string; slug: string; title: string; requiresApproval: boolean; teamMaxSize: number };
  viewerUserId: string;
  viewerRole: 'lead' | 'member' | null;
  isRegistered: boolean;
  isOnDifferentTeam: boolean;
  initialJoinRequests: JoinRequestForTeam[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ENTRY_POINT_LABELS: Record<string, string> = {
  [JOIN_ENTRY_POINT.LINK]: 'Via Link',
  [JOIN_ENTRY_POINT.PARTICIPANT_BROWSE]: 'Via Participants',
  [JOIN_ENTRY_POINT.BROWSE]: 'Browsed',
};

function entryPointLabel(ep: string) {
  return ENTRY_POINT_LABELS[ep] ?? ep;
}

export function TeamProfileClient({
  team,
  hackathon,
  viewerUserId,
  viewerRole,
  isRegistered,
  isOnDifferentTeam,
  initialJoinRequests,
}: TeamProfileClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMemberDetail[]>(team.members);
  const [joinRequests, setJoinRequests] = useState<JoinRequestForTeam[]>(initialJoinRequests);

  // Sync members from server after router.refresh() re-renders the parent
  useEffect(() => {
    setMembers(team.members);
  }, [team]);
  const [teamUpRequests, setTeamUpRequests] = useState<TeamUpRequestRow[]>([]);
  const [joinRequestDialogOpen, setJoinRequestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const isFull = hackathon.teamMaxSize > 0 && members.length >= hackathon.teamMaxSize;
  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/hackathons/${hackathon.slug}/teams/join?code=${team.inviteCode}`;

  // Fetch incoming team-up requests for non-member registered+unteamed viewers
  useEffect(() => {
    if (viewerRole === null && isRegistered && !isOnDifferentTeam) {
      fetch(`/api/hackathons/${hackathon.id}/team-up-requests`)
        .then((r) => r.json())
        .then((d) => setTeamUpRequests(d.requests ?? []))
        .catch(() => {});
    }
  }, [hackathon.id, viewerRole, isRegistered, isOnDifferentTeam]);

  async function handleLeave() {
    if (!confirm('Are you sure you want to leave this team?')) return;
    setLeaveLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathon.id}/teams/${team.id}/leave`, {
        method: 'POST',
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.message ?? 'Failed to leave team.');
        return;
      }
      router.push(`/hackathons/${hackathon.slug}`);
    } finally {
      setLeaveLoading(false);
    }
  }

  async function handleJoinRequestRespond(requestId: string, status: 'accepted' | 'rejected') {
    const res = await fetch(
      `/api/hackathons/${hackathon.id}/teams/${team.id}/join-requests/${requestId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.message ?? 'Failed to update request.');
      return;
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (status === JOIN_REQUEST_STATUS.ACCEPTED) {
      router.refresh();
    }
    toast.success(status === JOIN_REQUEST_STATUS.ACCEPTED ? 'Member added.' : 'Request rejected.');
  }

  async function handleTeamUpRespond(requestId: string, status: 'accepted' | 'rejected') {
    const res = await fetch(
      `/api/hackathons/${hackathon.id}/team-up-requests/${requestId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message ?? 'Failed to respond.');
      return;
    }
    if (status === JOIN_REQUEST_STATUS.ACCEPTED && data.teamId) {
      router.push(`/hackathons/${hackathon.slug}/teams/${data.teamId}`);
    } else {
      setTeamUpRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success('Request declined.');
    }
  }

  function handleCopyJoinLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const adminStatusBadge = () => {
    if (!hackathon.requiresApproval) return null;
    if (team.adminStatus === TEAM_ADMIN_STATUS.PENDING_REVIEW) {
      return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">Under Review</Badge>;
    }
    if (team.adminStatus === TEAM_ADMIN_STATUS.APPROVED) {
      return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15">Approved</Badge>;
    }
    return <Badge variant="destructive">Not Approved</Badge>;
  };

  // Tracks from page context aren't passed here — edit dialog needs them
  // Use empty array if no track data; edit dialog won't show track select
  const tracks: { id: string; name: string }[] = team.trackName && team.trackId
    ? [{ id: team.trackId, name: team.trackName }]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/hackathons/${hackathon.slug}/teams`}
              className="mb-1 block text-sm text-muted-foreground hover:underline"
            >
              ← Back to Teams
            </Link>
            <h1 className="font-heading text-3xl font-bold">{team.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {team.trackName && (
            <Badge variant="secondary">{team.trackName}</Badge>
          )}
          {team.isOpen ? (
            <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15">Open</Badge>
          ) : (
            <Badge variant="secondary">Closed</Badge>
          )}
          <Badge variant="outline">
            <Users className="mr-1 size-3" />
            {members.length}{hackathon.teamMaxSize > 0 ? ` / ${hackathon.teamMaxSize}` : ''} members
          </Badge>
          {adminStatusBadge()}
        </div>
      </div>

      {/* Status alert for requires_approval hackathons */}
      {hackathon.requiresApproval && viewerRole !== null && (
        <>
          {team.adminStatus === TEAM_ADMIN_STATUS.PENDING_REVIEW && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <AlertDescription>
                Your team is under review. You'll be notified once approved.
              </AlertDescription>
            </Alert>
          )}
          {team.adminStatus === TEAM_ADMIN_STATUS.REJECTED && (
            <Alert variant="destructive">
              <AlertDescription>
                Your team was not approved. Contact the organiser for more information.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Description */}
      {team.description && (
        <p className="text-muted-foreground">{team.description}</p>
      )}

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        {viewerRole === TEAM_MEMBER_ROLE.LEAD && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              Edit Team
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)}>
              Invite by Email
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/hackathons/${hackathon.slug}/participants`}>
                Browse Participants
              </Link>
            </Button>
          </>
        )}
        {viewerRole === TEAM_MEMBER_ROLE.MEMBER && (
          <Button variant="destructive" size="sm" onClick={handleLeave} disabled={leaveLoading}>
            {leaveLoading ? 'Leaving…' : 'Leave Team'}
          </Button>
        )}
        {viewerRole === null && (
          <>
            {!isRegistered && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/hackathons/${hackathon.slug}`}>Register to Join</Link>
              </Button>
            )}
            {isRegistered && isOnDifferentTeam && (
              <Button size="sm" disabled>Already on a Team</Button>
            )}
            {isRegistered && !isOnDifferentTeam && isFull && (
              <Button size="sm" disabled>Team Full</Button>
            )}
            {isRegistered && !isOnDifferentTeam && !isFull && !team.isOpen && (
              <Button size="sm" disabled>Team Closed</Button>
            )}
            {isRegistered && !isOnDifferentTeam && !isFull && team.isOpen && (
              <Button size="sm" onClick={() => setJoinRequestDialogOpen(true)}>
                Request to Join
              </Button>
            )}
          </>
        )}
      </div>

      {/* Members list */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Members</h2>
        </div>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {getInitials(m.name)}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === TEAM_MEMBER_ROLE.LEAD ? 'default' : 'secondary'} className="text-xs">
                  {m.role === TEAM_MEMBER_ROLE.LEAD ? 'Lead' : 'Member'}
                </Badge>
                {viewerRole === TEAM_MEMBER_ROLE.LEAD && m.role !== TEAM_MEMBER_ROLE.LEAD && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    Transfer Lead
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Join link (members only) */}
      {viewerRole !== null && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Team Join Link</p>
          <p className="text-xs text-muted-foreground">Share this link to invite others directly.</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinUrl}
              className="h-9 flex-1 rounded-md border bg-muted px-3 text-xs text-muted-foreground"
            />
            <Button variant="outline" size="sm" onClick={handleCopyJoinLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Join Requests (lead only) */}
      {viewerRole === TEAM_MEMBER_ROLE.LEAD && joinRequests.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Join Requests ({joinRequests.length})</h2>
          </div>
          <ul className="divide-y">
            {joinRequests.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{req.userName}</p>
                  {req.message && (
                    <p className="text-xs text-muted-foreground">{req.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{entryPointLabel(req.entryPoint)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleJoinRequestRespond(req.id, 'accepted')}
                    disabled={isFull}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinRequestRespond(req.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Incoming Team-Up Requests (non-member, registered, unteamed) */}
      {viewerRole === null && isRegistered && !isOnDifferentTeam && teamUpRequests.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Team-Up Requests</h2>
          </div>
          <ul className="divide-y">
            {teamUpRequests.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{req.fromUser.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Proposed team: <span className="font-medium">{req.proposedTeamName}</span>
                  </p>
                  {req.message && (
                    <p className="text-xs text-muted-foreground">{req.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleTeamUpRespond(req.id, 'accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTeamUpRespond(req.id, 'rejected')}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dialogs */}
      <JoinRequestDialog
        teamId={team.id}
        teamName={team.name}
        hackathonId={hackathon.id}
        entryPoint={JOIN_ENTRY_POINT.BROWSE}
        open={joinRequestDialogOpen}
        onOpenChange={setJoinRequestDialogOpen}
        onSuccess={() => {}}
      />
      <EditTeamDialog
        team={team}
        hackathon={hackathon}
        tracks={tracks}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      <InviteByEmailDialog
        hackathonId={hackathon.id}
        teamId={team.id}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
      <TransferLeadDialog
        hackathonId={hackathon.id}
        teamId={team.id}
        currentLeadUserId={viewerUserId}
        members={members}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </div>
  );
}
