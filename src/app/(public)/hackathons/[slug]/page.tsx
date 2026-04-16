import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getHackathonBySlug } from '@/lib/services/hackathon-service';
import { getStorageProvider } from '@/lib/storage';

import { LandingHero } from './_components/landing-hero';
import { LandingAbout } from './_components/landing-about';
import { LandingTracks } from './_components/landing-tracks';
import { LandingFooter } from './_components/landing-footer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Statuses that are publicly viewable on the landing page */
const PUBLIC_STATUSES = ['published', 'active', 'judging', 'completed'] as const;
type PublicStatus = (typeof PUBLIC_STATUSES)[number];

function isPublicStatus(status: string): status is PublicStatus {
  return PUBLIC_STATUSES.includes(status as PublicStatus);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Metadata (SEO + Open Graph — P4.R10)
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getHackathonBySlug(slug);

  if (!data || !isPublicStatus(data.hackathon.status)) {
    return { title: 'Hackathon Not Found' };
  }

  const { hackathon } = data;
  const description = hackathon.description
    ? hackathon.description.slice(0, 160)
    : `Join ${hackathon.title} on HackForge — the enterprise hackathon platform.`;

  // Resolve cover image URL for OG tags (24h expiry for social crawlers)
  let ogImageUrl: string | undefined;
  if (hackathon.coverImageKey) {
    try {
      const storage = getStorageProvider();
      ogImageUrl = await storage.getSignedUrl(hackathon.coverImageKey, 60 * 60 * 24);
    } catch {
      // Fall back to no image — OG crawlers will use the default
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hackforge.com';
  const pageUrl = `${appUrl}/hackathons/${slug}`;

  return {
    title: hackathon.title,
    description,
    openGraph: {
      title: hackathon.title,
      description,
      url: pageUrl,
      siteName: 'HackForge',
      type: 'website',
      ...(ogImageUrl && {
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 675,
            alt: hackathon.title,
          },
        ],
      }),
    },
    twitter: {
      card: ogImageUrl ? 'summary_large_image' : 'summary',
      title: hackathon.title,
      description,
      ...(ogImageUrl && { images: [ogImageUrl] }),
    },
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function HackathonLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getHackathonBySlug(slug);

  // 404 for missing, draft, or archived hackathons
  if (!data || !isPublicStatus(data.hackathon.status)) {
    notFound();
  }

  const { hackathon, orgName, phases, tracks, prizes } = data;

  // Resolve cover image URL for display (1h expiry)
  let coverImageUrl: string | undefined;
  if (hackathon.coverImageKey) {
    try {
      const storage = getStorageProvider();
      coverImageUrl = await storage.getSignedUrl(hackathon.coverImageKey, 60 * 60);
    } catch {
      // No cover image — hero will use gradient fallback
    }
  }

  // Resolve prize image URLs
  const prizesWithImages = await Promise.all(
    prizes.map(async (prize) => {
      if (!prize.imageKey) return { ...prize, imageUrl: undefined };
      try {
        const storage = getStorageProvider();
        const imageUrl = await storage.getSignedUrl(prize.imageKey, 60 * 60);
        return { ...prize, imageUrl };
      } catch {
        return { ...prize, imageUrl: undefined };
      }
    }),
  );

  // Determine which sections exist (for sticky nav — wired in increment 4D)
  const sections: Array<{ id: string; label: string }> = [];
  if (hackathon.description) sections.push({ id: 'about', label: 'About' });
  if (tracks.length > 0) sections.push({ id: 'tracks', label: 'Tracks' });
  sections.push({ id: 'timeline', label: 'Timeline' });
  if (prizes.length > 0) sections.push({ id: 'prizes', label: 'Prizes' });
  if (hackathon.rulesHtml) sections.push({ id: 'rules', label: 'Rules' });
  if (hackathon.faqsHtml) sections.push({ id: 'faqs', label: 'FAQs' });

  // Find registration phase dates for the hero
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const registrationPhase = sortedPhases.find((p) => p.type === 'registration');

  // Build page URL for social sharing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hackforge.com';
  const pageUrl = `${appUrl}/hackathons/${slug}`;

  // Store sections and resolved data for use in increments 4C/4D
  // (timeline, prizes, rules, faqs, nav components will be added in later increments)
  void sections;
  void prizesWithImages;

  return (
    <>
      {/* Sticky nav will be added in increment 4D */}

      <main>
        <LandingHero
          title={hackathon.title}
          orgName={orgName}
          status={hackathon.status}
          coverImageUrl={coverImageUrl}
          registrationStart={registrationPhase?.startDate ?? null}
          registrationEnd={registrationPhase?.endDate ?? null}
          pageUrl={pageUrl}
        />

        {hackathon.description && (
          <LandingAbout description={hackathon.description} />
        )}

        {tracks.length > 0 && (
          <LandingTracks tracks={tracks} />
        )}

        {/* Timeline section will be added in increment 4C */}
        {/* Prizes section will be added in increment 4C */}
        {/* Rules section will be added in increment 4D */}
        {/* FAQs section will be added in increment 4D */}
      </main>

      <LandingFooter />
    </>
  );
}
