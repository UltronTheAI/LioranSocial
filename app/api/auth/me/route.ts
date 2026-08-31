import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio || '',
        avatar: user.avatar || '',
        emailVerified: user.emailVerified,
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        postsCount: user.postsCount || 0,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch me error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current user' },
      { status: 500 }
    );
  }
}

