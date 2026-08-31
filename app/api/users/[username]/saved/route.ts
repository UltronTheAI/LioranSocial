import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Save from '@/models/Save';
import Like from '@/models/Like';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { username } = await props.params;
    const normalizedUsername = username.toLowerCase().trim();

    // Saved posts are private to the account owner
    if (currentUser.username !== normalizedUsername) {
      return NextResponse.json(
        { error: 'You are not authorized to view saved posts for this user.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10), 1), 30);

    await connectToDatabase();

    const query: Record<string, unknown> = { userId: currentUser._id };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const saves = await Save.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
        path: 'postId',
        populate: {
          path: 'authorId',
          select: 'username displayName avatar emailVerified',
        },
      })
      .lean();

    const hasMore = saves.length > limit;
    const items = hasMore ? saves.slice(0, limit) : saves;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

    // Fetch likes for these posts
    const validPosts = items
      .filter((s) => s.postId)
      .map((s) => s.postId as unknown as {
        _id: Types.ObjectId;
        authorId: unknown;
        images: unknown[];
        caption: string;
        mentions: string[];
        likesCount: number;
        commentsCount: number;
        savesCount: number;
        createdAt: Date;
      });

    const postIds = validPosts.map((p) => p._id);
    const likes = await Like.find({
      userId: new Types.ObjectId(currentUser._id),
      postId: { $in: postIds },
    }).select('postId').lean();
    const likedPostIds = new Set(likes.map((l) => l.postId.toString()));

    const formattedPosts = validPosts.map((p) => {
      const postIdStr = p._id.toString();
      return {
        _id: postIdStr,
        author: p.authorId,
        images: p.images,
        caption: p.caption,
        mentions: p.mentions,
        likesCount: p.likesCount || 0,
        commentsCount: p.commentsCount || 0,
        savesCount: p.savesCount || 0,
        isLiked: likedPostIds.has(postIdStr),
        isSaved: true,
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (error) {
    console.error('Fetch saved posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved posts.' },
      { status: 500 }
    );
  }
}
