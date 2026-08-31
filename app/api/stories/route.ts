import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Story from '@/models/Story';
import StoryView from '@/models/StoryView';
import Follow from '@/models/Follow';
import { getCurrentUser } from '@/lib/auth';
import { createStorySchema } from '@/validators/story.schema';

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

    const { media, mediaType } = parseResult.data;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours lifetime

    await connectToDatabase();

    const newStory = await Story.create({
      authorId: currentUser._id,
      media,
      mediaType,
      expiresAt,
    });

    return NextResponse.json(
      {
        message: 'Story published successfully.',
        story: {
          _id: newStory._id.toString(),
          authorId: currentUser._id,
          media: newStory.media,
          mediaType: newStory.mediaType,
          viewsCount: 0,
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

    // Check which stories viewer has already viewed
    let viewedStoryIds = new Set<string>();
    if (currentUser && activeStories.length > 0) {
      const storyIds = activeStories.map((s) => s._id);
      const views = await StoryView.find({
        viewerId: currentUser._id,
        storyId: { $in: storyIds },
      }).select('storyId').lean();

      viewedStoryIds = new Set(views.map((v) => v.storyId.toString()));
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
        viewsCount: number;
        hasViewed: boolean;
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
      const hasViewed = viewedStoryIds.has(storyIdStr);

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
        viewsCount: story.viewsCount || 0,
        hasViewed,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
      });
    });

    const storyGroups = Array.from(authorMap.values());

    // Sort story groups so user's own stories and unseen stories come first
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

