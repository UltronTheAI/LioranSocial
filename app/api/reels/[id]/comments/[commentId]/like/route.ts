import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import ReelComment from '@/models/ReelComment';
import ReelCommentLike from '@/models/ReelCommentLike';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/services/notification.service';

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

    const comment = await ReelComment.findById(commentId);
    if (!comment || comment.reelId.toString() !== reelId) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }

    const existingLike = await ReelCommentLike.findOne({
      userId: currentUser._id,
      commentId: comment._id,
    });

    let isLiked = false;
    let likesCount = comment.likesCount || 0;

    if (existingLike) {
      await ReelCommentLike.deleteOne({ _id: existingLike._id });
      const updated = await ReelComment.findByIdAndUpdate(
        comment._id,
        { $inc: { likesCount: -1 } },
        { new: true }
      );
      likesCount = Math.max(0, updated?.likesCount || 0);
      isLiked = false;
    } else {
      await ReelCommentLike.create({
        userId: currentUser._id,
        commentId: comment._id,
        reelId: comment.reelId,
      });
      const updated = await ReelComment.findByIdAndUpdate(
        comment._id,
        { $inc: { likesCount: 1 } },
        { new: true }
      );
      likesCount = updated?.likesCount || 1;
      isLiked = true;

      // Send like notification
      if (comment.authorId.toString() !== currentUser._id.toString()) {
        createNotification({
          recipientId: comment.authorId.toString(),
          senderId: currentUser._id,
          type: 'like_comment',
          reelId: comment.reelId.toString(),
          commentText: comment.text,
        }).catch((e) => console.error('Reel comment like notification error:', e));
      }
    }

    return NextResponse.json({
      isLiked,
      likesCount,
    });
  } catch (error) {
    console.error('Reel comment like error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment like.' },
      { status: 500 }
    );
  }
}

