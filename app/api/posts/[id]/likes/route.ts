import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Like from '@/models/Like';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
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

    const post = await Post.findById(id).select('authorId').lean();
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Only the author can view the detailed list of people who liked
    if (post.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'Only the author of this post can view the detailed likes list.' },
        { status: 403 }
      );
    }

    const likes = await Like.find({ postId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .populate('userId', 'username displayName avatar bio emailVerified')
      .lean();

    const formattedLikes = likes
      .filter((l) => l.userId)
      .map((l) => {
        const u = l.userId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
          bio?: string;
          emailVerified?: boolean;
        };
        return {
          _id: u._id.toString(),
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar || '',
          bio: u.bio || '',
          emailVerified: u.emailVerified || false,
          likedAt: l.createdAt,
        };
      });

    return NextResponse.json({
      likes: formattedLikes,
      count: formattedLikes.length,
    });
  } catch (error) {
    console.error('Fetch post likes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch likes list.' },
      { status: 500 }
    );
  }
}

