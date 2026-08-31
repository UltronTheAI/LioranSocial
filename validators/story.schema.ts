import { z } from 'zod';

export const storyMediaSchema = z.object({
  url: z.string().min(1, 'Media URL is required'),
  secureUrl: z.string().min(1, 'Secure media URL is required'),
  publicId: z.string().min(1, 'Public ID is required'),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const storySharedContentSchema = z.object({
  contentType: z.enum(['post', 'reel']),
  postId: z.string().optional(),
  reelId: z.string().optional(),
  authorUsername: z.string(),
  authorAvatar: z.string().optional(),
});

export const createStorySchema = z.object({
  media: storyMediaSchema,
  mediaType: z.enum(['image', 'video']),
  sharedContent: storySharedContentSchema.optional(),
});

export const createStoryReplySchema = z.object({
  text: z.string().max(300).optional(),
  emoji: z.string().max(10).optional(),
}).refine((data) => data.text || data.emoji, {
  message: 'Either text or emoji is required',
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type CreateStoryReplyInput = z.infer<typeof createStoryReplySchema>;
