'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AuthRegistrationModal } from './auth-registration-modal';
import type { RegistrationField } from '@/db/schema';

// ---------------------------------------------------------------------------
// CTA state union
// ---------------------------------------------------------------------------

export type CtaState =
  | { type: 'unauthenticated' }
  | { type: 'register'; hackathonId: string }
  | { type: 'registration_closed' }
  | { type: 'find_team'; teamsUrl: string }
  | { type: 'under_review'; teamId: string }
  | { type: 'my_team'; teamId: string; teamUrl: string }
  | { type: 'team_rejected' }
  | { type: 'completed' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RegistrationCtaProps {
  ctaState: CtaState;
  hackathonSlug: string;
  hackathonTitle: string;
  hackathonStatus: string;
  registrationFields: RegistrationField[];
}

export function RegistrationCta({
  ctaState,
  hackathonSlug,
  hackathonTitle,
  hackathonStatus,
  registrationFields,
}: RegistrationCtaProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'auth' | 'register'>('auth');

  function openAuth() {
    setModalInitialMode('auth');
    setModalOpen(true);
  }

  function openRegister() {
    setModalInitialMode('register');
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      {ctaState.type === 'unauthenticated' && (
        <Button
          size="lg"
          onClick={openAuth}
          className="font-heading text-base font-semibold"
        >
          Register Now
        </Button>
      )}

      {ctaState.type === 'register' && (
        <Button
          size="lg"
          onClick={openRegister}
          className="font-heading text-base font-semibold"
        >
          Register Now
        </Button>
      )}

      {ctaState.type === 'registration_closed' && (
        <Button
          size="lg"
          disabled
          className="font-heading text-base font-semibold"
        >
          Registration Closed
        </Button>
      )}

      {ctaState.type === 'completed' && (
        <Button
          size="lg"
          disabled
          className="font-heading text-base font-semibold"
        >
          Event Completed
        </Button>
      )}

      {ctaState.type === 'find_team' && (
        <Button size="lg" asChild className="font-heading text-base font-semibold">
          <Link href={ctaState.teamsUrl}>Find a Team</Link>
        </Button>
      )}

      {ctaState.type === 'under_review' && (
        <Button
          size="lg"
          disabled
          className="font-heading text-base font-semibold cursor-default bg-amber-500/15 text-amber-600 hover:bg-amber-500/15"
        >
          Team Under Review
        </Button>
      )}

      {ctaState.type === 'my_team' && (
        <Button size="lg" asChild className="font-heading text-base font-semibold">
          <Link href={ctaState.teamUrl}>My Team</Link>
        </Button>
      )}

      {ctaState.type === 'team_rejected' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button
                size="lg"
                disabled
                className="font-heading text-base font-semibold opacity-50"
              >
                Team Rejected
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Your team was not approved. Contact the organiser.
          </TooltipContent>
        </Tooltip>
      )}

      {(ctaState.type === 'unauthenticated' || ctaState.type === 'register') && (
        <AuthRegistrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          hackathonId={ctaState.type === 'register' ? ctaState.hackathonId : ''}
          hackathonSlug={hackathonSlug}
          hackathonTitle={hackathonTitle}
          registrationFields={registrationFields}
          initialMode={modalInitialMode}
        />
      )}

      {hackathonStatus === 'active' && (
        <div className="flex gap-4">
          <Link
            href={`/hackathons/${hackathonSlug}/teams`}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Browse Teams
          </Link>
          <Link
            href={`/hackathons/${hackathonSlug}/participants`}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Browse Participants
          </Link>
        </div>
      )}
    </div>
  );
}
