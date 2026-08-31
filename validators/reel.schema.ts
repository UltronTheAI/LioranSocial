import { z } from 'zod';

export const reelVideoSchema = z.object({
  url: z.string().min(1, 'Video URL is required'),
  secureUrl: z.string().min(1, 'Secure video URL is required'),
  publicId: z.string().min(1, 'Public ID is required'),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
});

export const createReelSchema = z.object({
  video: reelVideoSchema,
  caption: z
    .string()
    .max(500, 'Caption cannot exceed 500 characters')
    .optional()
    .default(''),
});

export const createReelCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(300, 'Comment cannot exceed 300 characters')
    .trim(),
});

export type CreateReelInput = z.infer<typeof createReelSchema>;
export type CreateReelCommentInput = z.infer<typeof createReelCommentSchema>;

