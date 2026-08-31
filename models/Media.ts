import mongoose, { Schema, Model, models, Types } from 'mongoose';

export interface IMedia {
  _id: Types.ObjectId;
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  resourceType: string;
  bytes?: number;
  uploaderId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    secureUrl: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    format: {
      type: String,
    },
    resourceType: {
      type: String,
      default: 'image',
    },
    bytes: {
      type: Number,
    },
    uploaderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Media: Model<IMedia> = models.Media || mongoose.model<IMedia>('Media', MediaSchema);

export default Media;

