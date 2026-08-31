import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IStoryReply {
  _id: Types.ObjectId;
  storyId: Types.ObjectId;
  storyAuthorId: Types.ObjectId;
  senderId: Types.ObjectId;
  text?: string;
  emoji?: string;
  createdAt: Date;
}

const StoryReplySchema = new Schema<IStoryReply>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    storyAuthorId: {
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
    text: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    emoji: {
      type: String,
      maxlength: 10,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

StoryReplySchema.index({ storyAuthorId: 1, createdAt: -1 });

const StoryReply: Model<IStoryReply> =
  models.StoryReply || mongoose.model<IStoryReply>('StoryReply', StoryReplySchema);

export default StoryReply;

