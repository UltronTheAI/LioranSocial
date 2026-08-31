import { Types } from 'mongoose';

export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VerificationTokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export interface IVerificationToken {
  _id: Types.ObjectId;
  identifier: string; // user email or userId
  type: VerificationTokenType;
  tokenHash: string; // SHA-256 hash of OTP
  attempts: number; // rate limiting / brute force prevention
  expiresAt: Date;
  createdAt: Date;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
  [key: string]: unknown;
}

