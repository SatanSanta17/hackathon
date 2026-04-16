// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingAboutProps {
  description: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingAbout({ description }: LandingAboutProps) {
  return (
    <section
      id="about"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          About
        </h2>
        <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
}
