import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Notification from '@/models/Notification';
import { emitSocketEvent } from '@/lib/socket-server';

export interface CreateNotificationParams {
  recipientId: string;
  senderId: string;
  type: 'follow' | 'like_post' | 'like_reel' | 'comment_post' | 'comment_reel' | 'message';
  postId?: string;
  reelId?: string;
  commentText?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    if (params.recipientId === params.senderId) {
      return null; // Don't notify self
    }

    await connectToDatabase();

    const notif = await Notification.create({
      recipientId: new Types.ObjectId(params.recipientId),
      senderId: new Types.ObjectId(params.senderId),
      type: params.type,
      postId: params.postId ? new Types.ObjectId(params.postId) : undefined,
      reelId: params.reelId ? new Types.ObjectId(params.reelId) : undefined,
      commentText: params.commentText,
      isRead: false,
    });

    const populated = await Notification.findById(notif._id)
      .populate('senderId', 'username displayName avatar')
      .populate('postId', 'images')
      .populate('reelId', 'video.thumbnail')
      .lean();

    if (populated) {
      emitSocketEvent(`user:${params.recipientId}`, 'notification:new', {
        _id: populated._id.toString(),
        type: populated.type,
        sender: populated.senderId,
        postId: populated.postId,
        reelId: populated.reelId,
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

export async function getUserNotifications(userId: string, limit = 40) {
  await connectToDatabase();

  const userObjId = new Types.ObjectId(userId);

  const notifications = await Notification.find({ recipientId: userObjId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'username displayName avatar')
    .populate('postId', 'images')
    .populate('reelId', 'video')
    .lean();

  const unreadCount = await Notification.countDocuments({
    recipientId: userObjId,
    isRead: false,
  });

  return {
    notifications: notifications.map((n) => ({
      _id: n._id.toString(),
      type: n.type,
      sender: n.senderId,
      post: n.postId,
      reel: n.reelId,
      commentText: n.commentText,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
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

