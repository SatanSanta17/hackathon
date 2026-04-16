'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Circle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StepTemplate } from './step-template';
import { StepBasicInfo } from './step-basic-info';
import { StepTracks } from './step-tracks';
import { StepTimeline } from './step-timeline';
import { StepTeamRules } from './step-team-rules';
import type {
  Hackathon,
  HackathonWithRelations,
  Phase,
  Track,
  Prize,
  HackathonTemplate,
} from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { number: 1, name: 'Template' },
  { number: 2, name: 'Basic Info' },
  { number: 3, name: 'Tracks' },
  { number: 4, name: 'Timeline' },
  { number: 5, name: 'Team Rules' },
  { number: 6, name: 'Prizes' },
  { number: 7, name: 'Rules & FAQs' },
  { number: 8, name: 'Review & Publish' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardShellProps {
  orgSlug: string;
  orgId: string;
  hackathon?: HackathonWithRelations;
  templates: HackathonTemplate[];
  className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardShell({
  orgSlug,
  orgId,
  hackathon,
  templates,
  className,
}: WizardShellProps) {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const isEditMode = !!hackathon;
  const [currentStep, setCurrentStep] = useState(isEditMode ? 2 : 1);
  const [hackathonId, setHackathonId] = useState<string | null>(
    hackathon?.hackathon.id ?? null,
  );
  const [hackathonData, setHackathonData] = useState<Partial<Hackathon>>(
    hackathon?.hackathon ?? {},
  );
  const [phasesData, setPhasesData] = useState<Phase[]>(hackathon?.phases ?? []);
  const [tracksData, setTracksData] = useState<Track[]>(hackathon?.tracks ?? []);
  const [prizesData, setPrizesData] = useState<Prize[]>(hackathon?.prizes ?? []);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // ---------------------------------------------------------------------------
  // Save status indicator timeout
  // ---------------------------------------------------------------------------

  const showSaveSuccess = useCallback(() => {
    setSaveStatus('saved');
    const timer = setTimeout(() => setSaveStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ---------------------------------------------------------------------------
  // Template selection handler (Step 1)
  // ---------------------------------------------------------------------------

  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      setSaveStatus('saving');

      try {
        const res = await fetch('/api/hackathons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, orgId }),
        });

        const body = await res.json();

        if (!res.ok) {
          setSaveStatus('error');
          toast.error(body.message ?? 'Failed to create hackathon draft.');
          return;
        }

        setHackathonId(body.hackathon.id);
        setHackathonData(body.hackathon);
        showSaveSuccess();
        setCurrentStep(2);
      } catch {
        setSaveStatus('error');
        toast.error('Network error. Please try again.');
      }
    },
    [orgId, showSaveSuccess],
  );

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const handleStepClick = useCallback(
    (stepNumber: number) => {
      // Can only navigate to completed steps or current step
      if (stepNumber > currentStep) return;
      if (stepNumber === currentStep) return;
      // Cannot go to step 1 if already past it (template is locked)
      if (stepNumber === 1 && hackathonId) return;
      setCurrentStep(stepNumber);
    },
    [currentStep, hackathonId],
  );

  const handleNext = useCallback(() => {
    if (currentStep < 8) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      // Don't go back to step 1 if hackathon already created
      const minStep = hackathonId ? 2 : 1;
      setCurrentStep((prev) => Math.max(prev - 1, minStep));
    }
  }, [currentStep, hackathonId]);

  const handleSaveDraft = useCallback(() => {
    toast.success('Draft saved successfully.');
    router.push(`/dashboard/${orgSlug}/hackathons`);
  }, [orgSlug, router]);

  // ---------------------------------------------------------------------------
  // Step completion status
  // ---------------------------------------------------------------------------

  const getStepStatus = useCallback(
    (stepNumber: number): 'completed' | 'current' | 'upcoming' => {
      if (stepNumber < currentStep) return 'completed';
      if (stepNumber === currentStep) return 'current';
      return 'upcoming';
    },
    [currentStep],
  );

  // ---------------------------------------------------------------------------
  // Render step content
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Data update handlers (passed to step components)
  // ---------------------------------------------------------------------------

  const handleHackathonSave = useCallback((data: Partial<Hackathon>) => {
    setHackathonData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleTracksChange = useCallback((newTracks: Track[]) => {
    setTracksData(newTracks);
  }, []);

  const handlePhasesChange = useCallback((newPhases: Phase[]) => {
    setPhasesData(newPhases);
  }, []);

  // ---------------------------------------------------------------------------
  // Render step content
  // ---------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepTemplate
            templates={templates}
            onSelect={handleTemplateSelect}
          />
        );
      case 2:
        return hackathonId ? (
          <StepBasicInfo
            hackathonId={hackathonId}
            orgId={orgId}
            initialData={hackathonData}
            onSave={handleHackathonSave}
            onNext={handleNext}
          />
        ) : null;
      case 3:
        return hackathonId ? (
          <StepTracks
            hackathonId={hackathonId}
            orgId={orgId}
            initialTracks={tracksData}
            onTracksChange={handleTracksChange}
          />
        ) : null;
      case 4:
        return hackathonId ? (
          <StepTimeline
            hackathonId={hackathonId}
            orgId={orgId}
            initialPhases={phasesData}
            onPhasesChange={handlePhasesChange}
            onSave={handleNext}
          />
        ) : null;
      case 5:
        return hackathonId ? (
          <StepTeamRules
            hackathonId={hackathonId}
            orgId={orgId}
            initialData={hackathonData}
            onSave={handleHackathonSave}
            onNext={handleNext}
          />
        ) : null;
      case 6:
      case 7:
      case 8:
        return (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">
              Step {currentStep}: {STEPS[currentStep - 1].name} — coming in Increment 4.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row', className)}>
      {/* Step indicator — sidebar on desktop, horizontal on mobile */}
      <nav className="flex gap-2 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-x-visible">
        {STEPS.map((step) => {
          const status = getStepStatus(step.number);
          const isClickable =
            status === 'completed' && !(step.number === 1 && hackathonId);

          return (
            <button
              key={step.number}
              type="button"
              onClick={() => handleStepClick(step.number)}
              disabled={!isClickable && status !== 'current'}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'whitespace-nowrap lg:whitespace-normal',
                status === 'current' &&
                  'bg-primary text-primary-foreground',
                status === 'completed' &&
                  isClickable &&
                  'cursor-pointer text-foreground hover:bg-accent',
                status === 'completed' &&
                  !isClickable &&
                  'text-muted-foreground',
                status === 'upcoming' &&
                  'cursor-not-allowed text-muted-foreground',
              )}
            >
              {/* Step status icon */}
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                  status === 'current' &&
                    'bg-primary-foreground text-primary',
                  status === 'completed' &&
                    'bg-primary/10 text-primary',
                  status === 'upcoming' &&
                    'border border-muted-foreground/30',
                )}
              >
                {status === 'completed' ? (
                  <Check className="size-3.5" />
                ) : status === 'current' ? (
                  <span className="size-2 rounded-full bg-current" />
                ) : (
                  <Circle className="size-3" />
                )}
              </span>

              {/* Step name */}
              <span className="hidden lg:inline">{step.name}</span>
              <span className="lg:hidden">{step.number}</span>
            </button>
          );
        })}

        {/* Save status indicator */}
        <div className="mt-auto hidden items-center gap-2 px-3 py-2 text-xs lg:flex">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="size-3 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <span className="text-destructive">Save failed</span>
          )}
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Step content */}
        <div className="flex-1">{renderStepContent()}</div>

        {/* Navigation footer — hidden for steps that have their own Save & Continue */}
        {currentStep > 1 && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              {/* Steps 2, 4, 5 have their own Save & Continue — only show Next for 3, 6, 7 */}
              {![2, 4, 5].includes(currentStep) && currentStep < 8 && (
                <Button onClick={handleNext}>Next</Button>
              )}
              {currentStep === 8 && <Button>Publish</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
