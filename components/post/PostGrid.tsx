'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Copy, Image as ImageIcon } from 'lucide-react';
import { PostCardData } from './PostCard';

export interface PostGridProps {
  posts: PostCardData[];
  onPostClick?: (post: PostCardData) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function PostGrid({
  posts,
  onPostClick,
  emptyTitle = 'No Posts Yet',
  emptySubtitle = 'Photos and videos will appear here once published.',
}: PostGridProps) {
  if (!posts || posts.length === 0) {
    return (
      <div className="bg-[#121215]/50 border border-dashed border-[#27272a] rounded-2xl py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
          <ImageIcon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">{emptyTitle}</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">{emptySubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
      {posts.map((post) => {
        const coverImage = post.images[0]?.secureUrl || post.images[0]?.url;
        const isMulti = post.images.length > 1;

        return (
          <Link
            key={post._id}
            href={`/post/${post._id}`}
            onClick={(e) => {
              if (onPostClick) {
                e.preventDefault();
                onPostClick(post);
              }
            }}
            className="relative aspect-square bg-[#121215] border border-[#27272a]/60 rounded-lg sm:rounded-xl overflow-hidden cursor-pointer group block"
          >
            {/* Thumbnail Image */}
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt="Post thumbnail"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}

            {/* Multi-Photo Badge */}
            {isMulti && (
              <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white shadow-md">
                <Copy className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Hover Overlay with Likes & Comments Count */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 sm:gap-6 text-white font-semibold text-xs sm:text-sm">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 fill-white text-white" />
                <span>{post.likesCount || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 fill-white text-white" />
                <span>{post.commentsCount || 0}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

