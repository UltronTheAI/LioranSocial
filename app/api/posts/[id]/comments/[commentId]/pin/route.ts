import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
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

    const { id: postId, commentId } = await props.params;

    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    if (post.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'Only the post author can pin comments.' },
        { status: 403 }
      );
    }

    const comment = await Comment.findById(commentId);
    if (!comment || comment.postId.toString() !== postId) {
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
    console.error('Pin comment error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment pin status.' },
      { status: 500 }
    );
  }
}

