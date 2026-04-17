'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { updateTeamSchema, type UpdateTeamInput } from '@/lib/validations/team';
import type { TeamProfileData } from '@/lib/services/team-service';

interface EditTeamDialogProps {
  team: TeamProfileData;
  hackathon: { id: string; requiresApproval: boolean };
  tracks: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeamDialog({
  team,
  hackathon,
  tracks,
  open,
  onOpenChange,
}: EditTeamDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: {
      name: team.name,
      description: team.description ?? '',
      isOpen: team.isOpen,
      trackId: team.trackId ?? undefined,
    },
  });

  const isOpen = watch('isOpen');

  useEffect(() => {
    if (open) {
      reset({
        name: team.name,
        description: team.description ?? '',
        isOpen: team.isOpen,
        trackId: team.trackId ?? undefined,
      });
    }
  }, [open, team, reset]);

  async function onSubmit(values: UpdateTeamInput) {
    setLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathon.id}/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to update team.');
        return;
      }
      if (hackathon.requiresApproval) {
        toast.success('Your changes have been submitted for review.');
      } else {
        toast.success('Team updated.');
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} rows={3} />
          </div>

          {tracks.length > 0 && (
            <div className="space-y-2">
              <Label>Track</Label>
              <Select
                defaultValue={team.trackId ?? 'none'}
                onValueChange={(v) => setValue('trackId', v === 'none' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No track</SelectItem>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Open to new members</p>
              <p className="text-xs text-muted-foreground">Allow others to request to join</p>
            </div>
            <Switch
              checked={isOpen ?? team.isOpen}
              onCheckedChange={(v) => setValue('isOpen', v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
