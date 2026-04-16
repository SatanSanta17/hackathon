'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingFaqsProps {
  html: string;
}

interface FaqSection {
  question: string;
  answerHtml: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandingFaqs({ html }: LandingFaqsProps) {
  const sections = parseFaqSections(html);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  if (sections.length === 0) return null;

  return (
    <section
      id="faqs"
      className="border-t border-section-divider py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          FAQs
        </h2>

        <div className="mt-8 divide-y divide-border">
          {sections.map((faq, index) => (
            <div key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className="flex w-full items-center justify-between py-4 text-left font-heading text-base font-semibold transition-colors hover:text-primary"
              >
                {faq.question}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    openIndex === index && 'rotate-180',
                  )}
                />
              </button>

              <div
                className={cn(
                  'grid transition-all duration-200',
                  openIndex === index
                    ? 'grid-rows-[1fr] pb-4 opacity-100'
                    : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div
                    className="prose prose-invert prose-sm max-w-none prose-a:text-primary"
                    dangerouslySetInnerHTML={{ __html: faq.answerHtml }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HTML Parser
// ---------------------------------------------------------------------------

/**
 * Splits a single HTML string into FAQ sections by H2 tags.
 * Each H2's text content becomes the question; everything between
 * that H2 and the next H2 (or end of string) becomes the answer HTML.
 */
function parseFaqSections(html: string): FaqSection[] {
  const sections: FaqSection[] = [];

  // Split on <h2> tags, keeping the tag in the result
  const parts = html.split(/(?=<h2[^>]*>)/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract H2 text content
    const h2Match = trimmed.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (!h2Match) continue;

    const question = h2Match[1].replace(/<[^>]*>/g, '').trim();
    const answerHtml = trimmed.replace(/<h2[^>]*>.*?<\/h2>/i, '').trim();

    if (question) {
      sections.push({ question, answerHtml });
    }
  }

  return sections;
}
