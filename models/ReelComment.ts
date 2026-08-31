import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelComment {
  _id: Types.ObjectId;
  reelId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
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
    text: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ReelCommentSchema.index({ reelId: 1, createdAt: -1 });

const ReelComment: Model<IReelComment> =
  models.ReelComment || mongoose.model<IReelComment>('ReelComment', ReelCommentSchema);

export default ReelComment;

