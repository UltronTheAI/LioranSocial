import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import Save from '@/models/Save';
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
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if save exists
    const existingSave = await Save.findOne({
      userId: currentUser._id,
      postId: post._id,
    });

    if (existingSave) {
      // Unsave
      await Save.deleteOne({ _id: existingSave._id });
      const updatedPost = await Post.findByIdAndUpdate(
        post._id,
        { $inc: { savesCount: -1 } },
        { new: true }
      );

      return NextResponse.json({
        isSaved: false,
        savesCount: Math.max(0, updatedPost?.savesCount || 0),
      });
    } else {
      // Save
      try {
        await Save.create({
          userId: currentUser._id,
          postId: post._id,
        });

        const updatedPost = await Post.findByIdAndUpdate(
          post._id,
          { $inc: { savesCount: 1 } },
          { new: true }
        );

        return NextResponse.json({
          isSaved: true,
          savesCount: updatedPost?.savesCount || 1,
        });
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 11000) {
          return NextResponse.json({
            isSaved: true,
            savesCount: post.savesCount,
          });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Save toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to update save status.' },
      { status: 500 }
    );
  }
}

