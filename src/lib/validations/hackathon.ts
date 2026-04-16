import { z } from 'zod';

// ---------------------------------------------------------------------------
// Hackathon creation (from template selection — Step 1)
// ---------------------------------------------------------------------------

export const createHackathonSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
});

export type CreateHackathonInput = z.infer<typeof createHackathonSchema>;

// ---------------------------------------------------------------------------
// Hackathon update (Steps 2, 5 — basic info and team rules)
// ---------------------------------------------------------------------------

export const updateHackathonSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    description: z.string().max(5000, 'Description too long').optional().nullable(),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100, 'Slug too long')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
      .optional(),
    coverImageKey: z.string().optional().nullable(),
    visibility: z.enum(['public', 'org_only', 'invite_only']).optional(),
    teamMinSize: z.number().int().min(1).max(20).optional(),
    teamMaxSize: z.number().int().min(1).max(20).optional(),
    allowIndividual: z.boolean().optional(),
    rulesHtml: z.string().max(50000, 'Rules content too long').optional().nullable(),
    faqsHtml: z.string().max(50000, 'FAQs content too long').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.teamMinSize !== undefined && data.teamMaxSize !== undefined) {
        return data.teamMinSize <= data.teamMaxSize;
      }
      return true;
    },
    { message: 'Minimum team size cannot exceed maximum team size', path: ['teamMinSize'] }
  );

export type UpdateHackathonInput = z.infer<typeof updateHackathonSchema>;

// ---------------------------------------------------------------------------
// Track CRUD (Step 3)
// ---------------------------------------------------------------------------

export const createTrackSchema = z.object({
  name: z.string().min(1, 'Track name is required').max(100, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  resourcesUrl: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  order: z.number().int().min(0).optional(),
});

export type CreateTrackInput = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = createTrackSchema.partial();

export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;

// ---------------------------------------------------------------------------
// Phase update (Step 4 — dates and name only)
// ---------------------------------------------------------------------------

export const updatePhaseSchema = z
  .object({
    name: z.string().min(1, 'Phase name is required').max(100, 'Name too long').optional(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] }
  );

export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;

// ---------------------------------------------------------------------------
// Prize CRUD (Step 6)
// ---------------------------------------------------------------------------

export const createPrizeSchema = z.object({
  name: z.string().min(1, 'Prize name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  rank: z.number().int().min(1),
  imageKey: z.string().optional().nullable(),
});

export type CreatePrizeInput = z.infer<typeof createPrizeSchema>;

export const updatePrizeSchema = createPrizeSchema.partial();

export type UpdatePrizeInput = z.infer<typeof updatePrizeSchema>;

// ---------------------------------------------------------------------------
// Publish validation (Step 8)
// ---------------------------------------------------------------------------

export const publishHackathonSchema = z.object({
  hackathonId: z.string().uuid('Invalid hackathon ID'),
});

export type PublishHackathonInput = z.infer<typeof publishHackathonSchema>;

// ---------------------------------------------------------------------------
// Status transition (manual only — date-driven transitions are automatic)
// ---------------------------------------------------------------------------

export const transitionStatusSchema = z.object({
  targetStatus: z.enum([
    'published',  // draft → published (requires publish validation)
    'archived',   // completed → archived
  ]),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
