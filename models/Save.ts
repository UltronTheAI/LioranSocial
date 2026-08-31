import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface ISave {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
}

const SaveSchema = new Schema<ISave>(
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

// Ensure a user can only bookmark/save a post once
SaveSchema.index({ userId: 1, postId: 1 }, { unique: true });
SaveSchema.index({ userId: 1, createdAt: -1 });

const Save: Model<ISave> = models.Save || mongoose.model<ISave>('Save', SaveSchema);

export default Save;

