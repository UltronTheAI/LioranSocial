import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelComment {
  _id: Types.ObjectId;
  reelId: Types.ObjectId;
  authorId: Types.ObjectId;
  parentId?: Types.ObjectId;
  text: string;
  likesCount: number;
  isPinned: boolean;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReelCommentSchema = new Schema<IReelComment>(
  {
    reelId: {
      type: Schema.Types.ObjectId,
      ref: 'Reel',
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
      ref: 'ReelComment',
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

ReelCommentSchema.index({ reelId: 1, isPinned: -1, createdAt: 1 });
ReelCommentSchema.index({ parentId: 1, createdAt: 1 });

const ReelComment: Model<IReelComment> =
  models.ReelComment || mongoose.model<IReelComment>('ReelComment', ReelCommentSchema);

export default ReelComment;
