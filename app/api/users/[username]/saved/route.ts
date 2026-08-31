import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Save from '@/models/Save';
import Like from '@/models/Like';
import ReelSave from '@/models/ReelSave';
import ReelLike from '@/models/ReelLike';
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

    // Saved items are private to the account owner
    if (currentUser.username !== normalizedUsername) {
      return NextResponse.json(
        { error: 'You are not authorized to view saved items for this user.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // 1. Fetch saved posts
    const savedPostsDocs = await Save.find({ userId: currentUser._id })
      .sort({ _id: -1 })
      .limit(50)
      .populate({
        path: 'postId',
        populate: {
          path: 'authorId',
          select: 'username displayName avatar emailVerified',
        },
      })
      .lean();

    const validPosts = savedPostsDocs
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
    const postLikes = await Like.find({
      userId: new Types.ObjectId(currentUser._id),
      postId: { $in: postIds },
    }).select('postId').lean();
    const likedPostIds = new Set(postLikes.map((l) => l.postId.toString()));

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

    // 2. Fetch saved reels
    const savedReelsDocs = await ReelSave.find({ userId: currentUser._id })
      .sort({ _id: -1 })
      .limit(50)
      .populate({
        path: 'reelId',
        populate: {
          path: 'authorId',
          select: 'username displayName avatar emailVerified',
        },
      })
      .lean();

    const validReels = savedReelsDocs
      .filter((s) => s.reelId)
      .map((s) => s.reelId as unknown as {
        _id: Types.ObjectId;
        authorId: unknown;
        video: { url: string; secureUrl: string; thumbnail?: string; width?: number; height?: number; duration?: number };
        caption: string;
        mentions: string[];
        likesCount: number;
        commentsCount: number;
        savesCount: number;
        viewsCount: number;
        createdAt: Date;
      });

    const reelIds = validReels.map((r) => r._id);
    const reelLikes = await ReelLike.find({
      userId: new Types.ObjectId(currentUser._id),
      reelId: { $in: reelIds },
    }).select('reelId').lean();
    const likedReelIds = new Set(reelLikes.map((l) => l.reelId.toString()));

    const formattedReels = validReels.map((r) => {
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
        isSaved: true,
        createdAt: r.createdAt,
      };
    });

    return NextResponse.json({
      posts: formattedPosts,
      reels: formattedReels,
    });
  } catch (error) {
    console.error('Fetch saved items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved items.' },
      { status: 500 }
    );
  }
}
