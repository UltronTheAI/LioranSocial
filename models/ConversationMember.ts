import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IConversationMember {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'admin' | 'member';
  joinedAt: Date;
  lastReadMessageId?: Types.ObjectId;
}

const ConversationMemberSchema = new Schema<IConversationMember>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: false,
  }
);

// Ensure a user is added to a conversation only once
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
ConversationMemberSchema.index({ userId: 1, conversationId: 1 });

const ConversationMember: Model<IConversationMember> =
  models.ConversationMember ||
  mongoose.model<IConversationMember>('ConversationMember', ConversationMemberSchema);

export default ConversationMember;

