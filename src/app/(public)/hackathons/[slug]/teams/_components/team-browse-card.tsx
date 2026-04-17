'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TeamBrowseItem } from '@/lib/services/team-service';
import { JoinRequestDialog } from './join-request-dialog';

interface TeamBrowseCardProps {
  team: TeamBrowseItem;
  hackathonSlug: string;
  hackathonId: string;
  isAuthenticated: boolean;
  isRegistered: boolean;
  hasTeam: boolean;
}

export function TeamBrowseCard({
  team,
  hackathonSlug,
  hackathonId,
  isAuthenticated,
  isRegistered,
  hasTeam,
}: TeamBrowseCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requested, setRequested] = useState(false);

  const isFull = team.maxSize > 0 && team.memberCount >= team.maxSize;

  function renderCta() {
    if (!isAuthenticated) {
      return (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/login?callbackUrl=/hackathons/${hackathonSlug}/teams`}>
            Sign in to Join
          </Link>
        </Button>
      );
    }
    if (!isRegistered) {
      return (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/hackathons/${hackathonSlug}`}>Register to Join</Link>
        </Button>
      );
    }
    if (hasTeam) {
      return (
        <Button size="sm" disabled>
          Already on a Team
        </Button>
      );
    }
    if (isFull) {
      return <Button size="sm" disabled>Team Full</Button>;
    }
    if (!team.isOpen) {
      return <Button size="sm" disabled>Team Closed</Button>;
    }
    if (requested) {
      return <Button size="sm" disabled>Request Sent</Button>;
    }
    return (
      <Button size="sm" onClick={() => setDialogOpen(true)}>
        Request to Join
      </Button>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/hackathons/${hackathonSlug}/teams/${team.id}`}
            className="font-heading font-semibold hover:underline"
          >
            {team.name}
          </Link>
          <div className="flex flex-wrap gap-1">
            {team.trackName && (
              <Badge variant="secondary" className="text-xs">{team.trackName}</Badge>
            )}
            {team.isOpen ? (
              <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 text-xs">Open</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Closed</Badge>
            )}
          </div>
        </div>

        {team.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{team.description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {team.memberCount}{team.maxSize > 0 ? ` / ${team.maxSize}` : ''} member{team.memberCount !== 1 ? 's' : ''}
          </span>
          {renderCta()}
        </div>
      </div>

      <JoinRequestDialog
        teamId={team.id}
        teamName={team.name}
        hackathonId={hackathonId}
        entryPoint="browse"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => setRequested(true)}
      />
    </>
  );
}
