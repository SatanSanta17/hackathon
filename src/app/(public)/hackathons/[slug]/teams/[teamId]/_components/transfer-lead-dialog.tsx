'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { TeamMemberDetail } from '@/lib/services/team-service';

interface TransferLeadDialogProps {
  hackathonId: string;
  teamId: string;
  currentLeadUserId: string;
  members: TeamMemberDetail[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferLeadDialog({
  hackathonId,
  teamId,
  currentLeadUserId,
  members,
  open,
  onOpenChange,
}: TransferLeadDialogProps) {
  const router = useRouter();
  const [toUserId, setToUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const eligibleMembers = members.filter((m) => m.userId !== currentLeadUserId);

  async function handleConfirm() {
    if (!toUserId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/teams/${teamId}/transfer-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to transfer leadership.');
        return;
      }
      toast.success('Leadership transferred.');
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Leadership</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the member to become the new team lead. You will become a regular member.
          </p>
          <div className="space-y-2">
            <Label>New Lead</Label>
            <Select onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!toUserId || loading}>
              {loading ? 'Transferring…' : 'Confirm Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
