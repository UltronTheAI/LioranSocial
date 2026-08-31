import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IStoryView {
  _id: Types.ObjectId;
  storyId: Types.ObjectId;
  viewerId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const StoryViewSchema = new Schema<IStoryView>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    viewerId: {
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

StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
StoryViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const StoryView: Model<IStoryView> =
  models.StoryView || mongoose.model<IStoryView>('StoryView', StoryViewSchema);

export default StoryView;

