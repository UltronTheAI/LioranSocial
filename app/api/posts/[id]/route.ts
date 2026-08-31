import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import User from '@/models/User';
import Like from '@/models/Like';
import Save from '@/models/Save';
import Comment from '@/models/Comment';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(id)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();
    let isLiked = false;
    let isSaved = false;

    if (currentUser) {
      const [likeDoc, saveDoc] = await Promise.all([
        Like.findOne({ userId: currentUser._id, postId: post._id }),
        Save.findOne({ userId: currentUser._id, postId: post._id }),
      ]);
      isLiked = Boolean(likeDoc);
      isSaved = Boolean(saveDoc);
    }

    return NextResponse.json({
      post: {
        _id: post._id.toString(),
        author: post.authorId,
        images: post.images,
        caption: post.caption,
        mentions: post.mentions,
        likesCount: post.likesCount || 0,
        commentsCount: post.commentsCount || 0,
        savesCount: post.savesCount || 0,
        isLiked,
        isSaved,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch post error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch post.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const body = await req.json();
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 500) : '';

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to edit this post.' },
        { status: 403 }
      );
    }

    // Extract mentions
    const rawMentions: string[] = (caption.match(/@([a-zA-Z0-9_]+)/g) || []).map(
      (m: string) => m.substring(1).toLowerCase()
    );
    const mentions: string[] = Array.from(new Set(rawMentions));

    post.caption = caption;
    post.mentions = mentions;
    await post.save();

    return NextResponse.json({
      message: 'Post updated successfully.',
      post: {
        _id: post._id.toString(),
        caption: post.caption,
        mentions: post.mentions,
      },
    });
  } catch (error) {
    console.error('Edit post error:', error);
    return NextResponse.json({ error: 'Failed to update post.' }, { status: 500 });
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
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify ownership
    if (post.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this post.' },
        { status: 403 }
      );
    }

    // Delete post
    await Post.deleteOne({ _id: post._id });

    // Decrement author post count
    await User.findByIdAndUpdate(currentUser._id, {
      $inc: { postsCount: -1 },
    });

    // Clean up likes, saves, comments
    await Promise.all([
      Like.deleteMany({ postId: post._id }),
      Save.deleteMany({ postId: post._id }),
      Comment.deleteMany({ postId: post._id }),
    ]);

    return NextResponse.json({
      message: 'Post deleted successfully.',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post.' },
      { status: 500 }
    );
  }
}
