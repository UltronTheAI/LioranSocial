import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelLike from '@/models/ReelLike';
import ReelSave from '@/models/ReelSave';
import ReelComment from '@/models/ReelComment';
import ReelView from '@/models/ReelView';
import { getCurrentUser } from '@/lib/auth';

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

    const reel = await Reel.findById(id)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();
    let isLiked = false;
    let isSaved = false;

    if (currentUser) {
      const [likeDoc, saveDoc] = await Promise.all([
        ReelLike.findOne({ userId: currentUser._id, reelId: reel._id }),
        ReelSave.findOne({ userId: currentUser._id, reelId: reel._id }),
      ]);
      isLiked = Boolean(likeDoc);
      isSaved = Boolean(saveDoc);
    }

    return NextResponse.json({
      reel: {
        _id: reel._id.toString(),
        author: reel.authorId,
        video: reel.video,
        caption: reel.caption,
        mentions: reel.mentions,
        likesCount: reel.likesCount || 0,
        commentsCount: reel.commentsCount || 0,
        savesCount: reel.savesCount || 0,
        viewsCount: reel.viewsCount || 0,
        isLiked,
        isSaved,
        createdAt: reel.createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch reel error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reel.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 500) : '';

    await connectToDatabase();

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    if (reel.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to edit this reel.' },
        { status: 403 }
      );
    }

    // Extract mentions
    const rawMentions: string[] = (caption.match(/@([a-zA-Z0-9_]+)/g) || []).map(
      (m: string) => m.substring(1).toLowerCase()
    );
    const mentions: string[] = Array.from(new Set(rawMentions));

    reel.caption = caption;
    reel.mentions = mentions;
    await reel.save();

    return NextResponse.json({
      message: 'Reel updated successfully.',
      reel: {
        _id: reel._id.toString(),
        caption: reel.caption,
        mentions: reel.mentions,
      },
    });
  } catch (error) {
    console.error('Edit reel error:', error);
    return NextResponse.json({ error: 'Failed to update reel.' }, { status: 500 });
  }
}

export async function DELETE(
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

    await connectToDatabase();

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    if (reel.authorId.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this reel.' },
        { status: 403 }
      );
    }

    await Reel.deleteOne({ _id: reel._id });

    // Clean up related documents
    await Promise.all([
      ReelLike.deleteMany({ reelId: reel._id }),
      ReelSave.deleteMany({ reelId: reel._id }),
      ReelComment.deleteMany({ reelId: reel._id }),
      ReelView.deleteMany({ reelId: reel._id }),
    ]);

    return NextResponse.json({
      message: 'Reel deleted successfully.',
    });
  } catch (error) {
    console.error('Delete reel error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reel.' },
      { status: 500 }
    );
  }
}
