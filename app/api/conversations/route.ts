import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getUserConversations,
  findOrCreateDM,
  createGroupConversation,
} from '@/services/conversation.service';
import {
  createDMConversationSchema,
  createGroupConversationSchema,
} from '@/validators/message.schema';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const conversations = await getUserConversations(currentUser._id);
    return NextResponse.json({
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();

    // Check if DM creation
    if (body.type === 'dm' || body.recipientUserId) {
      const parseResult = createDMConversationSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error.issues[0]?.message || 'Invalid DM data' },
          { status: 400 }
        );
      }

      const conversation = await findOrCreateDM(
        currentUser._id,
        parseResult.data.recipientUserId
      );

      return NextResponse.json({ conversation }, { status: 201 });
    }

    // Otherwise Group creation
    const parseResult = createGroupConversationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid group data' },
        { status: 400 }
      );
    }

    const conversation = await createGroupConversation(
      currentUser._id,
      parseResult.data.title,
      parseResult.data.memberUserIds,
      parseResult.data.avatar
    );

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err: unknown) {
    console.error('Create conversation error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to create conversation.' },
      { status: 500 }
    );
  }
}

