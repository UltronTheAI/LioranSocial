import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Notification, { NotificationType } from '@/models/Notification';
import User from '@/models/User';
import '@/models/Post';
import '@/models/Reel';
import '@/models/Story';
import { emitSocketEvent } from '@/lib/socket-server';

export interface CreateNotificationParams {
  recipientId: string;
  senderId: string;
  type: NotificationType;
  postId?: string;
  reelId?: string;
  storyId?: string;
  commentText?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    if (params.recipientId.toString() === params.senderId.toString()) {
      return null; // Don't notify self
    }

    await connectToDatabase();

    const notif = await Notification.create({
      recipientId: new Types.ObjectId(params.recipientId),
      senderId: new Types.ObjectId(params.senderId),
      type: params.type,
      postId: params.postId ? new Types.ObjectId(params.postId) : undefined,
      reelId: params.reelId ? new Types.ObjectId(params.reelId) : undefined,
      storyId: params.storyId ? new Types.ObjectId(params.storyId) : undefined,
      commentText: params.commentText,
      isRead: false,
    });

    const populated = await Notification.findById(notif._id)
      .populate('senderId', 'username displayName avatar')
      .populate('postId', 'images')
      .populate('reelId', 'video')
      .populate('storyId', 'media mediaType')
      .lean();

    if (populated) {
      const senderDoc = populated.senderId as unknown as {
        _id?: { toString: () => string };
        username?: string;
        displayName?: string;
        avatar?: string;
      } | null;

      const senderObj = senderDoc && typeof senderDoc === 'object' && '_id' in senderDoc
        ? {
            _id: senderDoc._id ? senderDoc._id.toString() : params.senderId,
            username: senderDoc.username || 'user',
            displayName: senderDoc.displayName || 'User',
            avatar: senderDoc.avatar || '',
          }
        : {
            _id: params.senderId,
            username: 'user',
            displayName: 'User',
            avatar: '',
          };

      emitSocketEvent(`user:${params.recipientId}`, 'notification:new', {
        _id: populated._id.toString(),
        type: populated.type,
        sender: senderObj,
        postId: populated.postId,
        reelId: populated.reelId,
        storyId: populated.storyId,
        commentText: populated.commentText,
        isRead: populated.isRead,
        createdAt: populated.createdAt,
      });
    }

    return populated;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
}

export async function sendMentionNotifications({
  text,
  senderId,
  type,
  postId,
  reelId,
}: {
  text: string;
  senderId: string;
  type: 'mention_post' | 'mention_reel' | 'mention_comment';
  postId?: string;
  reelId?: string;
}) {
  if (!text) return;

  try {
    const rawMatches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
    const usernames = Array.from(
      new Set(rawMatches.map((m) => m.substring(1).toLowerCase()))
    );

    if (usernames.length === 0) return;

    await connectToDatabase();
    const matchedUsers = await User.find({ username: { $in: usernames } })
      .select('_id username')
      .lean();

    for (const user of matchedUsers) {
      if (user._id.toString() !== senderId.toString()) {
        await createNotification({
          recipientId: user._id.toString(),
          senderId,
          type,
          postId,
          reelId,
          commentText: text.slice(0, 150),
        });
      }
    }
  } catch (error) {
    console.error('Send mention notifications error:', error);
  }
}

export async function getUserNotifications(userId: string, limit = 40) {
  await connectToDatabase();

  const userObjId = new Types.ObjectId(userId);

  const notifications = await Notification.find({ recipientId: userObjId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'username displayName avatar')
    .populate('postId', 'images')
    .populate('reelId', 'video')
    .populate('storyId', 'media mediaType')
    .lean();

  const unreadCount = await Notification.countDocuments({
    recipientId: userObjId,
    isRead: false,
  });

  return {
    notifications: notifications.map((n) => {
      const senderDoc = n.senderId as unknown as {
        _id?: { toString: () => string };
        username?: string;
        displayName?: string;
        avatar?: string;
      } | null;

      const senderObj = senderDoc && typeof senderDoc === 'object' && '_id' in senderDoc
        ? {
            _id: senderDoc._id ? senderDoc._id.toString() : (senderDoc as unknown as { toString: () => string }).toString(),
            username: senderDoc.username || 'user',
            displayName: senderDoc.displayName || 'User',
            avatar: senderDoc.avatar || '',
          }
        : {
            _id: n.senderId ? (n.senderId as unknown as { toString: () => string }).toString() : '',
            username: 'user',
            displayName: 'User',
            avatar: '',
          };

      return {
        _id: n._id.toString(),
        type: n.type,
        sender: senderObj,
        post: n.postId,
        reel: n.reelId,
        story: n.storyId,
        commentText: n.commentText,
        isRead: n.isRead,
        createdAt: n.createdAt,
      };
    }),
    unreadCount,
  };
}

export async function markNotificationsAsRead(userId: string) {
  await connectToDatabase();

  const userObjId = new Types.ObjectId(userId);
  await Notification.updateMany(
    { recipientId: userObjId, isRead: false },
    { $set: { isRead: true } }
  );

  return { success: true };
}
