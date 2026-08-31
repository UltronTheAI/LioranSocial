import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IStoryMedia {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
}

export interface IStorySharedContent {
  contentType: 'post' | 'reel';
  postId?: Types.ObjectId;
  reelId?: Types.ObjectId;
  authorUsername: string;
  authorAvatar?: string;
}

export interface IStory {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  media: IStoryMedia;
  mediaType: 'image' | 'video';
  sharedContent?: IStorySharedContent;
  viewsCount: number;
  likesCount: number;
  expiresAt: Date;
  createdAt: Date;
}

const StoryMediaSchema = new Schema<IStoryMedia>(
  {
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const StorySharedContentSchema = new Schema<IStorySharedContent>(
  {
    contentType: { type: String, enum: ['post', 'reel'], required: true },
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    reelId: { type: Schema.Types.ObjectId, ref: 'Reel' },
    authorUsername: { type: String, required: true },
    authorAvatar: { type: String },
  },
  { _id: false }
);

const StorySchema = new Schema<IStory>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    media: {
      type: StoryMediaSchema,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
      default: 'image',
    },
    sharedContent: {
      type: StorySharedContentSchema,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// MongoDB TTL Index: Automatically purge stories once 24 hours (expiresAt) have passed
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
StorySchema.index({ authorId: 1, expiresAt: 1 });

const Story: Model<IStory> = models.Story || mongoose.model<IStory>('Story', StorySchema);

export default Story;
