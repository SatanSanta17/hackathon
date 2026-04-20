import Image from 'next/image';
import Link from 'next/link';

import { TEAM_ADMIN_STATUS } from '@/lib/constants/enums';
import type { UserHackathonSummary } from '@/lib/services/registration-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationWithCover extends UserHackathonSummary {
  coverImageUrl: string | null;
}

interface RegisteredHackathonStripProps {
  registrations: RegistrationWithCover[];
}

// ---------------------------------------------------------------------------
// Strip
// ---------------------------------------------------------------------------

export function RegisteredHackathonStrip({ registrations }: RegisteredHackathonStripProps) {
  return (
    <section className="border-b border-border/50 bg-card/40 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your Hackathons
        </h2>
        {registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t registered for any hackathons yet. Browse below.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {registrations.map((reg) => (
              <StripCard key={reg.registrationId} registration={reg} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function StripCard({ registration: reg }: { registration: RegistrationWithCover }) {
  const teamColor =
    !reg.team ? '' :
    reg.team.adminStatus === TEAM_ADMIN_STATUS.APPROVED ? 'text-primary' :
    reg.team.adminStatus === TEAM_ADMIN_STATUS.REJECTED ? 'text-destructive' :
    'text-amber-400';

  return (
    <Link
      href={`/hackathons/${reg.hackathon.slug}`}
      className="group flex w-56 flex-none flex-col overflow-hidden rounded-lg border border-border/60 bg-card transition-all duration-200 hover:border-primary/50"
    >
      <div className="relative h-24 w-full overflow-hidden">
        {reg.coverImageUrl ? (
          <Image
            src={reg.coverImageUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="224px"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-hero-gradient-from via-hero-gradient-via to-hero-gradient-to" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground group-hover:text-primary">
          {reg.hackathon.title}
        </p>
        {reg.team && (
          <p className={`text-2xs font-medium ${teamColor}`}>
            {reg.team.name}
          </p>
        )}
      </div>
    </Link>
  );
}
