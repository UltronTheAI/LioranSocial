import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelView from '@/models/ReelView';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid reel ID' }, { status: 400 });
    }

    const ipAddress =
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const currentUser = await getCurrentUser();

    await connectToDatabase();

    const reel = await Reel.findById(id);
    if (!reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    // Check for recent view (1-hour cooldown prevention)
    const query: Record<string, unknown> = { reelId: reel._id };
    if (currentUser) {
      query.userId = currentUser._id;
    } else {
      query.ipAddress = ipAddress;
    }

    const existingView = await ReelView.findOne(query);

    if (!existingView) {
      // Record view in ReelView with TTL
      await ReelView.create({
        reelId: reel._id,
        userId: currentUser ? currentUser._id : undefined,
        ipAddress,
      });

      // Increment viewsCount atomically
      const updatedReel = await Reel.findByIdAndUpdate(
        reel._id,
        { $inc: { viewsCount: 1 } },
        { new: true }
      );

      return NextResponse.json({
        success: true,
        viewsCount: updatedReel?.viewsCount || 1,
      });
    }

    return NextResponse.json({
      success: true,
      viewsCount: reel.viewsCount,
    });
  } catch (error) {
    console.error('Reel view record error:', error);
    return NextResponse.json(
      { error: 'Failed to record view.' },
      { status: 500 }
    );
  }
}

