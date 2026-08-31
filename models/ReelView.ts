import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelView {
  _id: Types.ObjectId;
  reelId: Types.ObjectId;
  userId?: Types.ObjectId;
  ipAddress?: string;
  createdAt: Date;
}

const ReelViewSchema = new Schema<IReelView>(
  {
    reelId: {
      type: Schema.Types.ObjectId,
      ref: 'Reel',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ipAddress: {
      type: String,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // MongoDB TTL index to auto-delete after 1 hour (cooldown)
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for fast cooldown lookups
ReelViewSchema.index({ reelId: 1, userId: 1 });
ReelViewSchema.index({ reelId: 1, ipAddress: 1 });

const ReelView: Model<IReelView> =
  models.ReelView || mongoose.model<IReelView>('ReelView', ReelViewSchema);

export default ReelView;

