import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelComment from '@/models/ReelComment';
import { getCurrentUser } from '@/lib/auth';
import { createReelCommentSchema } from '@/validators/reel.schema';

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

    const comments = await ReelComment.find({ reelId: id })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    const formattedComments = comments
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

        return {
          _id: c._id.toString(),
          author: {
            _id: author._id.toString(),
            username: author.username,
            displayName: author.displayName,
            avatar: author.avatar || '',
            emailVerified: author.emailVerified || false,
          },
          text: c.text,
          createdAt: c.createdAt,
          canDelete: Boolean(isCommentAuthor || isReelAuthor),
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
    const parseResult = createReelCommentSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid comment text';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    await connectToDatabase();

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const comment = await ReelComment.create({
      reelId: reel._id,
      authorId: currentUser._id,
      text: parseResult.data.text,
    });

    await Reel.findByIdAndUpdate(reel._id, {
      $inc: { commentsCount: 1 },
    });

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
          text: comment.text,
          createdAt: comment.createdAt,
          canDelete: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create reel comment error:', error);
    return NextResponse.json(
      { error: 'Failed to add reel comment.' },
      { status: 500 }
    );
  }
}

