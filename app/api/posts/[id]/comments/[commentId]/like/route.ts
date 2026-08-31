import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Comment from '@/models/Comment';
import CommentLike from '@/models/CommentLike';
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

    const { id: postId, commentId } = await props.params;

    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const comment = await Comment.findById(commentId);
    if (!comment || comment.postId.toString() !== postId) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }

    const existingLike = await CommentLike.findOne({
      userId: currentUser._id,
      commentId: comment._id,
    });

    let isLiked = false;
    let likesCount = comment.likesCount || 0;

    if (existingLike) {
      await CommentLike.deleteOne({ _id: existingLike._id });
      const updated = await Comment.findByIdAndUpdate(
        comment._id,
        { $inc: { likesCount: -1 } },
        { new: true }
      );
      likesCount = Math.max(0, updated?.likesCount || 0);
      isLiked = false;
    } else {
      await CommentLike.create({
        userId: currentUser._id,
        commentId: comment._id,
        postId: comment.postId,
      });
      const updated = await Comment.findByIdAndUpdate(
        comment._id,
        { $inc: { likesCount: 1 } },
        { new: true }
      );
      likesCount = updated?.likesCount || 1;
      isLiked = true;

      // Send like notification to comment author
      if (comment.authorId.toString() !== currentUser._id.toString()) {
        createNotification({
          recipientId: comment.authorId.toString(),
          senderId: currentUser._id,
          type: 'like_comment',
          postId: comment.postId.toString(),
          commentText: comment.text,
        }).catch((e) => console.error('Comment like notification error:', e));
      }
    }

    return NextResponse.json({
      isLiked,
      likesCount,
    });
  } catch (error) {
    console.error('Comment like error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment like.' },
      { status: 500 }
    );
  }
}

