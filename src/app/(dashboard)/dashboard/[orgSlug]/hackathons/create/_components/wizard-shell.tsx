'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Circle, Loader2 } from 'lucide-react';

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
  if (h.rulesHtml || h.faqsHtml) return 8;
  if (prizes.length > 0) return 7;
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
  const [highestStepReached, setHighestStepReached] = useState(isEditMode ? 8 : 1);
  const [hackathonId, setHackathonId] = useState<string | null>(
    hackathon?.hackathon.id ?? null,
  );

  // Resume-draft dialog state
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // Show resume dialog on mount if there's an existing draft and we're NOT in edit mode
  useEffect(() => {
    if (existingDraft && !isEditMode) {
      setShowResumeDialog(true);
    }
  }, [existingDraft, isEditMode]);

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
    setShowResumeDialog(false);

    toast.success(`Resumed draft: ${existingDraft.hackathon.title || 'Untitled Hackathon'}`);
  }, [existingDraft]);

  // Start fresh — dismiss the dialog, stay on Step 1
  const handleStartFresh = useCallback(() => {
    setShowResumeDialog(false);
  }, []);

  // Wrapper that also ratchets highestStepReached
  const setCurrentStep = useCallback((stepOrUpdater: number | ((prev: number) => number)) => {
    setCurrentStepRaw((prev) => {
      const next = typeof stepOrUpdater === 'function' ? stepOrUpdater(prev) : stepOrUpdater;
      setHighestStepReached((h) => Math.max(h, next));
      return next;
    });
  }, []);
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
      if (stepNumber === currentStep) return;
      // Can only navigate up to the highest step previously reached
      if (stepNumber > highestStepReached) return;
      // Step 1 is always viewable (read-only once draft exists)
      setCurrentStep(stepNumber);
    },
    [currentStep, highestStepReached, setCurrentStep],
  );

  const handleNext = useCallback(() => {
    if (currentStep < 8) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, setCurrentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, setCurrentStep]);

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
          <StepPrizes
            hackathonId={hackathonId}
            orgId={orgId}
            initialPrizes={prizesData}
            onPrizesChange={handlePrizesChange}
          />
        ) : null;
      case 7:
        return hackathonId ? (
          <StepRulesFaqs
            hackathonId={hackathonId}
            orgId={orgId}
            initialData={hackathonData}
            onSave={handleHackathonSave}
            onNext={handleNext}
          />
        ) : null;
      case 8:
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
          // A step is clickable if it's within the highest reached
          const isReachable = step.number <= highestStepReached;
          const isClickable = isReachable && step.number !== currentStep;
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
                status === 'completed' &&
                  isClickable &&
                  'cursor-pointer text-foreground hover:bg-accent',
                status === 'completed' &&
                  !isClickable &&
                  'text-muted-foreground',
                status === 'upcoming' &&
                  isClickable &&
                  'cursor-pointer text-foreground/70 hover:bg-accent hover:text-foreground',
                status === 'upcoming' &&
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
                  status === 'completed' &&
                    'bg-primary/10 text-primary',
                  status === 'upcoming' && isClickable &&
                    'border border-foreground/30',
                  status === 'upcoming' && !isClickable &&
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

        {/* Navigation footer — shown on Step 1 only when locked (view-only), always on Steps 2+ */}
        {(currentStep > 1 || (currentStep === 1 && hackathonId)) && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              {/* Steps 2, 4, 5, 7 have their own Save & Continue — hide Next for those and step 8 */}
              {![2, 4, 5, 7, 8].includes(currentStep) && currentStep < 8 && (
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
