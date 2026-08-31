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

    const targetUser = await User.findOne({ username: normalizedUsername });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();

    // Query follows where targetUser is the follower
    const follows = await Follow.find({ followerId: targetUser._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('followingId', 'username displayName avatar bio')
      .lean();

    // Collect IDs of users that currentUser is currently following
    let viewerFollowingIds = new Set<string>();
    if (currentUser) {
      const viewerFollows = await Follow.find({
        followerId: currentUser._id,
      }).select('followingId').lean();
      viewerFollowingIds = new Set(viewerFollows.map((f) => f.followingId.toString()));
    }

    const following = follows
      .filter((f) => f.followingId) // filter out any orphan records
      .map((f) => {
        const followedUser = f.followingId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
          bio?: string;
        };
        const followedIdStr = followedUser._id.toString();
        return {
          _id: followedIdStr,
          username: followedUser.username,
          displayName: followedUser.displayName,
          avatar: followedUser.avatar || '',
          bio: followedUser.bio || '',
          isFollowing: viewerFollowingIds.has(followedIdStr),
          isSelf: currentUser ? currentUser._id.toString() === followedIdStr : false,
        };
      });

    return NextResponse.json({
      following,
      count: following.length,
    });
  } catch (error) {
    console.error('Fetch following error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch following users.' },
      { status: 500 }
    );
  }
}

