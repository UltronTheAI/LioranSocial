import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryView from '@/models/StoryView';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid story ID' }, { status: 400 });
    }

    await connectToDatabase();

    const story = await Story.findById(id);
    if (!story) {
      return NextResponse.json({ error: 'Story not found or expired' }, { status: 404 });
    }

    // Do not count view if author is viewing their own story
    if (story.authorId.toString() === currentUser._id.toString()) {
      return NextResponse.json({ success: true, viewsCount: story.viewsCount });
    }

    try {
      await StoryView.create({
        storyId: story._id,
        viewerId: currentUser._id,
        expiresAt: story.expiresAt,
      });

      const updatedStory = await Story.findByIdAndUpdate(
        story._id,
        { $inc: { viewsCount: 1 } },
        { new: true }
      );

      return NextResponse.json({
        success: true,
        viewsCount: updatedStory?.viewsCount || 1,
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        // Already viewed
        return NextResponse.json({
          success: true,
          viewsCount: story.viewsCount,
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('Record story view error:', error);
    return NextResponse.json(
      { error: 'Failed to record story view.' },
      { status: 500 }
    );
  }
}

