import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelSave {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  reelId: Types.ObjectId;
  createdAt: Date;
}

const ReelSaveSchema = new Schema<IReelSave>(
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

ReelSaveSchema.index({ userId: 1, reelId: 1 }, { unique: true });
ReelSaveSchema.index({ userId: 1, createdAt: -1 });

const ReelSave: Model<IReelSave> =
  models.ReelSave || mongoose.model<IReelSave>('ReelSave', ReelSaveSchema);

export default ReelSave;

