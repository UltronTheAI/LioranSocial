import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryView from '@/models/StoryView';
import StoryReply from '@/models/StoryReply';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    await connectToDatabase();

    const story = await Story.findById(id);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Only author can delete their story
    if (story.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this story.' },
        { status: 403 }
      );
    }

    await Story.findByIdAndDelete(story._id);
    await StoryView.deleteMany({ storyId: story._id });
    await StoryReply.deleteMany({ storyId: story._id });

    return NextResponse.json({
      message: 'Story deleted successfully.',
      storyId: id,
    });
  } catch (error) {
    console.error('Delete story error:', error);
    return NextResponse.json({ error: 'Failed to delete story.' }, { status: 500 });
  }
}

