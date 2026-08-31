import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { reactToMessage } from '@/services/conversation.service';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id: conversationId, messageId } = await props.params;
    const body = await req.json();
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';

    if (!emoji || emoji.length > 10) {
      return NextResponse.json({ error: 'Invalid emoji.' }, { status: 400 });
    }

    const result = await reactToMessage({
      conversationId,
      messageId,
      userId: currentUser._id,
      emoji,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('React to message error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to react to message.' },
      { status: 400 }
    );
  }
}

