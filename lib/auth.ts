import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Session from '@/models/Session';
import { generateRandomToken, hashToken } from '@/lib/security';
import { AccessTokenPayload } from '@/types/auth';
import { SafeUser } from '@/types/user';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from '@/lib/constants';

export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
};

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production_min32';
const encodedJwtSecret = new TextEncoder().encode(JWT_SECRET);

/**
 * Generates a signed JWT access token
 */
export async function createAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(encodedJwtSecret);
}

/**
 * Verifies a JWT access token
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedJwtSecret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Creates a new DB session and issues an access token + refresh token pair
 */
export async function createAuthSession(
  user: { _id: string | Types.ObjectId; email: string; username: string },
  userAgent?: string,
  ipAddress?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  await connectToDatabase();

  const rawRefreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);

  // Store hashed refresh token in MongoDB Session
  await Session.create({
    userId: user._id,
    refreshTokenHash,
    userAgent: userAgent || '',
    ipAddress: ipAddress || '',
    expiresAt,
    revokedAt: null,
  });

  const accessToken = await createAccessToken({
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * Sets auth cookies in the response
 */
export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Clears auth cookies
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Rotates refresh token with reuse detection
 */
export async function rotateRefreshToken(
  currentRefreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ accessToken: string; refreshToken: string; user: SafeUser } | null> {
  await connectToDatabase();

  const currentTokenHash = hashToken(currentRefreshToken);

  // Search for the session by the token hash
  const session = await Session.findOne({ refreshTokenHash: currentTokenHash });

  if (!session) {
    return null;
  }

  // Reuse Detection: If session was already revoked or is expired, revoke ALL sessions for this user
  if (session.revokedAt !== null || session.expiresAt < new Date()) {
    console.warn(`[SECURITY ALERT] Refresh token reuse detected for userId: ${session.userId}. Revoking all sessions.`);
    await Session.updateMany({ userId: session.userId }, { revokedAt: new Date() });
    return null;
  }

  const user = await User.findById(session.userId).select('-passwordHash').lean();
  if (!user || !user.emailVerified) {
    session.revokedAt = new Date();
    await session.save();
    return null;
  }

  // Generate new refresh token and update session hash (Rotation)
  const newRawRefreshToken = generateRandomToken(48);
  const newRefreshTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);

  session.refreshTokenHash = newRefreshTokenHash;
  session.expiresAt = newExpiresAt;
  if (userAgent) session.userAgent = userAgent;
  if (ipAddress) session.ipAddress = ipAddress;
  await session.save();

  const accessToken = await createAccessToken({
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    user: {
      ...user,
      _id: user._id.toString(),
    } as SafeUser,
  };
}

/**
 * Revokes an active session by refresh token
 */
export async function revokeSessionByRefreshToken(rawRefreshToken: string): Promise<boolean> {
  await connectToDatabase();
  const tokenHash = hashToken(rawRefreshToken);
  const result = await Session.findOneAndUpdate(
    { refreshTokenHash: tokenHash, revokedAt: null },
    { revokedAt: new Date() }
  );
  return !!result;
}

/**
 * Retrieves the currently authenticated user from cookies, automatically refreshing if needed
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken);
      if (payload?.userId) {
        await connectToDatabase();
        const user = await User.findById(payload.userId).select('-passwordHash').lean();
        if (user && user.emailVerified) {
          return {
            ...user,
            _id: user._id.toString(),
          } as SafeUser;
        }
      }
    }

    // If access token was expired or missing, try refresh token
    if (refreshToken) {
      const rotationResult = await rotateRefreshToken(refreshToken);
      if (rotationResult) {
        await setAuthCookies(rotationResult.accessToken, rotationResult.refreshToken);
        return rotationResult.user;
      } else {
        await clearAuthCookies();
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
