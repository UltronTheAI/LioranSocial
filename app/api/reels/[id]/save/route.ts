import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import ReelSave from '@/models/ReelSave';
import { getCurrentUser } from '@/lib/auth';

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

    const existingSave = await ReelSave.findOne({
      userId: currentUser._id,
      reelId: reel._id,
    });

    if (existingSave) {
      await ReelSave.deleteOne({ _id: existingSave._id });
      const updatedReel = await Reel.findByIdAndUpdate(
        reel._id,
        { $inc: { savesCount: -1 } },
        { new: true }
      );

      return NextResponse.json({
        isSaved: false,
        savesCount: Math.max(0, updatedReel?.savesCount || 0),
      });
    } else {
      try {
        await ReelSave.create({
          userId: currentUser._id,
          reelId: reel._id,
        });

        const updatedReel = await Reel.findByIdAndUpdate(
          reel._id,
          { $inc: { savesCount: 1 } },
          { new: true }
        );

        return NextResponse.json({
          isSaved: true,
          savesCount: updatedReel?.savesCount || 1,
        });
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 11000) {
          return NextResponse.json({
            isSaved: true,
            savesCount: reel.savesCount,
          });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Reel save error:', error);
    return NextResponse.json(
      { error: 'Failed to update reel save status.' },
      { status: 500 }
    );
  }
}

