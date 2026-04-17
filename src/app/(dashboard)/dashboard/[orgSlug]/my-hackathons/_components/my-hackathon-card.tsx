'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { UserHackathonSummary } from '@/lib/services/registration-service';

interface MyHackathonCardProps {
  summary: UserHackathonSummary & { coverImageUrl: string | null };
}

export function MyHackathonCard({ summary }: MyHackathonCardProps) {
  const { hackathon, team, formData, coverImageUrl } = summary;
  const isMissingProfile = !formData?.designation || !formData?.department;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Cover image or gradient fallback */}
      <div className="relative h-32 w-full">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-hero-gradient-from via-hero-gradient-via to-hero-gradient-to" />
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* Title + status */}
        <div className="space-y-1">
          <Link
            href={`/hackathons/${hackathon.slug}`}
            className="font-heading font-semibold hover:underline"
          >
            {hackathon.title}
          </Link>
          <div>
            <Badge variant="outline" className="text-xs">
              {formatStatus(hackathon.status)}
            </Badge>
          </div>
        </div>

        {/* Team status */}
        <div className="text-sm">
          {team === null ? (
            <div className="space-y-1">
              <span className="text-muted-foreground">No Team</span>
              <div className="flex gap-3">
                <Link
                  href={`/hackathons/${hackathon.slug}/teams`}
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Find a Team
                </Link>
                <Link
                  href={`/hackathons/${hackathon.slug}/teams/new`}
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Create a Team
                </Link>
              </div>
            </div>
          ) : team.adminStatus === 'approved' ? (
            <Link
              href={`/hackathons/${hackathon.slug}/teams/${team.id}`}
              className="flex items-center gap-1.5 hover:underline"
            >
              <span className="font-medium">{team.name}</span>
              <span className="text-muted-foreground">
                · {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
              </span>
            </Link>
          ) : team.adminStatus === 'pending_review' ? (
            <div className="space-y-0.5">
              <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">
                Under Review
              </Badge>
              <p className="text-xs text-muted-foreground">
                Your team is awaiting organiser approval.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <Badge variant="destructive" className="opacity-80">
                Not Approved
              </Badge>
              <p className="text-xs text-muted-foreground">
                Contact the organiser for more information.
              </p>
            </div>
          )}
        </div>

        {/* Profile nudge */}
        {isMissingProfile && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="size-1.5 rounded-full bg-amber-500" />
            <Link
              href={`/hackathons/${hackathon.slug}/register`}
              className="underline underline-offset-2 hover:text-amber-700"
            >
              Complete your profile
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    published: 'Registration Open',
    active: 'In Progress',
    judging: 'Judging',
    completed: 'Completed',
    draft: 'Draft',
  };
  return labels[status] ?? status;
}
