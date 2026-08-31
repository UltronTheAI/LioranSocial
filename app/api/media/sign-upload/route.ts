import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import cloudinary, { isCloudinaryConfigured } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const folder = body.folder || 'lioransocial/reels';
    const timestamp = Math.round(new Date().getTime() / 1000);

    if (!isCloudinaryConfigured) {
      return NextResponse.json({
        configured: false,
        message: 'Cloudinary credentials not set. Falling back to local upload handling.',
      });
    }

    const paramsToSign = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ''
    );

    return NextResponse.json({
      configured: true,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (error) {
    console.error('Sign upload error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature.' },
      { status: 500 }
    );
  }
}

