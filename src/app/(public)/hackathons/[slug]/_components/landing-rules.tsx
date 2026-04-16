// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingRulesProps {
  html: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingRules({ html }: LandingRulesProps) {
  return (
    <section
      id="rules"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Rules
        </h2>
        <div
          className="prose prose-invert mt-6 max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
