import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryView from '@/models/StoryView';
import StoryLike from '@/models/StoryLike';
import Follow from '@/models/Follow';
import { getCurrentUser } from '@/lib/auth';
import { createStorySchema } from '@/validators/story.schema';
import { emitSocketEvent } from '@/lib/socket-server';
import { createNotification } from '@/services/notification.service';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createStorySchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid story data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { media, mediaType, sharedContent } = parseResult.data;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours lifetime

    await connectToDatabase();

    const newStory = await Story.create({
      authorId: currentUser._id,
      media,
      mediaType,
      sharedContent: sharedContent
        ? {
            contentType: sharedContent.contentType,
            postId: sharedContent.postId ? new Types.ObjectId(sharedContent.postId) : undefined,
            reelId: sharedContent.reelId ? new Types.ObjectId(sharedContent.reelId) : undefined,
            authorUsername: sharedContent.authorUsername,
            authorAvatar: sharedContent.authorAvatar,
          }
        : undefined,
      viewsCount: 0,
      likesCount: 0,
      expiresAt,
    });

    // Notify followers and broadcast story:new in real-time
    Follow.find({ followingId: currentUser._id })
      .select('followerId')
      .lean()
      .then((follows) => {
        follows.forEach((f) => {
          const followerIdStr = f.followerId.toString();
          // Emit real-time story update to follower's room
          emitSocketEvent(`user:${followerIdStr}`, 'story:new', {
            storyId: newStory._id.toString(),
            authorId: currentUser._id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
          });

          // Create notification for follower
          createNotification({
            recipientId: followerIdStr,
            senderId: currentUser._id,
            type: 'new_story',
            storyId: newStory._id.toString(),
          }).catch((err) => console.error('Story notification error:', err));
        });
      })
      .catch((err) => console.error('Fetch followers error for story:', err));

    return NextResponse.json(
      {
        message: 'Story published successfully.',
        story: {
          _id: newStory._id.toString(),
          authorId: currentUser._id,
          media: newStory.media,
          mediaType: newStory.mediaType,
          sharedContent: newStory.sharedContent,
          viewsCount: 0,
          likesCount: 0,
          isLiked: false,
          expiresAt: newStory.expiresAt,
          createdAt: newStory.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Publish story error:', error);
    return NextResponse.json(
      { error: 'Failed to publish story.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    await connectToDatabase();

    const now = new Date();
    let authorIds: Types.ObjectId[] = [];

    if (currentUser) {
      // Find users followed by currentUser + self
      const followDocs = await Follow.find({ followerId: currentUser._id })
        .select('followingId')
        .lean();

      authorIds = followDocs.map((f) => f.followingId);
      authorIds.push(new Types.ObjectId(currentUser._id));
    }

    const query: Record<string, unknown> = {
      expiresAt: { $gt: now },
    };

    if (authorIds.length > 0) {
      query.authorId = { $in: authorIds };
    }

    // Fetch active stories
    const activeStories = await Story.find(query)
      .sort({ createdAt: 1 })
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    // Check which stories viewer has already viewed and liked + accurate view and like counts
    let viewedStoryIds = new Set<string>();
    let likedStoryIds = new Set<string>();
    const viewCountMap = new Map<string, number>();
    const likeCountMap = new Map<string, number>();

    if (activeStories.length > 0) {
      const storyIds = activeStories.map((s) => s._id);

      const [viewsAgg, likesAgg] = await Promise.all([
        StoryView.aggregate([
          { $match: { storyId: { $in: storyIds } } },
          { $group: { _id: '$storyId', count: { $sum: 1 } } },
        ]),
        StoryLike.aggregate([
          { $match: { storyId: { $in: storyIds } } },
          { $group: { _id: '$storyId', count: { $sum: 1 } } },
        ]),
      ]);

      viewsAgg.forEach((v) => viewCountMap.set(v._id.toString(), v.count));
      likesAgg.forEach((l) => likeCountMap.set(l._id.toString(), l.count));

      if (currentUser) {
        const userObjId = new Types.ObjectId(currentUser._id.toString());
        const [myViews, myLikes] = await Promise.all([
          StoryView.find({
            viewerId: userObjId,
            storyId: { $in: storyIds },
          }).select('storyId').lean(),
          StoryLike.find({
            userId: userObjId,
            storyId: { $in: storyIds },
          }).select('storyId').lean(),
        ]);

        viewedStoryIds = new Set(myViews.map((v) => v.storyId.toString()));
        likedStoryIds = new Set(myLikes.map((l) => l.storyId.toString()));
      }
    }

    // Group stories by author
    interface AuthorGroup {
      author: {
        _id: string;
        username: string;
        displayName: string;
        avatar?: string;
        emailVerified?: boolean;
      };
      hasUnseen: boolean;
      stories: Array<{
        _id: string;
        media: unknown;
        mediaType: 'image' | 'video';
        sharedContent?: {
          contentType: 'post' | 'reel';
          postId?: string;
          reelId?: string;
          authorUsername: string;
          authorAvatar?: string;
        };
        viewsCount: number;
        likesCount: number;
        hasViewed: boolean;
        isLiked: boolean;
        expiresAt: Date;
        createdAt: Date;
      }>;
    }

    const authorMap = new Map<string, AuthorGroup>();

    activeStories.forEach((story) => {
      if (!story.authorId) return;

      const author = story.authorId as unknown as {
        _id: { toString(): string };
        username: string;
        displayName: string;
        avatar?: string;
        emailVerified?: boolean;
      };
      const authorIdStr = author._id.toString();
      const storyIdStr = story._id.toString();
      const isSelf = currentUser && authorIdStr === currentUser._id.toString();
      const hasViewed = isSelf ? true : viewedStoryIds.has(storyIdStr);
      const isLiked = likedStoryIds.has(storyIdStr);

      const actualViews = viewCountMap.get(storyIdStr) ?? (story.viewsCount || 0);
      const actualLikes = likeCountMap.get(storyIdStr) ?? (story.likesCount || 0);

      if (!authorMap.has(authorIdStr)) {
        authorMap.set(authorIdStr, {
          author: {
            _id: authorIdStr,
            username: author.username,
            displayName: author.displayName,
            avatar: author.avatar || '',
            emailVerified: author.emailVerified || false,
          },
          hasUnseen: !hasViewed,
          stories: [],
        });
      }

      const group = authorMap.get(authorIdStr)!;
      if (!hasViewed) {
        group.hasUnseen = true;
      }

      group.stories.push({
        _id: storyIdStr,
        media: story.media,
        mediaType: story.mediaType,
        sharedContent: story.sharedContent
          ? {
              contentType: story.sharedContent.contentType,
              postId: story.sharedContent.postId?.toString(),
              reelId: story.sharedContent.reelId?.toString(),
              authorUsername: story.sharedContent.authorUsername,
              authorAvatar: story.sharedContent.authorAvatar,
            }
          : undefined,
        viewsCount: actualViews,
        likesCount: actualLikes,
        hasViewed,
        isLiked,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
      });
    });

    const storyGroups = Array.from(authorMap.values());

    // Final pass on hasUnseen to ensure 100% accuracy
    storyGroups.forEach((g) => {
      const isSelf = currentUser && g.author._id === currentUser._id.toString();
      if (isSelf) {
        g.hasUnseen = false;
      } else {
        g.hasUnseen = g.stories.some((s) => !s.hasViewed);
      }
    });

    // Sort story groups:
    // 1. User's own stories first
    // 2. Unseen stories (hasUnseen: true) next, pushed to front
    // 3. Seen stories (hasUnseen: false) last, pushed to back
    if (currentUser) {
      storyGroups.sort((a, b) => {
        const aIsSelf = a.author._id === currentUser._id.toString();
        const bIsSelf = b.author._id === currentUser._id.toString();
        if (aIsSelf) return -1;
        if (bIsSelf) return 1;
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        return 0;
      });
    }

    return NextResponse.json({
      storyGroups,
      count: storyGroups.length,
    });
  } catch (error) {
    console.error('Fetch stories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories.' },
      { status: 500 }
    );
  }
}
