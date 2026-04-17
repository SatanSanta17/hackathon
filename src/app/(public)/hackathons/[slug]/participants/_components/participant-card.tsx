'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { DiscoverableParticipant } from '@/lib/services/registration-service';
import { TeamUpDialog } from './team-up-dialog';

interface ParticipantCardProps {
  participant: DiscoverableParticipant;
  hackathonId: string;
  hackathonSlug: string;
  viewerIsRegisteredUnteamed: boolean;
  viewerIsLead: boolean;
  viewerTeamId: string | null;
  viewerTeamIsFull: boolean;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ParticipantCard({
  participant,
  hackathonId,
  viewerIsRegisteredUnteamed,
  viewerIsLead,
  viewerTeamId,
  viewerTeamIsFull,
}: ParticipantCardProps) {
  const [teamUpOpen, setTeamUpOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);

  const designation = participant.formData?.designation;
  const department = participant.formData?.department;

  async function handleInvite() {
    if (!viewerTeamId) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/teams/${viewerTeamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: participant.user.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to send invite.');
        return;
      }
      setInvited(true);
      toast.success('Invited!');
    } finally {
      setInviting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {getInitials(participant.user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{participant.user.name}</p>
            {(designation || department) && (
              <p className="truncate text-xs text-muted-foreground">
                {[designation, department].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Joined {new Date(participant.registeredAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>

        {viewerIsRegisteredUnteamed && (
          requested ? (
            <Button size="sm" disabled>Requested</Button>
          ) : (
            <Button size="sm" onClick={() => setTeamUpOpen(true)}>
              Team Up
            </Button>
          )
        )}

        {viewerIsLead && !viewerIsRegisteredUnteamed && (
          invited ? (
            <Button size="sm" disabled>Invited!</Button>
          ) : viewerTeamIsFull ? (
            <Button size="sm" variant="outline" disabled>Team Full</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Inviting…' : 'Invite to Team'}
            </Button>
          )
        )}
      </div>

      <TeamUpDialog
        toUserId={participant.userId}
        toUserName={participant.user.name}
        hackathonId={hackathonId}
        open={teamUpOpen}
        onOpenChange={setTeamUpOpen}
        onSuccess={() => setRequested(true)}
      />
    </>
  );
}
