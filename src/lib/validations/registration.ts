import { z } from 'zod';

export const registrationFieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, 'Label is required').max(100),
  fieldType: z.enum(['text', 'textarea', 'dropdown']),
  options: z.array(z.string().min(1)).optional().nullable(),
  required: z.boolean().default(false),
  order: z.number().int().min(0),
});

export const upsertRegistrationFieldsSchema = z.object({
  fields: z.array(registrationFieldSchema).max(10, 'Maximum 10 custom fields allowed'),
});

export const createRegistrationSchema = z.object({
  formData: z.record(z.string(), z.string()).optional().nullable(),
  isDiscoverable: z.boolean().default(true),
});

export const updateRegistrationSchema = z.object({
  formData: z.record(z.string(), z.string()).optional().nullable(),
  isDiscoverable: z.boolean().optional(),
});

export type RegistrationFieldInput = z.infer<typeof registrationFieldSchema>;
export type UpsertRegistrationFieldsInput = z.infer<typeof upsertRegistrationFieldsSchema>;
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;
