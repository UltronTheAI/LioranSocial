import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Follow from '@/models/Follow';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await props.params;
    const normalizedUsername = username.toLowerCase().trim();

    await connectToDatabase();

    const user = await User.findOne({ username: normalizedUsername })
      .select('-passwordHash')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();
    let isFollowing = false;
    const isSelf = currentUser ? currentUser._id.toString() === user._id.toString() : false;

    if (currentUser && !isSelf) {
      const followRecord = await Follow.findOne({
        followerId: currentUser._id,
        followingId: user._id,
      });
      isFollowing = Boolean(followRecord);
    }

    return NextResponse.json({
      user: {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        email: isSelf ? user.email : undefined,
        avatar: user.avatar || '',
        bio: user.bio || '',
        emailVerified: user.emailVerified,
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        postsCount: user.postsCount || 0,
        createdAt: user.createdAt,
      },
      isFollowing,
      isSelf,
    });
  } catch (error) {
    console.error('Fetch user profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile.' },
      { status: 500 }
    );
  }
}

