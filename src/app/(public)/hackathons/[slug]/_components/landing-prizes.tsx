import Image from 'next/image';
import { Trophy } from 'lucide-react';

import type { Prize } from '@/db/schema';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrizeWithImage extends Prize {
  imageUrl?: string;
}

interface LandingPrizesProps {
  prizes: PrizeWithImage[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rank → token-based styling for top 3 */
const RANK_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-prize-gold/15', text: 'text-prize-gold', label: '1st Place' },
  2: { bg: 'bg-prize-silver/15', text: 'text-prize-silver', label: '2nd Place' },
  3: { bg: 'bg-prize-bronze/15', text: 'text-prize-bronze', label: '3rd Place' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingPrizes({ prizes }: LandingPrizesProps) {
  const sorted = [...prizes].sort((a, b) => a.rank - b.rank);

  return (
    <section
      id="prizes"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Prizes
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((prize) => {
            const rankStyle = RANK_STYLES[prize.rank];

            return (
              <Card
                key={prize.id}
                className={cn(
                  'overflow-hidden border-border/50',
                  rankStyle?.bg,
                )}
              >
                {/* Prize image */}
                {prize.imageUrl && (
                  <div className="relative aspect-video w-full">
                    <Image
                      src={prize.imageUrl}
                      alt={prize.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                )}

                <CardContent className="pt-4">
                  {/* Rank badge */}
                  <div className="flex items-center gap-2">
                    <Trophy
                      className={cn(
                        'h-4 w-4',
                        rankStyle?.text ?? 'text-muted-foreground',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        rankStyle?.text ?? 'text-muted-foreground',
                      )}
                    >
                      {rankStyle?.label ?? `Rank #${prize.rank}`}
                    </span>
                  </div>

                  {/* Name + description */}
                  <h3 className="mt-2 font-heading text-lg font-semibold">
                    {prize.name}
                  </h3>
                  {prize.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {prize.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
