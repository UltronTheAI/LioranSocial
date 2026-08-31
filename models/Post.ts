import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IPostImage {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
}

export interface IPost {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  images: IPostImage[];
  caption: string;
  mentions: string[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PostImageSchema = new Schema<IPostImage>(
  {
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    images: {
      type: [PostImageSchema],
      required: true,
      validate: [
        (val: IPostImage[]) => val.length >= 1 && val.length <= 10,
        'A post must contain between 1 and 10 images',
      ],
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
  },
  {
    timestamps: true,
  }
);

// Indexes for feeds and queries
PostSchema.index({ authorId: 1, _id: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ caption: 'text' });

const Post: Model<IPost> = models.Post || mongoose.model<IPost>('Post', PostSchema);

export default Post;

