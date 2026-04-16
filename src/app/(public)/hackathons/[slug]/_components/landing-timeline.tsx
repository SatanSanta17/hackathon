import {
  UserPlus,
  Upload,
  Search,
  Scale,
  Trophy,
} from 'lucide-react';

import type { Phase } from '@/db/schema';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingTimelineProps {
  phases: Phase[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map phase type → Lucide icon */
const PHASE_ICONS: Record<string, React.ElementType> = {
  registration: UserPlus,
  submission: Upload,
  screening: Search,
  judging: Scale,
  results: Trophy,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingTimeline({ phases }: LandingTimelineProps) {
  return (
    <section
      id="timeline"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Timeline
        </h2>

        {/* Desktop: horizontal timeline */}
        <div className="mt-10 hidden lg:block">
          <div className="relative flex items-start justify-between">
            {/* Connector line */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-timeline-connector" />

            {phases.map((phase, index) => (
              <TimelineNodeHorizontal
                key={phase.id}
                phase={phase}
                isLast={index === phases.length - 1}
              />
            ))}
          </div>
        </div>

        {/* Mobile + Tablet: vertical timeline */}
        <div className="mt-8 lg:hidden">
          <div className="relative ml-4 border-l-2 border-timeline-connector pl-8">
            {phases.map((phase) => (
              <TimelineNodeVertical key={phase.id} phase={phase} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Node (desktop)
// ---------------------------------------------------------------------------

function TimelineNodeHorizontal({
  phase,
}: {
  phase: Phase;
  isLast: boolean;
}) {
  const Icon = PHASE_ICONS[phase.type] ?? Trophy;
  const colors = getStatusColors(phase.status);

  return (
    <div
      className="relative flex flex-col items-center text-center"
      style={{ flex: '1 1 0' }}
    >
      {/* Dot */}
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2',
          colors.dot,
        )}
      >
        <Icon className={cn('h-4 w-4', colors.icon)} />
      </div>

      {/* Label */}
      <h3
        className={cn(
          'mt-3 font-heading text-sm font-semibold',
          colors.text,
        )}
      >
        {phase.name}
      </h3>

      {/* Dates */}
      {phase.startDate && phase.endDate && (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatShortDate(phase.startDate)} —{' '}
          {formatShortDate(phase.endDate)}
        </p>
      )}

      {/* Status label */}
      <span className={cn('mt-1.5 text-xs font-medium', colors.text)}>
        {formatPhaseStatus(phase.status)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vertical Node (mobile + tablet)
// ---------------------------------------------------------------------------

function TimelineNodeVertical({ phase }: { phase: Phase }) {
  const Icon = PHASE_ICONS[phase.type] ?? Trophy;
  const colors = getStatusColors(phase.status);

  return (
    <div className="relative pb-10 last:pb-0">
      {/* Dot on the line */}
      <div
        className={cn(
          'absolute -left-[calc(1rem+5px)] flex h-10 w-10 items-center justify-center rounded-full border-2',
          colors.dot,
        )}
      >
        <Icon className={cn('h-4 w-4', colors.icon)} />
      </div>

      <div>
        <h3
          className={cn(
            'font-heading text-base font-semibold',
            colors.text,
          )}
        >
          {phase.name}
        </h3>

        {phase.startDate && phase.endDate && (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatShortDate(phase.startDate)} —{' '}
            {formatShortDate(phase.endDate)}
          </p>
        )}

        <span
          className={cn('mt-1 inline-block text-xs font-medium', colors.text)}
        >
          {formatPhaseStatus(phase.status)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusColors(status: string): {
  dot: string;
  icon: string;
  text: string;
} {
  switch (status) {
    case 'active':
      return {
        dot: 'border-timeline-active bg-timeline-active/20',
        icon: 'text-timeline-active',
        text: 'text-timeline-active',
      };
    case 'completed':
      return {
        dot: 'border-timeline-completed bg-timeline-completed/20',
        icon: 'text-timeline-completed',
        text: 'text-timeline-completed',
      };
    default:
      // upcoming
      return {
        dot: 'border-timeline-upcoming bg-timeline-upcoming/20',
        icon: 'text-muted-foreground',
        text: 'text-muted-foreground',
      };
  }
}

function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPhaseStatus(status: string): string {
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    active: 'In Progress',
    completed: 'Completed',
  };
  return labels[status] ?? status;
}
