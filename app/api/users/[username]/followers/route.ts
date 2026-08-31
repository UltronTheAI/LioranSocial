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

    // Query follows where targetUser is the followed user
    const follows = await Follow.find({ followingId: targetUser._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('followerId', 'username displayName avatar bio')
      .lean();

    // Collect IDs of users that currentUser is currently following
    let viewerFollowingIds = new Set<string>();
    if (currentUser) {
      const viewerFollows = await Follow.find({
        followerId: currentUser._id,
      }).select('followingId').lean();
      viewerFollowingIds = new Set(viewerFollows.map((f) => f.followingId.toString()));
    }

    const followers = follows
      .filter((f) => f.followerId) // filter out any orphan records
      .map((f) => {
        const follower = f.followerId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
          bio?: string;
        };
        const followerIdStr = follower._id.toString();
        return {
          _id: followerIdStr,
          username: follower.username,
          displayName: follower.displayName,
          avatar: follower.avatar || '',
          bio: follower.bio || '',
          isFollowing: viewerFollowingIds.has(followerIdStr),
          isSelf: currentUser ? currentUser._id.toString() === followerIdStr : false,
        };
      });

    return NextResponse.json({
      followers,
      count: followers.length,
    });
  } catch (error) {
    console.error('Fetch followers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followers.' },
      { status: 500 }
    );
  }
}

