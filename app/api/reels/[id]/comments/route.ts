import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelComment from '@/models/ReelComment';
import ReelCommentLike from '@/models/ReelCommentLike';
import { getCurrentUser } from '@/lib/auth';
import { createNotification, sendMentionNotifications } from '@/services/notification.service';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid reel ID' }, { status: 400 });
    }

    await connectToDatabase();

    const reel = await Reel.findById(id).select('authorId').lean();
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();

    // Fetch all comments sorted by pinned first, then chronological
    const rawComments = await ReelComment.find({ reelId: id })
      .sort({ isPinned: -1, createdAt: 1 })
      .limit(150)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    const commentIds = rawComments.map((c) => c._id);
    let likedCommentIds = new Set<string>();

    if (currentUser && commentIds.length > 0) {
      const likes = await ReelCommentLike.find({
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
        const isReelAuthor = currentUser && reel.authorId.toString() === currentUser._id.toString();
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
          canDelete: Boolean(isCommentAuthor || isReelAuthor),
          canPin: Boolean(isReelAuthor),
        };
      });

    return NextResponse.json({
      comments: formattedComments,
      count: formattedComments.length,
    });
  } catch (error) {
    console.error('Fetch reel comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reel comments.' },
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
      return NextResponse.json({ error: 'Invalid reel ID' }, { status: 400 });
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

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    let parentComment = null;
    if (parentId) {
      parentComment = await ReelComment.findById(parentId);
      if (!parentComment || parentComment.reelId.toString() !== reel._id.toString()) {
        return NextResponse.json({ error: 'Parent comment not found.' }, { status: 404 });
      }
    }

    // Create reel comment
    const comment = new ReelComment({
      reelId: reel._id,
      authorId: currentUser._id,
      parentId: parentId ? new Types.ObjectId(parentId) : undefined,
      text,
      likesCount: 0,
      isPinned: false,
      replyCount: 0,
    });
    await comment.save();

    // Atomically increment reel comments count
    await Reel.findByIdAndUpdate(reel._id, {
      $inc: { commentsCount: 1 },
    });

    // If it is a reply, increment parent replyCount
    if (parentId) {
      await ReelComment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });

      // Send reply notification
      if (parentComment && parentComment.authorId.toString() !== currentUser._id.toString()) {
        createNotification({
          recipientId: parentComment.authorId.toString(),
          senderId: currentUser._id,
          type: 'reply_comment',
          reelId: reel._id.toString(),
          commentText: comment.text,
        }).catch((e) => console.error('Reel reply notification error:', e));
      }
    } else {
      // Send comment notification to reel author
      createNotification({
        recipientId: reel.authorId.toString(),
        senderId: currentUser._id,
        type: 'comment_reel',
        reelId: reel._id.toString(),
        commentText: comment.text,
      }).catch((e) => console.error('Reel comment notification error:', e));
    }

    // Send mention notifications for @mentions
    sendMentionNotifications({
      text: comment.text,
      senderId: currentUser._id,
      type: 'mention_comment',
      reelId: reel._id.toString(),
    }).catch((e) => console.error('Reel comment mention notification error:', e));

    const isReelAuthor = reel.authorId.toString() === currentUser._id.toString();

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
          canPin: isReelAuthor,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create reel comment error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment.' },
      { status: 500 }
    );
  }
}
