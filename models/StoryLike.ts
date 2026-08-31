import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IStoryLike {
  _id: Types.ObjectId;
  storyId: Types.ObjectId;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const StoryLikeSchema = new Schema<IStoryLike>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

StoryLikeSchema.index({ storyId: 1, userId: 1 }, { unique: true });
StoryLikeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const StoryLike: Model<IStoryLike> =
  models.StoryLike || mongoose.model<IStoryLike>('StoryLike', StoryLikeSchema);

export default StoryLike;

