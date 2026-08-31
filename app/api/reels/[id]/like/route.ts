import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelLike from '@/models/ReelLike';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/services/notification.service';

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

    await connectToDatabase();

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const existingLike = await ReelLike.findOne({
      userId: currentUser._id,
      reelId: reel._id,
    });

    if (existingLike) {
      await ReelLike.deleteOne({ _id: existingLike._id });
      const updatedReel = await Reel.findByIdAndUpdate(
        reel._id,
        { $inc: { likesCount: -1 } },
        { new: true }
      );

      return NextResponse.json({
        isLiked: false,
        likesCount: Math.max(0, updatedReel?.likesCount || 0),
      });
    } else {
      try {
        await ReelLike.create({
          userId: currentUser._id,
          reelId: reel._id,
        });

        const updatedReel = await Reel.findByIdAndUpdate(
          reel._id,
          { $inc: { likesCount: 1 } },
          { new: true }
        );

        // Send like notification to reel author
        createNotification({
          recipientId: reel.authorId.toString(),
          senderId: currentUser._id,
          type: 'like_reel',
          reelId: reel._id.toString(),
        }).catch((e) => console.error('Notification error:', e));

        return NextResponse.json({
          isLiked: true,
          likesCount: updatedReel?.likesCount || 1,
        });
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 11000) {
          return NextResponse.json({
            isLiked: true,
            likesCount: reel.likesCount,
          });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Reel like error:', error);
    return NextResponse.json(
      { error: 'Failed to update reel like status.' },
      { status: 500 }
    );
  }
}

