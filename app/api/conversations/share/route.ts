import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  findOrCreateDM,
  persistAndBroadcastMessage,
} from '@/services/conversation.service';
import { shareContentSchema } from '@/validators/message.schema';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = shareContentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid share payload' },
        { status: 400 }
      );
    }

    const { contentType, contentId, targetConversationIds = [], targetUserIds = [], text } =
      parseResult.data;

    const conversationIdsToShare = new Set<string>(targetConversationIds);

    // Resolve target users to DM conversations
    for (const targetUserId of targetUserIds) {
      try {
        const dm = await findOrCreateDM(currentUser._id, targetUserId);
        conversationIdsToShare.add(dm._id);
      } catch (e) {
        console.error('Failed to create DM for share:', e);
      }
    }

    if (conversationIdsToShare.size === 0) {
      return NextResponse.json(
        { error: 'No valid recipient conversations found.' },
        { status: 400 }
      );
    }

    // Persist & broadcast messages to all target conversations
    const results = await Promise.all(
      Array.from(conversationIdsToShare).map((convId) =>
        persistAndBroadcastMessage({
          conversationId: convId,
          senderId: currentUser._id,
          type: contentType,
          sharedPostId: contentType === 'post' ? contentId : undefined,
          sharedReelId: contentType === 'reel' ? contentId : undefined,
          text: text?.trim() || undefined,
        })
      )
    );

    return NextResponse.json(
      {
        message: 'Content shared successfully.',
        count: results.length,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Share content error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to share content.' },
      { status: 500 }
    );
  }
}

