import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getConversationMessages,
  persistAndBroadcastMessage,
} from '@/services/conversation.service';
import { sendMessageSchema } from '@/validators/message.schema';

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
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10), 1), 50);

    const result = await getConversationMessages(id, currentUser._id, cursor, limit);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Fetch messages error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to fetch messages.' },
      { status: 500 }
    );
  }
}

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
    const body = await req.json();

    const parseResult = sendMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid message content' },
        { status: 400 }
      );
    }

    const message = await persistAndBroadcastMessage({
      conversationId: id,
      senderId: currentUser._id,
      ...parseResult.data,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    console.error('Send message error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to send message.' },
      { status: 500 }
    );
  }
}

