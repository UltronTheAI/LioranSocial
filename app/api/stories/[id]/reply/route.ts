import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryReply from '@/models/StoryReply';
import { getCurrentUser } from '@/lib/auth';
import { createStoryReplySchema } from '@/validators/story.schema';
import {
  findOrCreateDM,
  persistAndBroadcastMessage,
} from '@/services/conversation.service';

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
      return NextResponse.json({ error: 'Invalid story ID' }, { status: 400 });
    }

    const body = await req.json();
    const parseResult = createStoryReplySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Text or emoji is required' }, { status: 400 });
    }

    await connectToDatabase();

    const story = await Story.findById(id);
    if (!story) {
      return NextResponse.json({ error: 'Story not found or expired' }, { status: 404 });
    }

    // 1. Record StoryReply record
    const reply = await StoryReply.create({
      storyId: story._id,
      storyAuthorId: story.authorId,
      senderId: currentUser._id,
      text: parseResult.data.text,
      emoji: parseResult.data.emoji,
    });

    // 2. Automatically route Story reply/reaction to DM conversation
    try {
      const dm = await findOrCreateDM(currentUser._id, story.authorId.toString());
      await persistAndBroadcastMessage({
        conversationId: dm._id,
        senderId: currentUser._id,
        type: 'story_reply',
        storyId: story._id.toString(),
        storyReaction: parseResult.data.emoji,
        text: parseResult.data.text,
      });
    } catch (e) {
      console.error('Failed to bridge story reply to DM conversation:', e);
    }

    return NextResponse.json(
      {
        message: 'Reply sent successfully.',
        reply: {
          _id: reply._id.toString(),
          storyId: story._id.toString(),
          senderId: currentUser._id,
          text: reply.text,
          emoji: reply.emoji,
          createdAt: reply.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Story reply error:', error);
    return NextResponse.json(
      { error: 'Failed to send story reply.' },
      { status: 500 }
    );
  }
}
