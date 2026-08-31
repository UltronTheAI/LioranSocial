import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';
import { updateProfileSchema } from '@/validators/profile.schema';

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = updateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid profile data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { displayName, username, bio, avatar } = parseResult.data;
    const normalizedUsername = username.toLowerCase().trim();

    await connectToDatabase();

    // Check if new username is already taken by another user
    if (normalizedUsername !== currentUser.username) {
      const existingUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: currentUser._id },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'This username is already taken. Please choose another.' },
          { status: 409 }
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        displayName,
        username: normalizedUsername,
        bio: bio || '',
        avatar: avatar !== undefined ? avatar : currentUser.avatar,
      },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Profile updated successfully.',
      user: {
        _id: updatedUser._id.toString(),
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        avatar: updatedUser.avatar || '',
        bio: updatedUser.bio || '',
        emailVerified: updatedUser.emailVerified,
        followersCount: updatedUser.followersCount || 0,
        followingCount: updatedUser.followingCount || 0,
        postsCount: updatedUser.postsCount || 0,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile. Please try again.' },
      { status: 500 }
    );
  }
}

