import { Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  bio?: string;
  avatar?: string;
  emailVerified: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = Omit<IUser, 'passwordHash' | '_id'> & {
  _id: string;
};

