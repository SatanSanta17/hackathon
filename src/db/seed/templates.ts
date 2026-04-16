import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { hackathonTemplates } from '@/db/schema';

const TEMPLATES = [
  {
    name: 'Idea Sprint',
    slug: 'idea-sprint',
    description:
      'A fast-paced format for collecting and evaluating ideas. Participants submit ideas in a structured format, organizers screen for quality, and the best ideas win. Best for: innovation challenges, ideation weeks, problem-statement-driven events.',
    templateType: 'idea_sprint' as const,
    icon: 'lightbulb',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Idea Submission', type: 'submission', order: 2, config: {} },
      { name: 'Screening', type: 'screening', order: 3, config: {} },
      { name: 'Winners Announced', type: 'results', order: 4, config: {} },
    ],
  },
  {
    name: 'Build & Ship',
    slug: 'build-and-ship',
    description:
      'The classic hackathon format. Teams register, build a working prototype, submit their project, and present to judges. Best for: weekend hackathons, internal build days, product-focused innovation events.',
    templateType: 'build_and_ship' as const,
    icon: 'rocket',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Building Phase', type: 'submission', order: 2, config: {} },
      { name: 'Project Submission', type: 'submission', order: 3, config: {} },
      { name: 'Judging', type: 'judging', order: 4, config: {} },
      { name: 'Winners Announced', type: 'results', order: 5, config: {} },
    ],
  },
  {
    name: 'Innovation Pipeline',
    slug: 'innovation-pipeline',
    description:
      'A multi-stage format that starts with ideas and progressively narrows down to polished prototypes. Each stage has its own evaluation. Best for: corporate innovation programs, multi-week challenges, R&D-driven events with executive judging.',
    templateType: 'innovation_pipeline' as const,
    icon: 'layers',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Idea Submission', type: 'submission', order: 2, config: {} },
      { name: 'Screening', type: 'screening', order: 3, config: {} },
      { name: 'Prototype Submission', type: 'submission', order: 4, config: {} },
      { name: 'Demo Day & Final Judging', type: 'judging', order: 5, config: {} },
      { name: 'Winners Announced', type: 'results', order: 6, config: {} },
    ],
  },
  {
    name: 'Open Challenge',
    slug: 'open-challenge',
    description:
      'An open-entry format where anyone can submit a solution and experts pick the winners. Simple and broad. Best for: public challenges, community-driven events, bounty-style competitions, open-source hackathons.',
    templateType: 'open_challenge' as const,
    icon: 'globe',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Submission', type: 'submission', order: 2, config: {} },
      { name: 'Expert Judging', type: 'judging', order: 3, config: {} },
      { name: 'Winners Announced', type: 'results', order: 4, config: {} },
    ],
  },
];

export async function seedTemplates() {
  console.log('[seed] Seeding hackathon templates...');

  for (const template of TEMPLATES) {
    const existing = await db.query.hackathonTemplates.findFirst({
      where: eq(hackathonTemplates.templateType, template.templateType),
    });

    if (existing) {
      console.log(`[seed] Template '${template.name}' already exists, skipping.`);
      continue;
    }

    await db.insert(hackathonTemplates).values(template);
    console.log(`[seed] Inserted template: ${template.name}`);
  }

  console.log('[seed] Template seeding complete.');
}
