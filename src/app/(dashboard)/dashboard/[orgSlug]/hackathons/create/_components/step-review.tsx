'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Pencil,
  AlertCircle,
  Lightbulb,
  Rocket,
  Layers,
  Globe,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  Hackathon,
  Phase,
  Track,
  Prize,
  HackathonTemplate,
} from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Publish error code → user-friendly message
// ---------------------------------------------------------------------------

const PUBLISH_ERROR_MESSAGES: Record<string, string> = {
  TITLE_REQUIRED: 'A title is required before publishing.',
  AT_LEAST_ONE_TRACK_REQUIRED: 'Add at least one track before publishing.',
  ALL_PHASE_DATES_REQUIRED: 'All phases need start and end dates before publishing.',
  HACKATHON_NOT_FOUND: 'Hackathon not found.',
  ONLY_DRAFTS_CAN_BE_PUBLISHED: 'Only draft hackathons can be published.',
};

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  rocket: Rocket,
  layers: Layers,
  globe: Globe,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepReviewProps {
  hackathonId: string;
  orgId: string;
  orgSlug: string;
  hackathonData: Partial<Hackathon>;
  phasesData: Phase[];
  tracksData: Track[];
  prizesData: Prize[];
  templates: HackathonTemplate[];
  onNavigateToStep: (step: number) => void;
  className?: string;
}

interface ValidationIssue {
  section: string;
  message: string;
  step: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepReview({
  hackathonId,
  orgId,
  orgSlug,
  hackathonData,
  phasesData,
  tracksData,
  prizesData,
  templates,
  onNavigateToStep,
  className,
}: StepReviewProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  // ---------------------------------------------------------------------------
  // Client-side pre-check validation
  // ---------------------------------------------------------------------------

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = [];

    if (!hackathonData.title || hackathonData.title === 'Untitled Hackathon') {
      issues.push({ section: 'basic-info', message: 'Title is required.', step: 2 });
    }

    if (tracksData.length === 0) {
      issues.push({ section: 'tracks', message: 'At least one track is required.', step: 3 });
    }

    const phasesWithoutDates = phasesData.filter((p) => !p.startDate || !p.endDate);
    if (phasesWithoutDates.length > 0) {
      issues.push({
        section: 'timeline',
        message: `${phasesWithoutDates.length} phase(s) missing dates.`,
        step: 4,
      });
    }

    return issues;
  }, [hackathonData, tracksData, phasesData]);

  const canPublish = validationIssues.length === 0;

  const hasIssue = (section: string) => validationIssues.some((i) => i.section === section);

  // ---------------------------------------------------------------------------
  // Publish handler
  // ---------------------------------------------------------------------------

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsPublishing(true);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      const body = await res.json();

      if (!res.ok) {
        const userMessage = PUBLISH_ERROR_MESSAGES[body.message] ?? body.message ?? 'Failed to publish.';
        toast.error(userMessage);
        return;
      }

      toast.success('Hackathon published!');
      router.push(`/hackathons/${body.slug}`);
    } catch (err: unknown) {
      console.error('Publish hackathon error:', err);
      toast.error(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = () => {
    toast.success('Draft saved successfully.');
    router.push(`/dashboard/${orgSlug}/hackathons`);
  };

  // ---------------------------------------------------------------------------
  // Template info
  // ---------------------------------------------------------------------------

  const selectedTemplate = templates.find(
    (t) => t.templateType === hackathonData.templateType,
  );
  const TemplateIcon = selectedTemplate
    ? (TEMPLATE_ICONS[selectedTemplate.icon ?? ''] ?? Lightbulb)
    : Lightbulb;

  // ---------------------------------------------------------------------------
  // Date formatter
  // ---------------------------------------------------------------------------

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Review & Publish</h2>
        <p className="text-sm text-muted-foreground">
          Review all your hackathon details before publishing.
        </p>
      </div>

      {/* Validation issues banner */}
      {validationIssues.length > 0 && (
        <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Please fix the following before publishing:
          </p>
          {validationIssues.map((issue) => (
            <div key={issue.section} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                {issue.message}
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-destructive"
                onClick={() => onNavigateToStep(issue.step)}
              >
                Fix
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Review sections */}
      <div className="space-y-4">
        {/* Template */}
        <ReviewSection title="Template" onEdit={() => onNavigateToStep(1)}>
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <TemplateIcon className="size-4 text-muted-foreground" />
            </div>
            <span>{selectedTemplate?.name ?? hackathonData.templateType ?? 'Unknown'}</span>
          </div>
        </ReviewSection>

        {/* Basic Info */}
        <ReviewSection
          title="Basic Info"
          onEdit={() => onNavigateToStep(2)}
          hasError={hasIssue('basic-info')}
        >
          <div className="space-y-1">
            <p>
              <span className="text-muted-foreground">Title:</span>{' '}
              {hackathonData.title || <span className="italic text-muted-foreground">Not set</span>}
            </p>
            <p>
              <span className="text-muted-foreground">Slug:</span>{' '}
              <span className="font-mono text-xs">/hackathons/{hackathonData.slug || '...'}</span>
            </p>
            {hackathonData.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {hackathonData.description}
              </p>
            )}
            {hackathonData.coverImageKey && (
              <Badge variant="secondary" className="text-xs">Cover image set</Badge>
            )}
          </div>
        </ReviewSection>

        {/* Tracks */}
        <ReviewSection
          title="Tracks"
          onEdit={() => onNavigateToStep(3)}
          hasError={hasIssue('tracks')}
        >
          {tracksData.length > 0 ? (
            <ul className="space-y-1">
              {tracksData.map((track) => (
                <li key={track.id} className="text-sm">
                  {track.name}
                  {track.description && (
                    <span className="text-muted-foreground"> — {track.description}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">No tracks added.</p>
          )}
        </ReviewSection>

        {/* Timeline */}
        <ReviewSection
          title="Timeline"
          onEdit={() => onNavigateToStep(4)}
          hasError={hasIssue('timeline')}
        >
          {phasesData.length > 0 ? (
            <ul className="space-y-1">
              {[...phasesData]
                .sort((a, b) => a.order - b.order)
                .map((phase) => (
                  <li key={phase.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {phase.type}
                    </Badge>
                    <span>{phase.name}</span>
                    <span className="text-muted-foreground">
                      {formatDate(phase.startDate)} — {formatDate(phase.endDate)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">No phases.</p>
          )}
        </ReviewSection>

        {/* Team Rules */}
        <ReviewSection title="Team Rules" onEdit={() => onNavigateToStep(5)}>
          <div className="space-y-1 text-sm">
            <p>
              Team size: {hackathonData.teamMinSize ?? 1} – {hackathonData.teamMaxSize ?? 5}
            </p>
            <p>
              Individual participation: {hackathonData.allowIndividual !== false ? 'Allowed' : 'Not allowed'}
            </p>
            <p>
              Visibility: <span className="capitalize">{hackathonData.visibility ?? 'public'}</span>
            </p>
          </div>
        </ReviewSection>

        {/* Prizes */}
        <ReviewSection title="Prizes" onEdit={() => onNavigateToStep(7)}>
          {prizesData.length > 0 ? (
            <ul className="space-y-1">
              {prizesData.map((prize) => (
                <li key={prize.id} className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs">
                    {prize.rank}
                  </span>
                  <span>{prize.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">No prizes added.</p>
          )}
        </ReviewSection>

        {/* Rules & FAQs */}
        <ReviewSection title="Rules & FAQs" onEdit={() => onNavigateToStep(8)}>
          <div className="space-y-2 text-sm">
            <p>
              Rules:{' '}
              {hackathonData.rulesHtml ? (
                <Badge variant="secondary" className="text-xs">Content set</Badge>
              ) : (
                <span className="italic text-muted-foreground">Not set</span>
              )}
            </p>
            <p>
              FAQs:{' '}
              {hackathonData.faqsHtml ? (
                <Badge variant="secondary" className="text-xs">Content set</Badge>
              ) : (
                <span className="italic text-muted-foreground">Not set</span>
              )}
            </p>
          </div>
        </ReviewSection>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={handleSaveDraft}>
          Save as Draft
        </Button>
        <Button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
        >
          {isPublishing ? 'Publishing...' : 'Publish Hackathon'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewSection sub-component
// ---------------------------------------------------------------------------

function ReviewSection({
  title,
  onEdit,
  hasError,
  children,
}: {
  title: string;
  onEdit: () => void;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        hasError && 'border-destructive/50',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Pencil className="size-3" />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
