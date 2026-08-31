import React from 'react';
import type { Metadata } from 'next';
import { Types } from 'mongoose';
import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import Post from '@/models/Post';
import { SinglePostClient } from './SinglePostClient';
import { PostCardData } from '@/components/post/PostCard';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return {
      title: 'Post Not Found | LioranSocial',
    };
  }

  await connectToDatabase();

  const post = await Post.findById(id)
    .populate('authorId', 'username displayName avatar emailVerified')
    .lean();

  if (!post) {
    return {
      title: 'Post Not Found | LioranSocial',
    };
  }

  const author = post.authorId as unknown as {
    username?: string;
    displayName?: string;
    avatar?: string;
  };

  const authorName = author?.displayName || 'Creator';
  const authorUsername = author?.username || 'user';
  const captionSnippet = post.caption
    ? post.caption.slice(0, 100) + (post.caption.length > 100 ? '...' : '')
    : 'Photo post on LioranSocial';

  const coverImage = post.images && post.images.length > 0
    ? post.images[0].secureUrl || post.images[0].url
    : '/og-image.png';

  const title = `${authorName} (@${authorUsername}) on LioranSocial: "${captionSnippet}"`;
  const description = post.caption || `See photos and videos from ${authorName} (@${authorUsername}) on LioranSocial.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/post/${id}`,
      siteName: 'LioranSocial',
      type: 'article',
      images: [
        {
          url: coverImage,
          width: post.images?.[0]?.width || 1080,
          height: post.images?.[0]?.height || 1080,
          alt: captionSnippet,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverImage],
    },
  };
}

export default async function SinglePostPage({ params }: Props) {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();

  const post = await Post.findById(id)
    .populate('authorId', 'username displayName avatar emailVerified')
    .lean();

  if (!post) {
    notFound();
  }

  const authorDoc = post.authorId as unknown as {
    _id?: { toString: () => string };
    username?: string;
    displayName?: string;
    avatar?: string;
    emailVerified?: boolean;
  };

  const initialPost: PostCardData = {
    _id: post._id.toString(),
    author: {
      _id: authorDoc?._id ? authorDoc._id.toString() : '',
      username: authorDoc?.username || 'user',
      displayName: authorDoc?.displayName || 'Creator',
      avatar: authorDoc?.avatar || '',
      emailVerified: Boolean(authorDoc?.emailVerified),
    },
    images: (post.images || []).map((img) => ({
      publicId: img.publicId || '',
      url: img.url || '',
      secureUrl: img.secureUrl || img.url || '',
      width: img.width || 1080,
      height: img.height || 1080,
    })),
    caption: post.caption || '',
    mentions: post.mentions || [],
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || 0,
    savesCount: post.savesCount || 0,
    isLiked: false,
    isSaved: false,
    createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : '',
  };

  return <SinglePostClient postId={id} initialPost={JSON.parse(JSON.stringify(initialPost))} />;
}
