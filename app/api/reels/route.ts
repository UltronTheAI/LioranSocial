import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelLike from '@/models/ReelLike';
import ReelSave from '@/models/ReelSave';
import { getCurrentUser } from '@/lib/auth';
import { createReelSchema } from '@/validators/reel.schema';
import { sendMentionNotifications } from '@/services/notification.service';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createReelSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid reel data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { video, caption } = parseResult.data;

    // Extract @mentions
    const mentionMatches = caption.match(/@([a-zA-Z0-9._]+)/g) || [];
    const mentions = Array.from(
      new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))
    );

    await connectToDatabase();

    const newReel = await Reel.create({
      authorId: currentUser._id,
      video,
      caption,
      mentions,
    });

    // Send mention notifications
    sendMentionNotifications({
      text: caption,
      senderId: currentUser._id,
      type: 'mention_reel',
      reelId: newReel._id.toString(),
    }).catch((e) => console.error('Reel mention notification error:', e));

    return NextResponse.json(
      {
        message: 'Reel created successfully.',
        reel: {
          _id: newReel._id.toString(),
          author: {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
            emailVerified: currentUser.emailVerified,
          },
          video: newReel.video,
          caption: newReel.caption,
          mentions: newReel.mentions,
          likesCount: 0,
          commentsCount: 0,
          savesCount: 0,
          viewsCount: 0,
          isLiked: false,
          isSaved: false,
          createdAt: newReel.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create reel error:', error);
    return NextResponse.json(
      { error: 'Failed to create reel. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '6', 10), 1), 15);

    const currentUser = await getCurrentUser();
    await connectToDatabase();

    const query: Record<string, unknown> = {};
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
    console.error('Fetch reels error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reels.' },
      { status: 500 }
    );
  }
}

