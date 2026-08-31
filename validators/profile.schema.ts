import { z } from 'zod';
import { usernameValidation } from '@/validators/auth.schema';

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name cannot exceed 50 characters')
    .trim(),
  username: usernameValidation,
  bio: z
    .string()
    .max(150, 'Bio cannot exceed 150 characters')
    .optional()
    .default(''),
  avatar: z
    .string()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

