import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelComment from '@/models/ReelComment';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id, commentId } = await props.params;
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectToDatabase();

    const [reel, comment] = await Promise.all([
      Reel.findById(id),
      ReelComment.findById(commentId),
    ]);

    if (!reel || !comment) {
      return NextResponse.json({ error: 'Reel or comment not found.' }, { status: 404 });
    }

    const isCommentAuthor = comment.authorId.toString() === currentUser._id.toString();
    const isReelAuthor = reel.authorId.toString() === currentUser._id.toString();

    if (!isCommentAuthor && !isReelAuthor) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this comment.' },
        { status: 403 }
      );
    }

    await ReelComment.deleteOne({ _id: comment._id });

    await Reel.findByIdAndUpdate(reel._id, {
      $inc: { commentsCount: -1 },
    });

    return NextResponse.json({
      message: 'Comment deleted successfully.',
    });
  } catch (error) {
    console.error('Delete reel comment error:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment.' },
      { status: 500 }
    );
  }
}

