import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  type: 'dm' | 'group';
  title?: string;
  avatar?: string;
  lastMessageId?: Types.ObjectId;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['dm', 'group'],
      required: true,
      default: 'dm',
    },
    title: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    avatar: {
      type: String,
    },
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ lastActivityAt: -1 });

const Conversation: Model<IConversation> =
  models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;

