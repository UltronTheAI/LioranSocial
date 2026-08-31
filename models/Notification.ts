import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface INotification {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: 'follow' | 'like_post' | 'like_reel' | 'comment_post' | 'comment_reel' | 'message';
  postId?: Types.ObjectId;
  reelId?: Types.ObjectId;
  commentText?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['follow', 'like_post', 'like_reel', 'comment_post', 'comment_reel', 'message'],
      required: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    reelId: {
      type: Schema.Types.ObjectId,
      ref: 'Reel',
    },
    commentText: {
      type: String,
      maxlength: 300,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user notification feed and unread queries
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, isRead: 1 });

const Notification: Model<INotification> =
  models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;

