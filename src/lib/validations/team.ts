import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
  trackId: z.string().uuid().optional(),
  isOpen: z.boolean().default(true),
});

export const updateTeamSchema = createTeamSchema.partial();

export const joinRequestSchema = z.object({
  message: z.string().max(300).optional(),
  entryPoint: z.enum(['browse', 'link', 'participant_browse']),
});

export const respondToJoinRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export const inviteByEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const transferLeadSchema = z.object({
  toUserId: z.string().uuid(),
});

export const respondToTeamSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type RespondToJoinRequestInput = z.infer<typeof respondToJoinRequestSchema>;
export type InviteByEmailInput = z.infer<typeof inviteByEmailSchema>;
export type TransferLeadInput = z.infer<typeof transferLeadSchema>;
export type RespondToTeamInput = z.infer<typeof respondToTeamSchema>;
