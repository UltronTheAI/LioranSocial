import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface ILike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
}

const LikeSchema = new Schema<ILike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Ensure a user can only like a post once
LikeSchema.index({ userId: 1, postId: 1 }, { unique: true });

const Like: Model<ILike> = models.Like || mongoose.model<ILike>('Like', LikeSchema);

export default Like;

