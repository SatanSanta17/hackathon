import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import type { RegistrationField } from '@/db/schema';

import { ShareButtons } from './share-buttons';
import { RegistrationCta, type CtaState } from './registration-cta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingHeroProps {
  title: string;
  orgName: string;
  status: string;
  coverImageUrl?: string;
  registrationStart: Date | string | null;
  registrationEnd: Date | string | null;
  pageUrl: string;
  ctaState: CtaState;
  hackathonSlug: string;
  registrationFields: RegistrationField[];
  userName: string | null;
  userEmail: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingHero({
  title,
  orgName,
  status,
  coverImageUrl,
  registrationStart,
  registrationEnd,
  pageUrl,
  ctaState,
  hackathonSlug,
  registrationFields,
  userName,
  userEmail,
}: LandingHeroProps) {

  return (
    <section className="relative w-full overflow-hidden">
      {/* Background: cover image or gradient fallback */}
      {coverImageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={coverImageUrl}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-hero-gradient-from via-hero-gradient-via to-hero-gradient-to" />
      )}

      {/* Content */}
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-40 lg:px-8 lg:pb-24 lg:pt-48">
        <Badge
          variant="outline"
          className="mb-4 border-primary/40 text-primary"
        >
          {formatStatus(status)}
        </Badge>

        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>

        <p className="mt-3 text-lg text-muted-foreground">
          Organized by{' '}
          <span className="font-medium text-foreground">{orgName}</span>
        </p>

        {/* Registration dates */}
        {registrationStart && registrationEnd && (
          <p className="mt-4 text-sm text-muted-foreground">
            Registration: {formatDate(registrationStart)} —{' '}
            {formatDate(registrationEnd)}
          </p>
        )}

        {/* CTA + Share row */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <RegistrationCta
            ctaState={ctaState}
            hackathonSlug={hackathonSlug}
            hackathonTitle={title}
            hackathonStatus={status}
            registrationFields={registrationFields}
            userName={userName}
            userEmail={userEmail}
          />

          <ShareButtons title={title} pageUrl={pageUrl} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    published: 'Registration Open',
    active: 'In Progress',
    judging: 'Judging Underway',
    completed: 'Completed',
  };
  return labels[status] ?? status;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
