import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Reel from '@/models/Reel';
import ReelLike from '@/models/ReelLike';
import ReelSave from '@/models/ReelSave';
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

    const reels = await Reel.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    const hasMore = reels.length > limit;
    const items = hasMore ? reels.slice(0, limit) : reels;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

    const currentUser = await getCurrentUser();
    let likedReelIds = new Set<string>();
    let savedReelIds = new Set<string>();

    if (currentUser && items.length > 0) {
      const itemIds = items.map((r) => r._id);
      const [likes, saves] = await Promise.all([
        ReelLike.find({ userId: currentUser._id, reelId: { $in: itemIds } }).select('reelId').lean(),
        ReelSave.find({ userId: currentUser._id, reelId: { $in: itemIds } }).select('reelId').lean(),
      ]);

      likedReelIds = new Set(likes.map((l) => l.reelId.toString()));
      savedReelIds = new Set(saves.map((s) => s.reelId.toString()));
    }

    const formattedReels = items.map((r) => {
      const reelIdStr = r._id.toString();
      return {
        _id: reelIdStr,
        author: r.authorId,
        video: r.video,
        caption: r.caption,
        mentions: r.mentions,
        likesCount: r.likesCount || 0,
        commentsCount: r.commentsCount || 0,
        savesCount: r.savesCount || 0,
        viewsCount: r.viewsCount || 0,
        isLiked: likedReelIds.has(reelIdStr),
        isSaved: savedReelIds.has(reelIdStr),
        createdAt: r.createdAt,
      };
    });

    return NextResponse.json({
      reels: formattedReels,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (error) {
    console.error('Fetch user reels error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user reels.' },
      { status: 500 }
    );
  }
}

