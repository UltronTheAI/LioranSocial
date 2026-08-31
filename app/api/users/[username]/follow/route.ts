import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Follow from '@/models/Follow';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { username } = await props.params;
    const normalizedUsername = username.toLowerCase().trim();

    await connectToDatabase();

    const targetUser = await User.findOne({ username: normalizedUsername });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Prevent following oneself
    if (currentUser._id.toString() === targetUser._id.toString()) {
      return NextResponse.json(
        { error: 'You cannot follow yourself.' },
        { status: 400 }
      );
    }

    // Check if currently following
    const existingFollow = await Follow.findOne({
      followerId: currentUser._id,
      followingId: targetUser._id,
    });

    if (existingFollow) {
      // Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });

      // Atomically decrement counters safely
      await User.findByIdAndUpdate(currentUser._id, {
        $inc: { followingCount: -1 },
      });
      const updatedTarget = await User.findByIdAndUpdate(
        targetUser._id,
        { $inc: { followersCount: -1 } },
        { new: true }
      );

      // Clamp counters to non-negative if necessary
      if (updatedTarget && updatedTarget.followersCount < 0) {
        updatedTarget.followersCount = 0;
        await updatedTarget.save();
      }

      return NextResponse.json({
        message: `You unfollowed @${targetUser.username}`,
        isFollowing: false,
        followersCount: Math.max(0, updatedTarget?.followersCount || 0),
      });
    } else {
      // Follow
      try {
        await Follow.create({
          followerId: currentUser._id,
          followingId: targetUser._id,
        });

        // Atomically increment counters
        await User.findByIdAndUpdate(currentUser._id, {
          $inc: { followingCount: 1 },
        });
        const updatedTarget = await User.findByIdAndUpdate(
          targetUser._id,
          { $inc: { followersCount: 1 } },
          { new: true }
        );

        return NextResponse.json({
          message: `You are now following @${targetUser.username}`,
          isFollowing: true,
          followersCount: updatedTarget?.followersCount || 1,
        });
      } catch (err: unknown) {
        // Handle race condition / duplicate key gracefully
        if ((err as { code?: number })?.code === 11000) {
          return NextResponse.json({
            message: `You are already following @${targetUser.username}`,
            isFollowing: true,
            followersCount: targetUser.followersCount,
          });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Follow toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to update follow relationship.' },
      { status: 500 }
    );
  }
}

