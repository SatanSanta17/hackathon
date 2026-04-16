import Link from 'next/link';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingFooter() {
  return (
    <footer className="border-t border-section-divider py-8">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        Powered by{' '}
        <Link
          href="/"
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          HackForge
        </Link>
      </div>
    </footer>
  );
}
