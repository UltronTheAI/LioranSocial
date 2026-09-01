import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryLike from '@/models/StoryLike';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/services/notification.service';

export async function POST(
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

    const userObjId = new Types.ObjectId(currentUser._id.toString());

    const existingLike = await StoryLike.findOne({
      storyId: story._id,
      userId: userObjId,
    });

    let isLiked = false;
    if (existingLike) {
      // Unlike
      await StoryLike.findByIdAndDelete(existingLike._id);
      await Story.findByIdAndUpdate(story._id, {
        $inc: { likesCount: -1 },
      });
      isLiked = false;
    } else {
      // Like
      await StoryLike.create({
        storyId: story._id,
        userId: userObjId,
        expiresAt: story.expiresAt,
      });
      await Story.findByIdAndUpdate(story._id, {
        $inc: { likesCount: 1 },
      });
      isLiked = true;

      // Send notification to story author
      if (story.authorId.toString() !== currentUser._id.toString()) {
        createNotification({
          recipientId: story.authorId.toString(),
          senderId: currentUser._id,
          type: 'like_story',
        }).catch((e) => console.error('Story like notification error:', e));
      }
    }

    const updatedStory = await Story.findById(story._id).select('likesCount').lean();

    return NextResponse.json({
      isLiked,
      likesCount: updatedStory?.likesCount || 0,
    });
  } catch (error) {
    console.error('Toggle story like error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle story like.' },
      { status: 500 }
    );
  }
}

