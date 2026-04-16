'use client';

import { useState } from 'react';
import { Lightbulb, Rocket, Layers, Globe, Lock, type LucideIcon } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HackathonTemplate } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Icon mapping (template.icon string → Lucide component)
// ---------------------------------------------------------------------------

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  rocket: Rocket,
  layers: Layers,
  globe: Globe,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepTemplateProps {
  templates: HackathonTemplate[];
  onSelect: (templateId: string) => Promise<void>;
  /** When set, the template is locked (draft already exists). Shows read-only view. */
  lockedTemplateType?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTemplate({
  templates,
  onSelect,
  lockedTemplateType,
  className,
}: StepTemplateProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isLocked = !!lockedTemplateType;

  const handleSelect = async (templateId: string) => {
    if (isLoading || isLocked) return;

    setSelectedId(templateId);
    setIsLoading(true);

    try {
      await onSelect(templateId);
    } catch {
      // Error is handled in the parent via toast
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-lg font-semibold">Choose a Template</h2>
        <p className="text-sm text-muted-foreground">
          {isLocked
            ? 'The template for this hackathon has already been selected and cannot be changed.'
            : 'Select a template to get started. This determines the default phases for your hackathon.'}
        </p>
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Templates cannot be changed after creation because phases and
            structure are tied to the selected template. To use a different
            template, create a new hackathon.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.map((template) => {
          const IconComponent = TEMPLATE_ICONS[template.icon ?? ''] ?? Lightbulb;
          const isActive =
            isLocked
              ? template.templateType === lockedTemplateType
              : selectedId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template.id)}
              disabled={isLoading || isLocked}
              className={cn('text-left', isLocked && 'cursor-default')}
            >
              <Card
                className={cn(
                  'transition-all',
                  !isLocked && 'cursor-pointer hover:border-primary',
                  isActive && 'ring-2 ring-primary',
                  isLocked && !isActive && 'opacity-50',
                  isLoading && !isActive && 'opacity-50',
                )}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <IconComponent className="size-5" />
                    </div>
                    <CardTitle>{template.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{template.description}</CardDescription>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No templates available. Please contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
}
