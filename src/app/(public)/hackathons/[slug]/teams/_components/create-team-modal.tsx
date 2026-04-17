'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { createTeamSchema, type CreateTeamInput } from '@/lib/validations/team';

interface CreateTeamModalProps {
  hackathonId: string;
  hackathonSlug: string;
  tracks: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamModal({
  hackathonId,
  hackathonSlug,
  tracks,
  open,
  onOpenChange,
}: CreateTeamModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { isOpen: true, trackId: tracks[0]?.id },
  });

  const isOpen = watch('isOpen');

  async function onSubmit(values: CreateTeamInput) {
    setLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to create team.');
        return;
      }
      reset();
      onOpenChange(false);
      router.push(`/hackathons/${hackathonSlug}/teams/${data.team.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name *</Label>
            <Input id="name" {...register('name')} placeholder="My Awesome Team" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="What will your team build?"
              rows={3}
            />
          </div>

          {tracks.length > 0 && (
            <div className="space-y-2">
              <Label>Track *</Label>
              <Select
                defaultValue={tracks[0]?.id}
                onValueChange={(v) => setValue('trackId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a track" />
                </SelectTrigger>
                <SelectContent>
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
              checked={isOpen}
              onCheckedChange={(v) => setValue('isOpen', v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Team'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
