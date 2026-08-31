import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface ICommentLike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  commentId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommentLikeSchema = new Schema<ICommentLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
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
    timestamps: true,
  }
);

CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });

const CommentLike: Model<ICommentLike> =
  models.CommentLike || mongoose.model<ICommentLike>('CommentLike', CommentLikeSchema);

export default CommentLike;

