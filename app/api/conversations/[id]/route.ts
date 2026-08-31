import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getConversationDetails,
  deleteConversation,
} from '@/services/conversation.service';

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
    const conversation = await getConversationDetails(id, currentUser._id);

    return NextResponse.json({ conversation });
  } catch (err: unknown) {
    console.error('Fetch conversation error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to fetch conversation.' },
      { status: 404 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id } = await props.params;
    const result = await deleteConversation(id, currentUser._id);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Delete conversation error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to delete conversation.' },
      { status: 400 }
    );
  }
}
