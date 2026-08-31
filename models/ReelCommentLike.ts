import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelCommentLike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  commentId: Types.ObjectId;
  reelId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReelCommentLikeSchema = new Schema<IReelCommentLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'ReelComment',
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
    timestamps: true,
  }
);

ReelCommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });

const ReelCommentLike: Model<IReelCommentLike> =
  models.ReelCommentLike || mongoose.model<IReelCommentLike>('ReelCommentLike', ReelCommentLikeSchema);

export default ReelCommentLike;

