'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

interface ProfileNudgeBannerProps {
  hackathonSlug: string;
  formData: Record<string, string> | null;
}

export function ProfileNudgeBanner({ hackathonSlug, formData }: ProfileNudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const isMissingProfile = !formData?.designation || !formData?.department;
  if (!isMissingProfile || dismissed) return null;

  return (
    <div className="flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-amber-600">
          Complete your hackathon profile
        </p>
        <p className="text-xs text-muted-foreground">
          Adding your designation and department helps team leads find the right fit.{' '}
          <Link
            href={`/hackathons/${hackathonSlug}/register`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Update profile →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-4 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
