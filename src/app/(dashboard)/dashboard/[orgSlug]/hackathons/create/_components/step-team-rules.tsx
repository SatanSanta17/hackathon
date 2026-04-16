'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Hackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const teamRulesSchema = z
  .object({
    teamMinSize: z.number().int().min(1).max(20),
    teamMaxSize: z.number().int().min(1).max(20),
    allowIndividual: z.boolean(),
    visibility: z.enum(['public', 'org_only', 'invite_only']),
  })
  .refine((data) => data.teamMinSize <= data.teamMaxSize, {
    message: 'Minimum team size cannot exceed maximum team size.',
    path: ['teamMinSize'],
  });

type TeamRulesFormValues = z.infer<typeof teamRulesSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepTeamRulesProps {
  hackathonId: string;
  orgId: string;
  initialData: Partial<Hackathon>;
  onSave: (data: Partial<Hackathon>) => void;
  onNext: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTeamRules({
  hackathonId,
  orgId,
  initialData,
  onSave,
  onNext,
  className,
}: StepTeamRulesProps) {
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamRulesFormValues>({
    resolver: zodResolver(teamRulesSchema),
    defaultValues: {
      teamMinSize: initialData.teamMinSize ?? 1,
      teamMaxSize: initialData.teamMaxSize ?? 5,
      allowIndividual: initialData.allowIndividual ?? true,
      visibility: (initialData.visibility as TeamRulesFormValues['visibility']) ?? 'public',
    },
  });

  const visibilityValue = watch('visibility');
  const allowIndividualValue = watch('allowIndividual');

  const onSubmit = async (data: TeamRulesFormValues) => {
    setIsSaving(true);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          teamMinSize: data.teamMinSize,
          teamMaxSize: data.teamMaxSize,
          allowIndividual: data.allowIndividual,
          visibility: data.visibility,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.message ?? 'Failed to save team rules.');
        return;
      }

      onSave(body.hackathon);
      onNext();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Team Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure team size limits, individual participation, and visibility.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Team size */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="teamMinSize">Minimum Team Size</Label>
            <Input
              id="teamMinSize"
              type="number"
              min={1}
              max={20}
              {...register('teamMinSize', { valueAsNumber: true })}
            />
            {errors.teamMinSize && (
              <p className="text-sm text-destructive">{errors.teamMinSize.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamMaxSize">Maximum Team Size</Label>
            <Input
              id="teamMaxSize"
              type="number"
              min={1}
              max={20}
              {...register('teamMaxSize', { valueAsNumber: true })}
            />
            {errors.teamMaxSize && (
              <p className="text-sm text-destructive">{errors.teamMaxSize.message}</p>
            )}
          </div>
        </div>

        {/* Allow individual */}
        <div className="flex items-center gap-3">
          <input
            id="allowIndividual"
            type="checkbox"
            checked={allowIndividualValue}
            onChange={(e) => setValue('allowIndividual', e.target.checked)}
            className="size-4 rounded border-input text-primary focus:ring-primary"
          />
          <Label htmlFor="allowIndividual" className="cursor-pointer">
            Allow individual participation (teams of 1)
          </Label>
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select
            value={visibilityValue}
            onValueChange={(val) =>
              setValue('visibility', val as TeamRulesFormValues['visibility'])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="org_only" disabled>
                <span className="flex items-center gap-2">
                  Organization Only
                  <Badge variant="secondary" className="text-xs">
                    Coming soon
                  </Badge>
                </span>
              </SelectItem>
              <SelectItem value="invite_only" disabled>
                <span className="flex items-center gap-2">
                  Invite Only
                  <Badge variant="secondary" className="text-xs">
                    Coming soon
                  </Badge>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Public hackathons are visible to everyone. More options coming soon.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </Button>
        </div>
      </form>
    </div>
  );
}
