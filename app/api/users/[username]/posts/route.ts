import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Post from '@/models/Post';
import Like from '@/models/Like';
import Save from '@/models/Save';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await props.params;
    const normalizedUsername = username.toLowerCase().trim();

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10), 1), 30);

    await connectToDatabase();

    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const query: Record<string, unknown> = { authorId: user._id };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

    const currentUser = await getCurrentUser();
    let likedPostIds = new Set<string>();
    let savedPostIds = new Set<string>();

    if (currentUser && items.length > 0) {
      const itemIds = items.map((p) => p._id);
      const [likes, saves] = await Promise.all([
        Like.find({ userId: currentUser._id, postId: { $in: itemIds } }).select('postId').lean(),
        Save.find({ userId: currentUser._id, postId: { $in: itemIds } }).select('postId').lean(),
      ]);

      likedPostIds = new Set(likes.map((l) => l.postId.toString()));
      savedPostIds = new Set(saves.map((s) => s.postId.toString()));
    }

    const formattedPosts = items.map((p) => {
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
        isSaved: savedPostIds.has(postIdStr),
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (error) {
    console.error('Fetch user posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user posts.' },
      { status: 500 }
    );
  }
}

