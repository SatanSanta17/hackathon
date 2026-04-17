import { z } from 'zod';

export const createTeamUpRequestSchema = z.object({
  toUserId: z.string().uuid(),
  proposedTeamName: z.string().min(1, 'Team name is required').max(100),
  message: z.string().max(300).optional(),
});

export const respondToTeamUpRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export type CreateTeamUpRequestInput = z.infer<typeof createTeamUpRequestSchema>;
export type RespondToTeamUpRequestInput = z.infer<typeof respondToTeamUpRequestSchema>;
