import React from 'react';
import type { Metadata } from 'next';
import { Types } from 'mongoose';
import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import Reel from '@/models/Reel';
import { SingleReelClient } from './SingleReelClient';
import { ReelData } from '@/components/reel/ReelPlayer';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return {
      title: 'Reel Not Found | LioranSocial',
    };
  }

  await connectToDatabase();

  const reel = await Reel.findById(id)
    .populate('authorId', 'username displayName avatar emailVerified')
    .lean();

  if (!reel) {
    return {
      title: 'Reel Not Found | LioranSocial',
    };
  }

  const author = reel.authorId as unknown as {
    username?: string;
    displayName?: string;
    avatar?: string;
  };

  const authorName = author?.displayName || 'Creator';
  const authorUsername = author?.username || 'user';
  const captionSnippet = reel.caption
    ? reel.caption.slice(0, 100) + (reel.caption.length > 100 ? '...' : '')
    : 'Reel video on LioranSocial';

  const coverImage = reel.video?.thumbnail || '/og-image.png';
  const videoUrl = reel.video?.secureUrl || reel.video?.url;

  const title = `${authorName} (@${authorUsername}) on LioranSocial: "${captionSnippet}"`;
  const description = reel.caption || `Watch this vertical reel video from ${authorName} (@${authorUsername}) on LioranSocial.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/reels/${id}`,
      siteName: 'LioranSocial',
      type: 'video.other',
      images: [
        {
          url: coverImage,
          width: reel.video?.width || 720,
          height: reel.video?.height || 1280,
          alt: captionSnippet,
        },
      ],
      videos: videoUrl
        ? [
            {
              url: videoUrl,
              secureUrl: videoUrl,
              type: 'video/mp4',
              width: reel.video?.width || 720,
              height: reel.video?.height || 1280,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [coverImage],
      players: videoUrl
        ? [
            {
              playerUrl: videoUrl,
              streamUrl: videoUrl,
              width: reel.video?.width || 720,
              height: reel.video?.height || 1280,
            },
          ]
        : undefined,
    },
  };
}

export default async function SingleReelPage({ params }: Props) {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();

  const reel = await Reel.findById(id)
    .populate('authorId', 'username displayName avatar emailVerified')
    .lean();

  if (!reel) {
    notFound();
  }

  const authorDoc = reel.authorId as unknown as {
    _id?: { toString: () => string };
    username?: string;
    displayName?: string;
    avatar?: string;
    emailVerified?: boolean;
  };

  const initialReel: ReelData = {
    _id: reel._id.toString(),
    author: {
      _id: authorDoc?._id ? authorDoc._id.toString() : '',
      username: authorDoc?.username || 'user',
      displayName: authorDoc?.displayName || 'Creator',
      avatar: authorDoc?.avatar || '',
      emailVerified: Boolean(authorDoc?.emailVerified),
    },
    video: {
      publicId: reel.video?.publicId || '',
      url: reel.video?.url || '',
      secureUrl: reel.video?.secureUrl || reel.video?.url || '',
      thumbnail: reel.video?.thumbnail || '',
      duration: reel.video?.duration || 0,
      width: reel.video?.width || 720,
      height: reel.video?.height || 1280,
    },
    caption: reel.caption || '',
    mentions: reel.mentions || [],
    likesCount: reel.likesCount || 0,
    commentsCount: reel.commentsCount || 0,
    savesCount: reel.savesCount || 0,
    viewsCount: reel.viewsCount || 0,
    isLiked: false,
    isSaved: false,
    createdAt: reel.createdAt ? new Date(reel.createdAt).toISOString() : '',
  };

  return <SingleReelClient reelId={id} initialReel={JSON.parse(JSON.stringify(initialReel))} />;
}
