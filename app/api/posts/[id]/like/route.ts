import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Like from '@/models/Like';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/services/notification.service';

export async function POST(
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

    // Check if like exists
    const existingLike = await Like.findOne({
      userId: currentUser._id,
      postId: post._id,
    });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      const updatedPost = await Post.findByIdAndUpdate(
        post._id,
        { $inc: { likesCount: -1 } },
        { new: true }
      );

      return NextResponse.json({
        isLiked: false,
        likesCount: Math.max(0, updatedPost?.likesCount || 0),
      });
    } else {
      // Like
      try {
        await Like.create({
          userId: currentUser._id,
          postId: post._id,
        });

        const updatedPost = await Post.findByIdAndUpdate(
          post._id,
          { $inc: { likesCount: 1 } },
          { new: true }
        );

        // Send like notification to post author
        createNotification({
          recipientId: post.authorId.toString(),
          senderId: currentUser._id,
          type: 'like_post',
          postId: post._id.toString(),
        }).catch((e) => console.error('Notification error:', e));

        return NextResponse.json({
          isLiked: true,
          likesCount: updatedPost?.likesCount || 1,
        });
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 11000) {
          // Already liked
          return NextResponse.json({
            isLiked: true,
            likesCount: post.likesCount,
          });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Like toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to update like status.' },
      { status: 500 }
    );
  }
}

