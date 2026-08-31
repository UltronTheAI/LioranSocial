import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IMessageMedia {
  url: string;
  secureUrl: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: 'text' | 'image' | 'post' | 'reel' | 'story_reply';
  text?: string;
  media?: IMessageMedia;
  sharedPostId?: Types.ObjectId;
  sharedReelId?: Types.ObjectId;
  storyId?: Types.ObjectId;
  storyReaction?: string;
  replyTo?: Types.ObjectId;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

const MessageMediaSchema = new Schema<IMessageMedia>(
  {
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
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
      enum: ['text', 'image', 'post', 'reel', 'story_reply'],
      default: 'text',
      required: true,
    },
    text: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    media: {
      type: MessageMediaSchema,
    },
    sharedPostId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    sharedReelId: {
      type: Schema.Types.ObjectId,
      ref: 'Reel',
    },
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
    },
    storyReaction: {
      type: String,
      maxlength: 20,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    editedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index({ conversationId: 1, createdAt: -1 });

const Message: Model<IMessage> =
  models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;

