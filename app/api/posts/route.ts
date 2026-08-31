import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import User from '@/models/User';
import Follow from '@/models/Follow';
import Like from '@/models/Like';
import Save from '@/models/Save';
import { getCurrentUser } from '@/lib/auth';
import { createPostSchema } from '@/validators/post.schema';
import { sendMentionNotifications } from '@/services/notification.service';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createPostSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid post data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { images, caption } = parseResult.data;

    // Extract @mentions from caption
    const mentionMatches = caption.match(/@([a-zA-Z0-9._]+)/g) || [];
    const mentions = Array.from(
      new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))
    );

    await connectToDatabase();

    // Create post in MongoDB
    const newPost = await Post.create({
      authorId: currentUser._id,
      images,
      caption,
      mentions,
    });

    // Atomically increment author's post count
    await User.findByIdAndUpdate(currentUser._id, {
      $inc: { postsCount: 1 },
    });

    // Send mention notifications to tagged users
    sendMentionNotifications({
      text: caption,
      senderId: currentUser._id,
      type: 'mention_post',
      postId: newPost._id.toString(),
    }).catch((e) => console.error('Mention notification error:', e));

    return NextResponse.json(
      {
        message: 'Post created successfully.',
        post: {
          _id: newPost._id.toString(),
          author: {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
            emailVerified: currentUser.emailVerified,
          },
          images: newPost.images,
          caption: newPost.caption,
          mentions: newPost.mentions,
          likesCount: 0,
          commentsCount: 0,
          savesCount: 0,
          isLiked: false,
          isSaved: false,
          createdAt: newPost.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 30);

    const currentUser = await getCurrentUser();
    await connectToDatabase();

    const query: Record<string, unknown> = {};

    if (currentUser) {
      // Find list of users that currentUser is following
      const followDocs = await Follow.find({ followerId: currentUser._id })
        .select('followingId')
        .lean();

      const followingIds = followDocs.map((f) => f.followingId);
      // Include current user's own posts as well
      followingIds.push(new Types.ObjectId(currentUser._id));

      if (followingIds.length > 1) {
        // User follows others -> fetch posts by followed users + self
        query.authorId = { $in: followingIds };
      }
      // If user follows no one else, query will return recent community posts so feed is not empty
    }

    // Apply cursor-based pagination
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

    // Check likes and saves if viewer is logged in
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
    console.error('Fetch feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed posts.' },
      { status: 500 }
    );
  }
}
