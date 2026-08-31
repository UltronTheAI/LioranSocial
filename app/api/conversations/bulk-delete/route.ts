import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { bulkDeleteConversations } from '@/services/conversation.service';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const conversationIds = Array.isArray(body.conversationIds) ? body.conversationIds : [];

    if (conversationIds.length === 0) {
      return NextResponse.json({ error: 'No conversations selected.' }, { status: 400 });
    }

    const result = await bulkDeleteConversations(conversationIds, currentUser._id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Bulk delete conversations error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to delete conversations.' },
      { status: 400 }
    );
  }
}

