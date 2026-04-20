'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { PublicHackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterValue = 'all' | 'open' | 'active';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
];

interface HackathonGridProps {
  hackathons: PublicHackathon[];
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function HackathonGrid({ hackathons }: HackathonGridProps) {
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = hackathons.filter((h) => {
    if (filter === 'open') return h.status === 'published';
    if (filter === 'active') return h.status === 'active';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-150',
              filter === f.value
                ? 'border-primary bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 text-2xs">
                ({hackathons.filter((h) =>
                  f.value === 'open' ? h.status === 'published' : h.status === f.value,
                ).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">No hackathons found.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check back soon for new events.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <HackathonCard key={h.id} hackathon={h} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function HackathonCard({ hackathon }: { hackathon: PublicHackathon }) {
  return (
    <Link
      href={`/hackathons/${hackathon.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/50"
    >
      {/* Cover */}
      <div className="relative h-44 w-full overflow-hidden">
        {hackathon.coverImageUrl ? (
          <Image
            src={hackathon.coverImageUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-hero-gradient-from via-hero-gradient-via to-hero-gradient-to" />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent" />

        {/* Status pill */}
        <div className="absolute right-3 top-3">
          <StatusPill status={hackathon.status} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {hackathon.title}
        </h3>
        <p className="text-2xs uppercase tracking-wider text-muted-foreground">
          {hackathon.orgName}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/40">
        Open
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-accent ring-1 ring-accent/40">
        Active
      </span>
    );
  }
  return null;
}
