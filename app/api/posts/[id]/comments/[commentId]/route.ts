import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
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

    const [post, comment] = await Promise.all([
      Post.findById(id),
      Comment.findById(commentId),
    ]);

    if (!post || !comment) {
      return NextResponse.json({ error: 'Post or comment not found.' }, { status: 404 });
    }

    // Check if caller is comment author OR post author
    const isCommentAuthor = comment.authorId.toString() === currentUser._id.toString();
    const isPostAuthor = post.authorId.toString() === currentUser._id.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this comment.' },
        { status: 403 }
      );
    }

    await Comment.deleteOne({ _id: comment._id });

    // Decrement commentsCount
    await Post.findByIdAndUpdate(post._id, {
      $inc: { commentsCount: -1 },
    });

    return NextResponse.json({
      message: 'Comment deleted successfully.',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment.' },
      { status: 500 }
    );
  }
}

