import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelLike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  reelId: Types.ObjectId;
  createdAt: Date;
}

const ReelLikeSchema = new Schema<IReelLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reelId: {
      type: Schema.Types.ObjectId,
      ref: 'Reel',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ReelLikeSchema.index({ userId: 1, reelId: 1 }, { unique: true });

const ReelLike: Model<IReelLike> =
  models.ReelLike || mongoose.model<IReelLike>('ReelLike', ReelLikeSchema);

export default ReelLike;

