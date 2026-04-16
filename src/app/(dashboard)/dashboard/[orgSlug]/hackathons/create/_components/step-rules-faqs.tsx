'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TiptapEditor } from './tiptap-editor';
import type { Hackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepRulesFaqsProps {
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

export function StepRulesFaqs({
  hackathonId,
  orgId,
  initialData,
  onSave,
  onNext,
  className,
}: StepRulesFaqsProps) {
  const [rulesHtml, setRulesHtml] = useState<string>(initialData.rulesHtml ?? '');
  const [faqsHtml, setFaqsHtml] = useState<string>(initialData.faqsHtml ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          rulesHtml: rulesHtml || null,
          faqsHtml: faqsHtml || null,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.message ?? 'Failed to save rules & FAQs.');
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
    <div className={cn('space-y-8', className)}>
      <div>
        <h2 className="text-lg font-semibold">Rules & FAQs</h2>
        <p className="text-sm text-muted-foreground">
          Both fields are optional. Add rules or frequently asked questions to help participants.
        </p>
      </div>

      {/* Rules editor */}
      <div className="space-y-2">
        <Label>Hackathon Rules</Label>
        <TiptapEditor
          content={rulesHtml}
          onChange={setRulesHtml}
          placeholder="Write the hackathon rules here..."
        />
      </div>

      {/* FAQs editor */}
      <div className="space-y-2">
        <Label>Frequently Asked Questions</Label>
        <TiptapEditor
          content={faqsHtml}
          onChange={setFaqsHtml}
          placeholder="Add common questions and answers..."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}
