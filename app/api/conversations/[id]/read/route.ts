import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markConversationRead } from '@/services/conversation.service';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id: conversationId } = await props.params;

    const result = await markConversationRead({
      conversationId,
      userId: currentUser._id,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Mark read error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to mark conversation read.' },
      { status: 500 }
    );
  }
}

