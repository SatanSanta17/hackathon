import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth/auth';

import { PlatformUserMenu } from './platform-user-menu';

export async function PlatformNav() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-heading text-xl font-bold tracking-tight text-foreground"
        >
          Hack<span className="text-primary">Forge</span>
        </Link>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <PlatformUserMenu
              name={session.user.name}
              email={session.user.email}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
