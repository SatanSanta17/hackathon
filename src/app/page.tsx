import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PlatformNav } from '@/components/platform-nav';
import { auth } from '@/lib/auth/auth';
import { getStorageProvider } from '@/lib/storage';
import { getPublicHackathons } from '@/lib/services/hackathon-service';
import { getRegistrationsByUser } from '@/lib/services/registration-service';

import { HackathonGrid } from './_components/hackathon-grid';
import {
  RegisteredHackathonStrip,
  type RegistrationWithCover,
} from './_components/registered-hackathon-strip';

export default async function Home() {
  const [session, hackathons] = await Promise.all([
    auth(),
    getPublicHackathons(),
  ]);

  let registrations: RegistrationWithCover[] = [];

  if (session?.user?.id) {
    const raw = await getRegistrationsByUser(session.user.id);
    const storage = getStorageProvider();
    registrations = await Promise.all(
      raw.map(async (r) => ({
        ...r,
        coverImageUrl: r.hackathon.coverImageKey
          ? await storage.getSignedUrl(r.hackathon.coverImageKey)
          : null,
      })),
    );
  }

  return (
    <div className="theme-competitive min-h-screen bg-background">
      <PlatformNav />

      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -left-40 -top-40 size-[600px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 size-[500px] rounded-full bg-accent/15 blur-[100px]" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary">
            Enterprise Hackathon Platform
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Build the Future,{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              One Hack at a Time
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Discover world-class hackathons, collaborate with top talent, and ship
            products that matter.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {session?.user ? (
              <Button asChild size="lg" className="font-semibold">
                <Link href="#discover">Explore Hackathons</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="font-semibold">
                  <Link href="/signup">Get Started Free</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/login">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {session?.user && registrations.length > 0 && (
        <RegisteredHackathonStrip registrations={registrations} />
      )}

      {/* Discovery */}
      <section id="discover" className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Discover Hackathons
          </h2>
          <HackathonGrid hackathons={hackathons} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} HackForge. Built for builders.
          </p>
        </div>
      </footer>
    </div>
  );
}
