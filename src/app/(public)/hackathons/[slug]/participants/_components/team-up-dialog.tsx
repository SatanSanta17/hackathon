'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TeamUpDialogProps {
  toUserId: string;
  toUserName: string;
  hackathonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TeamUpDialog({
  toUserId,
  toUserName,
  hackathonId,
  open,
  onOpenChange,
  onSuccess,
}: TeamUpDialogProps) {
  const [proposedTeamName, setProposedTeamName] = useState('My Team');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!proposedTeamName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/team-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          proposedTeamName: proposedTeamName.trim(),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to send request.');
        return;
      }
      toast.success(`${toUserName} has been sent a Team Up request!`);
      onSuccess();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team Up with {toUserName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Proposed Team Name *</Label>
            <Input
              id="team-name"
              value={proposedTeamName}
              onChange={(e) => setProposedTeamName(e.target.value)}
              placeholder="My Team"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them why you'd like to team up…"
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !proposedTeamName.trim()}>
              {loading ? 'Sending…' : 'Send Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
