import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  editMessage,
  deleteMessage,
  deleteMessageForMe,
} from '@/services/conversation.service';

export async function PATCH(
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
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text || text.length > 2000) {
      return NextResponse.json(
        { error: 'Message text must be between 1 and 2000 characters.' },
        { status: 400 }
      );
    }

    const result = await editMessage({
      conversationId,
      messageId,
      userId: currentUser._id,
      text,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Edit message error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to edit message.' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id: conversationId, messageId } = await props.params;
    const { searchParams } = new URL(req.url);
    const deleteFor = searchParams.get('for') || 'everyone';

    if (deleteFor === 'me') {
      const result = await deleteMessageForMe({
        conversationId,
        messageId,
        userId: currentUser._id,
      });
      return NextResponse.json(result);
    } else {
      const result = await deleteMessage({
        conversationId,
        messageId,
        userId: currentUser._id,
      });
      return NextResponse.json(result);
    }
  } catch (err: unknown) {
    console.error('Delete message error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to delete message.' },
      { status: 400 }
    );
  }
}
