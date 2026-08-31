import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IComment {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  parentId?: Types.ObjectId;
  text: string;
  likesCount: number;
  isPinned: boolean;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

CommentSchema.index({ postId: 1, isPinned: -1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });

const Comment: Model<IComment> =
  models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
