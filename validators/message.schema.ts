import { z } from 'zod';

export const createDMConversationSchema = z.object({
  recipientUserId: z.string().min(1, 'Recipient user ID is required'),
});

export const createGroupConversationSchema = z.object({
  title: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name cannot exceed 100 characters')
    .trim(),
  memberUserIds: z
    .array(z.string())
    .min(1, 'At least 1 other member must be selected')
    .max(50, 'Groups cannot exceed 50 members'),
  avatar: z.string().optional(),
});

export const messageMediaSchema = z.object({
  url: z.string().min(1, 'Media URL is required'),
  secureUrl: z.string().min(1, 'Secure media URL is required'),
  publicId: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const sendMessageSchema = z.object({
  type: z
    .enum(['text', 'image', 'post', 'reel', 'story_reply'])
    .default('text'),
  text: z.string().max(2000, 'Message cannot exceed 2000 characters').optional(),
  media: messageMediaSchema.optional(),
  sharedPostId: z.string().optional(),
  sharedReelId: z.string().optional(),
  storyId: z.string().optional(),
  storyReaction: z.string().max(20).optional(),
  replyTo: z.string().optional(),
}).refine(
  (data) =>
    (data.text && data.text.trim().length > 0) ||
    data.media ||
    data.sharedPostId ||
    data.sharedReelId ||
    data.storyId ||
    data.storyReaction,
  { message: 'Message content cannot be empty' }
);

export const shareContentSchema = z.object({
  contentType: z.enum(['post', 'reel']),
  contentId: z.string().min(1, 'Content ID is required'),
  targetConversationIds: z.array(z.string()).optional(),
  targetUserIds: z.array(z.string()).optional(),
  text: z.string().max(500).optional(),
}).refine(
  (data) =>
    (data.targetConversationIds && data.targetConversationIds.length > 0) ||
    (data.targetUserIds && data.targetUserIds.length > 0),
  { message: 'At least one target recipient or conversation must be selected' }
);

export type CreateDMInput = z.infer<typeof createDMConversationSchema>;
export type CreateGroupInput = z.infer<typeof createGroupConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ShareContentInput = z.infer<typeof shareContentSchema>;

