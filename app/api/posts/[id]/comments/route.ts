import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
import CommentLike from '@/models/CommentLike';
import { getCurrentUser } from '@/lib/auth';
import { createNotification, sendMentionNotifications } from '@/services/notification.service';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(id).select('authorId').lean();
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();

    // Fetch all comments (both top-level and replies)
    const rawComments = await Comment.find({ postId: id })
      .sort({ isPinned: -1, createdAt: 1 })
      .limit(150)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    const commentIds = rawComments.map((c) => c._id);
    let likedCommentIds = new Set<string>();

    if (currentUser && commentIds.length > 0) {
      const likes = await CommentLike.find({
        userId: currentUser._id,
        commentId: { $in: commentIds },
      }).select('commentId').lean();
      likedCommentIds = new Set(likes.map((l) => l.commentId.toString()));
    }

    const formattedComments = rawComments
      .filter((c) => c.authorId)
      .map((c) => {
        const author = c.authorId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
          emailVerified?: boolean;
        };
        const isCommentAuthor = currentUser && author._id.toString() === currentUser._id.toString();
        const isPostAuthor = currentUser && post.authorId.toString() === currentUser._id.toString();
        const commentIdStr = c._id.toString();

        return {
          _id: commentIdStr,
          author: {
            _id: author._id.toString(),
            username: author.username,
            displayName: author.displayName,
            avatar: author.avatar || '',
            emailVerified: author.emailVerified || false,
          },
          parentId: c.parentId ? c.parentId.toString() : null,
          text: c.text,
          likesCount: c.likesCount || 0,
          isLiked: likedCommentIds.has(commentIdStr),
          isPinned: Boolean(c.isPinned),
          replyCount: c.replyCount || 0,
          createdAt: c.createdAt,
          canDelete: Boolean(isCommentAuthor || isPostAuthor),
          canPin: Boolean(isPostAuthor),
        };
      });

    return NextResponse.json({
      comments: formattedComments,
      count: formattedComments.length,
    });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments.' },
      { status: 500 }
    );
  }
}

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

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const parentId = body.parentId && Types.ObjectId.isValid(body.parentId) ? body.parentId : null;

    if (!text || text.length > 300) {
      return NextResponse.json(
        { error: 'Comment must be between 1 and 300 characters.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    let parentComment = null;
    if (parentId) {
      parentComment = await Comment.findById(parentId);
      if (!parentComment || parentComment.postId.toString() !== post._id.toString()) {
        return NextResponse.json({ error: 'Parent comment not found.' }, { status: 404 });
      }
    }

    // Create comment
    const comment = new Comment({
      postId: post._id,
      authorId: currentUser._id,
      parentId: parentId ? new Types.ObjectId(parentId) : undefined,
      text,
      likesCount: 0,
      isPinned: false,
      replyCount: 0,
    });
    await comment.save();

    // Atomically increment post comments count
    await Post.findByIdAndUpdate(post._id, {
      $inc: { commentsCount: 1 },
    });

    // If it is a reply, atomically increment parent's replyCount
    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });

      // Send reply notification to parent comment author
      if (parentComment && parentComment.authorId.toString() !== currentUser._id.toString()) {
        createNotification({
          recipientId: parentComment.authorId.toString(),
          senderId: currentUser._id,
          type: 'reply_comment',
          postId: post._id.toString(),
          commentText: comment.text,
        }).catch((e) => console.error('Reply notification error:', e));
      }
    } else {
      // Send comment notification to post author (if not self)
      createNotification({
        recipientId: post.authorId.toString(),
        senderId: currentUser._id,
        type: 'comment_post',
        postId: post._id.toString(),
        commentText: comment.text,
      }).catch((e) => console.error('Comment notification error:', e));
    }

    // Send mention notifications to anyone @mentioned in this comment
    sendMentionNotifications({
      text: comment.text,
      senderId: currentUser._id,
      type: 'mention_comment',
      postId: post._id.toString(),
    }).catch((e) => console.error('Comment mention notification error:', e));

    const isPostAuthor = post.authorId.toString() === currentUser._id.toString();

    return NextResponse.json(
      {
        message: 'Comment added successfully.',
        comment: {
          _id: comment._id.toString(),
          author: {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar || '',
            emailVerified: currentUser.emailVerified || false,
          },
          parentId: parentId ? parentId.toString() : null,
          text: comment.text,
          likesCount: 0,
          isLiked: false,
          isPinned: false,
          replyCount: 0,
          createdAt: comment.createdAt,
          canDelete: true,
          canPin: isPostAuthor,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment.' },
      { status: 500 }
    );
  }
}
