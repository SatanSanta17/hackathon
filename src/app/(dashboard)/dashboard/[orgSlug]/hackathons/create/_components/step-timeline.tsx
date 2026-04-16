'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Phase } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepTimelineProps {
  hackathonId: string;
  orgId: string;
  initialPhases: Phase[];
  onPhasesChange: (phases: Phase[]) => void;
  onSave: () => void;
  className?: string;
}

interface PhaseFormState {
  name: string;
  startDate: string;
  endDate: string;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date to datetime-local input value (YYYY-MM-DDTHH:MM) */
function toDatetimeLocal(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  // Adjust to local timezone for the input
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/** Phase type to display badge color */
const PHASE_TYPE_COLORS: Record<string, string> = {
  registration: 'bg-blue-100 text-blue-700',
  submission: 'bg-purple-100 text-purple-700',
  screening: 'bg-amber-100 text-amber-700',
  judging: 'bg-orange-100 text-orange-700',
  results: 'bg-green-100 text-green-700',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTimeline({
  hackathonId,
  orgId,
  initialPhases,
  onPhasesChange,
  onSave,
  className,
}: StepTimelineProps) {
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [formStates, setFormStates] = useState<Record<string, PhaseFormState>>(() => {
    const initial: Record<string, PhaseFormState> = {};
    for (const phase of initialPhases) {
      initial[phase.id] = {
        name: phase.name,
        startDate: toDatetimeLocal(phase.startDate),
        endDate: toDatetimeLocal(phase.endDate),
        isDirty: false,
      };
    }
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Form change handlers
  // ---------------------------------------------------------------------------

  const updateFormState = useCallback(
    (phaseId: string, field: keyof PhaseFormState, value: string) => {
      setFormStates((prev) => ({
        ...prev,
        [phaseId]: { ...prev[phaseId], [field]: value, isDirty: true },
      }));
      // Clear validation error for this phase
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[phaseId];
        return next;
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Cross-phase chronological warning
  // ---------------------------------------------------------------------------

  const getChronologicalWarnings = useCallback(() => {
    const warnings: Record<string, string> = {};
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

    for (let i = 1; i < sortedPhases.length; i++) {
      const prev = formStates[sortedPhases[i - 1].id];
      const curr = formStates[sortedPhases[i].id];

      if (prev?.startDate && curr?.startDate) {
        if (new Date(curr.startDate) < new Date(prev.startDate)) {
          warnings[sortedPhases[i].id] =
            `This phase starts before "${sortedPhases[i - 1].name}". Consider adjusting dates.`;
        }
      }
    }
    return warnings;
  }, [phases, formStates]);

  const chronoWarnings = getChronologicalWarnings();

  // ---------------------------------------------------------------------------
  // Save all dirty phases
  // ---------------------------------------------------------------------------

  const handleSaveAll = async () => {
    // Validate: endDate > startDate for each phase with both dates set
    const errors: Record<string, string> = {};
    for (const phase of phases) {
      const state = formStates[phase.id];
      if (state?.startDate && state?.endDate) {
        if (new Date(state.endDate) <= new Date(state.startDate)) {
          errors[phase.id] = 'End date must be after start date.';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Please fix date errors before continuing.');
      return;
    }

    setIsSaving(true);

    try {
      // Save only dirty phases
      const dirtyPhases = phases.filter((p) => formStates[p.id]?.isDirty);

      const promises = dirtyPhases.map(async (phase) => {
        const state = formStates[phase.id];
        const res = await fetch(
          `/api/hackathons/${hackathonId}/phases/${phase.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orgId,
              name: state.name,
              startDate: state.startDate ? new Date(state.startDate).toISOString() : null,
              endDate: state.endDate ? new Date(state.endDate).toISOString() : null,
            }),
          },
        );

        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message ?? `Failed to save phase "${phase.name}"`);
        }
        return body.phase as Phase;
      });

      const updatedPhases = await Promise.all(promises);

      // Merge updated phases back
      const merged = phases.map((p) => {
        const updated = updatedPhases.find((u) => u.id === p.id);
        return updated ?? p;
      });

      setPhases(merged);
      onPhasesChange(merged);

      // Mark all as clean
      setFormStates((prev) => {
        const next = { ...prev };
        for (const phase of dirtyPhases) {
          if (next[phase.id]) {
            next[phase.id] = { ...next[phase.id], isDirty: false };
          }
        }
        return next;
      });

      if (dirtyPhases.length > 0) {
        toast.success('Timeline saved.');
      }

      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save timeline.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Set start and end dates for each phase. Phase types and order are defined by
          your template and cannot be changed.
        </p>
      </div>

      <div className="space-y-4">
        {sortedPhases.map((phase, index) => {
          const state = formStates[phase.id];
          const error = validationErrors[phase.id];
          const warning = chronoWarnings[phase.id];

          return (
            <div
              key={phase.id}
              className={cn(
                'rounded-lg border p-4 space-y-3',
                error && 'border-destructive',
                warning && !error && 'border-amber-400',
              )}
            >
              {/* Phase header */}
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {index + 1}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs capitalize',
                    PHASE_TYPE_COLORS[phase.type] ?? '',
                  )}
                >
                  {phase.type}
                </Badge>
              </div>

              {/* Phase name (editable) */}
              <div className="space-y-1">
                <Label htmlFor={`phase-name-${phase.id}`} className="text-xs text-muted-foreground">
                  Phase Name
                </Label>
                <Input
                  id={`phase-name-${phase.id}`}
                  value={state?.name ?? phase.name}
                  onChange={(e) => updateFormState(phase.id, 'name', e.target.value)}
                  className="font-medium"
                />
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label
                    htmlFor={`phase-start-${phase.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Start Date
                  </Label>
                  <Input
                    id={`phase-start-${phase.id}`}
                    type="datetime-local"
                    value={state?.startDate ?? ''}
                    onChange={(e) =>
                      updateFormState(phase.id, 'startDate', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`phase-end-${phase.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    End Date
                  </Label>
                  <Input
                    id={`phase-end-${phase.id}`}
                    type="datetime-local"
                    value={state?.endDate ?? ''}
                    onChange={(e) =>
                      updateFormState(phase.id, 'endDate', e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Validation error */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Chronological warning */}
              {warning && !error && (
                <div className="flex items-start gap-2 text-sm text-amber-600">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {phases.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No phases found. This template may not have default phases.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}
