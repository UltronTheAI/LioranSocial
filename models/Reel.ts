import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IReelVideo {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
}

export interface IReel {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  video: IReelVideo;
  caption: string;
  mentions: string[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReelVideoSchema = new Schema<IReelVideo>(
  {
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    thumbnail: { type: String },
  },
  { _id: false }
);

const ReelSchema = new Schema<IReel>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video: {
      type: ReelVideoSchema,
      required: true,
    },
    caption: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true,
    },
    mentions: {
      type: [String],
      default: [],
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    savesCount: {
      type: Number,
      default: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

ReelSchema.index({ authorId: 1, _id: -1 });
ReelSchema.index({ createdAt: -1 });
ReelSchema.index({ caption: 'text' });

const Reel: Model<IReel> = models.Reel || mongoose.model<IReel>('Reel', ReelSchema);

export default Reel;

