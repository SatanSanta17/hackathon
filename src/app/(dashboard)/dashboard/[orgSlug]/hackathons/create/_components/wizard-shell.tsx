'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Circle, CircleDot, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { StepTemplate } from './step-template';
import { StepBasicInfo } from './step-basic-info';
import { StepTracks } from './step-tracks';
import { StepTimeline } from './step-timeline';
import { StepTeamRules } from './step-team-rules';
import { StepParticipation } from './step-participation';
import { StepPrizes } from './step-prizes';
import { StepRulesFaqs } from './step-rules-faqs';
import { StepReview } from './step-review';
import type {
  Hackathon,
  HackathonWithRelations,
  Phase,
  Track,
  Prize,
  HackathonTemplate,
} from '@/lib/services/hackathon-service';
import type { RegistrationFieldInput } from '@/lib/validations/registration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { number: 1, name: 'Template' },
  { number: 2, name: 'Basic Info' },
  { number: 3, name: 'Tracks' },
  { number: 4, name: 'Timeline' },
  { number: 5, name: 'Team Rules' },
  { number: 6, name: 'Participation' },
  { number: 7, name: 'Prizes' },
  { number: 8, name: 'Rules & FAQs' },
  { number: 9, name: 'Review & Publish' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardShellProps {
  orgSlug: string;
  orgId: string;
  hackathon?: HackathonWithRelations;
  existingDraft?: HackathonWithRelations;
  templates: HackathonTemplate[];
  className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the furthest step the user has completed based on populated data.
 * Used when resuming a draft to navigate the user to where they left off.
 */
function getFurthestStep(data: HackathonWithRelations): number {
  const { hackathon: h, phases, tracks, prizes } = data;
  if (h.rulesHtml || h.faqsHtml) return 9;
  if (prizes.length > 0) return 8;
  if (h.requiresApproval) return 7;
  if (h.teamMinSize !== 1 || h.teamMaxSize !== 5) return 6;
  const allPhaseDates = phases.every((p) => p.startDate && p.endDate);
  if (allPhaseDates && phases.length > 0) return 5;
  if (tracks.length > 0) return 4;
  if (h.title && h.title !== 'Untitled Hackathon') return 3;
  return 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardShell({
  orgSlug,
  orgId,
  hackathon,
  existingDraft,
  templates,
  className,
}: WizardShellProps) {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const isEditMode = !!hackathon;
  const [currentStep, setCurrentStepRaw] = useState(isEditMode ? 2 : 1);
  const [highestStepReached, setHighestStepReached] = useState(isEditMode ? 9 : 1);
  const [hackathonId, setHackathonId] = useState<string | null>(
    hackathon?.hackathon.id ?? null,
  );
  const [hackathonData, setHackathonData] = useState<Partial<Hackathon>>(
    hackathon?.hackathon ?? {},
  );
  const [phasesData, setPhasesData] = useState<Phase[]>(hackathon?.phases ?? []);
  const [tracksData, setTracksData] = useState<Track[]>(hackathon?.tracks ?? []);
  const [prizesData, setPrizesData] = useState<Prize[]>(hackathon?.prizes ?? []);
  const [registrationFieldsData, setRegistrationFieldsData] = useState<RegistrationFieldInput[]>(
    (hackathon?.registrationFields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      fieldType: f.fieldType as RegistrationFieldInput['fieldType'],
      options: f.options,
      required: f.required,
      order: f.order,
    })),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Track which optional steps (5, 6, 7) the user has explicitly visited & saved.
  // In edit mode or when resuming a draft, mark them visited based on data.
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (hackathon) {
      // Edit mode — all steps considered visited
      for (let i = 1; i <= 9; i++) initial.add(i);
    }
    return initial;
  });

  // Resume-draft dialog state — show on mount if there's an existing draft and we're NOT in edit mode
  const [showResumeDialog, setShowResumeDialog] = useState(
    !!existingDraft && !isEditMode,
  );

  // Wrapper that also ratchets highestStepReached and marks the departing step as visited
  const setCurrentStep = useCallback((stepOrUpdater: number | ((prev: number) => number)) => {
    setCurrentStepRaw((prev) => {
      const next = typeof stepOrUpdater === 'function' ? stepOrUpdater(prev) : stepOrUpdater;
      // Mark the step we're leaving as visited
      setVisitedSteps((vs) => {
        const copy = new Set(vs);
        copy.add(prev);
        return copy;
      });
      setHighestStepReached((h) => Math.max(h, next));
      return next;
    });
  }, []);

  // Resume the existing draft — load its data into wizard state
  const handleResumeDraft = useCallback(() => {
    if (!existingDraft) return;

    const furthestStep = getFurthestStep(existingDraft);

    setHackathonId(existingDraft.hackathon.id);
    setHackathonData(existingDraft.hackathon);
    setPhasesData(existingDraft.phases);
    setTracksData(existingDraft.tracks);
    setPrizesData(existingDraft.prizes);
    setHighestStepReached(furthestStep);
    setCurrentStepRaw(furthestStep);
    // Mark all steps up to furthestStep as visited
    setVisitedSteps((vs) => {
      const copy = new Set(vs);
      for (let i = 1; i < furthestStep; i++) copy.add(i);
      return copy;
    });
    setShowResumeDialog(false);

    toast.success(`Resumed draft: ${existingDraft.hackathon.title || 'Untitled Hackathon'}`);
  }, [existingDraft]);

  // Start fresh — dismiss the dialog, stay on Step 1
  const handleStartFresh = useCallback(() => {
    setShowResumeDialog(false);
  }, []);

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
        setPhasesData(body.phases ?? []);
        showSaveSuccess();
        setCurrentStep(2);
      } catch {
        setSaveStatus('error');
        toast.error('Network error. Please try again.');
      }
    },
    [orgId, showSaveSuccess, setCurrentStep],
  );

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const handleStepClick = useCallback(
    (stepNumber: number) => {
      if (stepNumber === currentStep) return;
      // Can only navigate up to the highest step previously reached
      if (stepNumber > highestStepReached) return;
      // Step 1 is always viewable (read-only once draft exists)
      setCurrentStep(stepNumber);
    },
    [currentStep, highestStepReached, setCurrentStep],
  );

  const handleNext = useCallback(() => {
    if (currentStep < 9) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, setCurrentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, setCurrentStep]);

  const hackathonStatus = hackathon?.hackathon.status ?? 'draft';
  const isDraft = hackathonStatus === 'draft';

  const handleSaveDraft = useCallback(() => {
    if (isDraft) toast.success('Draft saved successfully.');
    router.push(`/dashboard/${orgSlug}/hackathons`);
  }, [isDraft, orgSlug, router]);

  // ---------------------------------------------------------------------------
  // Data-driven step completion status
  // ---------------------------------------------------------------------------

  /**
   * Three-state system:
   * - 'complete'    → Data requirements met (green check)
   * - 'incomplete'  → Visited but data requirements not yet met (amber dot)
   * - 'not_started' → Not yet visited
   * - 'current'     → Currently active step
   *
   * Steps 5, 6, 7 are optional — they're "complete" once visited & saved
   * (even with defaults/empty), since those fields are genuinely optional.
   */
  type StepDataStatus = 'complete' | 'incomplete' | 'not_started' | 'current';

  const getStepStatus = useCallback(
    (stepNumber: number): StepDataStatus => {
      if (stepNumber === currentStep) return 'current';

      // Step-specific data checks
      switch (stepNumber) {
        case 1:
          // Complete if a hackathon draft was created (template selected)
          return hackathonId ? 'complete' : 'not_started';

        case 2:
          // Complete if title is set and not the default
          if (!hackathonId) return 'not_started';
          if (hackathonData.title && hackathonData.title !== 'Untitled Hackathon') return 'complete';
          return visitedSteps.has(2) ? 'incomplete' : 'not_started';

        case 3:
          // Complete if at least 1 track exists
          if (!hackathonId) return 'not_started';
          if (tracksData.length > 0) return 'complete';
          return visitedSteps.has(3) ? 'incomplete' : 'not_started';

        case 4:
          // Complete if all phases have both start and end dates
          if (!hackathonId) return 'not_started';
          if (phasesData.length > 0 && phasesData.every((p) => p.startDate && p.endDate)) return 'complete';
          return visitedSteps.has(4) ? 'incomplete' : 'not_started';

        case 5:
          // Optional — complete once visited (has valid defaults)
          if (!hackathonId) return 'not_started';
          return visitedSteps.has(5) ? 'complete' : 'not_started';

        case 6:
          // Optional — complete once visited (empty fields + approval off is valid)
          if (!hackathonId) return 'not_started';
          return visitedSteps.has(6) ? 'complete' : 'not_started';

        case 7:
          // Optional — complete once visited (zero prizes is valid)
          if (!hackathonId) return 'not_started';
          return visitedSteps.has(7) ? 'complete' : 'not_started';

        case 8:
          // Optional — complete once visited (empty rules/FAQs is valid)
          if (!hackathonId) return 'not_started';
          return visitedSteps.has(8) ? 'complete' : 'not_started';

        case 9:
          // Review step — never "complete" (it's the publish action)
          return 'not_started';

        default:
          return 'not_started';
      }
    },
    [currentStep, hackathonId, hackathonData, tracksData, phasesData, visitedSteps],
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

  const handlePrizesChange = useCallback((newPrizes: Prize[]) => {
    setPrizesData(newPrizes);
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
            lockedTemplateType={hackathonId ? (hackathonData.templateType ?? null) : null}
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
        return hackathonId ? (
          <StepParticipation
            hackathonId={hackathonId}
            orgId={orgId}
            initialRequiresApproval={hackathonData.requiresApproval ?? false}
            initialFields={registrationFieldsData}
            onSave={(data) => {
              setHackathonData((prev) => ({ ...prev, requiresApproval: data.requiresApproval }));
              setRegistrationFieldsData(data.fields);
            }}
            onNext={handleNext}
          />
        ) : null;
      case 7:
        return hackathonId ? (
          <StepPrizes
            hackathonId={hackathonId}
            orgId={orgId}
            initialPrizes={prizesData}
            onPrizesChange={handlePrizesChange}
          />
        ) : null;
      case 8:
        return hackathonId ? (
          <StepRulesFaqs
            hackathonId={hackathonId}
            orgId={orgId}
            initialData={hackathonData}
            onSave={handleHackathonSave}
            onNext={handleNext}
          />
        ) : null;
      case 9:
        return hackathonId ? (
          <StepReview
            hackathonId={hackathonId}
            orgId={orgId}
            orgSlug={orgSlug}
            hackathonData={hackathonData}
            phasesData={phasesData}
            tracksData={tracksData}
            prizesData={prizesData}
            templates={templates}
            onNavigateToStep={setCurrentStep}
            hackathonStatus={hackathonStatus}
          />
        ) : null;
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
          // A step is clickable if it's within the highest reached and not active
          const isReachable = step.number <= highestStepReached;
          const isClickable = isReachable && status !== 'current';
          const isDisabled = !isClickable && status !== 'current';

          return (
            <button
              key={step.number}
              type="button"
              onClick={() => handleStepClick(step.number)}
              disabled={isDisabled}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'whitespace-nowrap lg:whitespace-normal',
                status === 'current' &&
                  'bg-primary text-primary-foreground',
                status === 'complete' &&
                  isClickable &&
                  'cursor-pointer text-foreground hover:bg-accent',
                status === 'complete' &&
                  !isClickable &&
                  'text-muted-foreground',
                status === 'incomplete' &&
                  isClickable &&
                  'cursor-pointer text-foreground hover:bg-accent',
                status === 'incomplete' &&
                  !isClickable &&
                  'text-muted-foreground',
                status === 'not_started' &&
                  isClickable &&
                  'cursor-pointer text-foreground/70 hover:bg-accent hover:text-foreground',
                status === 'not_started' &&
                  !isClickable &&
                  'cursor-not-allowed text-muted-foreground',
              )}
            >
              {/* Step status icon */}
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                  status === 'current' &&
                    'bg-primary-foreground text-primary',
                  status === 'complete' &&
                    'bg-green-500/15 text-green-600',
                  status === 'incomplete' &&
                    'bg-amber-500/15 text-amber-600',
                  status === 'not_started' && isClickable &&
                    'border border-foreground/30',
                  status === 'not_started' && !isClickable &&
                    'border border-muted-foreground/30',
                )}
              >
                {status === 'complete' ? (
                  <Check className="size-3.5" />
                ) : status === 'incomplete' ? (
                  <CircleDot className="size-3.5" />
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

        {/* Navigation footer — hidden on Step 9 (Review has its own actions) */}
        {currentStep !== 9 && (currentStep > 1 || (currentStep === 1 && hackathonId)) && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleSaveDraft}>
                {isDraft ? 'Save Draft' : 'Exit'}
              </Button>
              {/* Steps 2, 4, 5, 6, 8 have their own Save & Continue — hide Next for those and step 9 */}
              {![2, 4, 5, 6, 8, 9].includes(currentStep) && currentStep < 9 && (
                <Button onClick={handleNext}>Next</Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resume draft dialog */}
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resume your draft?</DialogTitle>
            <DialogDescription>
              You have an unfinished draft:{' '}
              <span className="font-medium text-foreground">
                {existingDraft?.hackathon.title || 'Untitled Hackathon'}
              </span>
              . Would you like to continue where you left off or start a new hackathon from scratch?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleStartFresh}>
              Start Fresh
            </Button>
            <Button onClick={handleResumeDraft}>Resume Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
