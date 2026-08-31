import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelComment from '@/models/ReelComment';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id: reelId, commentId } = await props.params;

    if (!Types.ObjectId.isValid(reelId) || !Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
    }

    if (reel.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'Only the reel author can pin comments.' },
        { status: 403 }
      );
    }

    const comment = await ReelComment.findById(commentId);
    if (!comment || comment.reelId.toString() !== reelId) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }

    const nextIsPinned = !comment.isPinned;
    comment.isPinned = nextIsPinned;
    await comment.save();

    return NextResponse.json({
      message: nextIsPinned ? 'Comment pinned.' : 'Comment unpinned.',
      isPinned: nextIsPinned,
    });
  } catch (error) {
    console.error('Pin reel comment error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment pin status.' },
      { status: 500 }
    );
  }
}

