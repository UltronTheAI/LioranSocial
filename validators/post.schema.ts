import { z } from 'zod';

export const postImageSchema = z.object({
  url: z.string().min(1, 'Image URL is required'),
  secureUrl: z.string().min(1, 'Secure image URL is required'),
  publicId: z.string().min(1, 'Public ID is required'),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const createPostSchema = z.object({
  images: z
    .array(postImageSchema)
    .min(1, 'A post must contain at least 1 image')
    .max(10, 'A post cannot contain more than 10 images'),
  caption: z
    .string()
    .max(500, 'Caption cannot exceed 500 characters')
    .optional()
    .default(''),
});

export const createCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(300, 'Comment cannot exceed 300 characters')
    .trim(),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(30).default(10),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

