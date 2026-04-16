import { ExternalLink } from 'lucide-react';

import type { Track } from '@/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingTracksProps {
  tracks: Track[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingTracks({ tracks }: LandingTracksProps) {
  const isSingle = tracks.length === 1;

  return (
    <section
      id="tracks"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Tracks
        </h2>

        {isSingle ? (
          /* Inline display for single track */
          <div className="mt-6">
            <h3 className="font-heading text-xl font-semibold">
              {tracks[0].name}
            </h3>
            {tracks[0].description && (
              <p className="mt-2 text-muted-foreground">
                {tracks[0].description}
              </p>
            )}
            {tracks[0].resourcesUrl && (
              <a
                href={tracks[0].resourcesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Resources <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          /* Card grid for multiple tracks */
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks
              .sort((a, b) => a.order - b.order)
              .map((track) => (
                <Card key={track.id} className="border-border/50">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">
                      {track.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {track.description && (
                      <p className="text-sm text-muted-foreground">
                        {track.description}
                      </p>
                    )}
                    {track.resourcesUrl && (
                      <a
                        href={track.resourcesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        Resources <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
