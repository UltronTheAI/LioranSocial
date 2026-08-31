import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryView from '@/models/StoryView';
import StoryLike from '@/models/StoryLike';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid story ID.' }, { status: 400 });
    }

    await connectToDatabase();

    const story = await Story.findById(id);
    if (!story) {
      return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    }

    // Only story author can view story analytics / viewers list
    if (story.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'Only the story author can view story activity.' },
        { status: 403 }
      );
    }

    const [views, likes] = await Promise.all([
      StoryView.find({ storyId: story._id })
        .sort({ createdAt: -1 })
        .populate('viewerId', 'username displayName avatar emailVerified')
        .lean(),
      StoryLike.find({ storyId: story._id })
        .select('userId')
        .lean(),
    ]);

    const likedUserIds = new Set(likes.map((l) => l.userId.toString()));

    const viewers = views
      .filter((v) => v.viewerId)
      .map((v) => {
        const u = v.viewerId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
          emailVerified?: boolean;
        };
        const idStr = u._id.toString();
        return {
          _id: v._id.toString(),
          user: {
            _id: idStr,
            username: u.username,
            displayName: u.displayName,
            avatar: u.avatar || '',
            emailVerified: u.emailVerified || false,
          },
          viewedAt: v.createdAt,
          isLiked: likedUserIds.has(idStr),
        };
      });

    return NextResponse.json({
      viewsCount: story.viewsCount || viewers.length,
      likesCount: story.likesCount || 0,
      viewers,
    });
  } catch (error) {
    console.error('Fetch story viewers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story viewers.' },
      { status: 500 }
    );
  }
}

