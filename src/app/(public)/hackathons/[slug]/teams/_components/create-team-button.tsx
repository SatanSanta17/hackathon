'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CreateTeamModal } from './create-team-modal';

interface CreateTeamButtonProps {
  hackathonId: string;
  hackathonSlug: string;
  tracks: { id: string; name: string }[];
}

export function CreateTeamButton({ hackathonId, hackathonSlug, tracks }: CreateTeamButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        Create Team
      </Button>
      <CreateTeamModal
        hackathonId={hackathonId}
        hackathonSlug={hackathonSlug}
        tracks={tracks}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
