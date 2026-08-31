import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IFollow {
  _id: Types.ObjectId;
  followerId: Types.ObjectId; // User who is following
  followingId: Types.ObjectId; // User who is being followed
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Ensure a user cannot follow another user multiple times (Compound Unique Index)
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Index to quickly fetch list of followers for a user
FollowSchema.index({ followingId: 1, createdAt: -1 });
// Index to quickly fetch list of people a user is following
FollowSchema.index({ followerId: 1, createdAt: -1 });

const Follow: Model<IFollow> = models.Follow || mongoose.model<IFollow>('Follow', FollowSchema);

export default Follow;

