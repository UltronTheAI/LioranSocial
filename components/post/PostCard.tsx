'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  Trash2,
  Check,
  Send,
} from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';
import { useAuth } from '@/context/AuthContext';
import { IPostImage } from '@/models/Post';

export interface PostCardData {
  _id: string;
  author: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  images: IPostImage[];
  caption: string;
  mentions?: string[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string | Date;
}

export interface PostCardProps {
  post: PostCardData;
  onOpenComments?: (postId: string) => void;
  onPostDeleted?: (postId: string) => void;
}

function timeAgo(dateInput: string | Date): string {
  const now = new Date();
  const date = new Date(dateInput);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return `${Math.floor(diffInSeconds / 604800)}w`;
}

export function PostCard({ post, onOpenComments, onPostDeleted }: PostCardProps) {
  const { user: currentUser } = useAuth();

  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const isAuthor = currentUser && currentUser._id.toString() === post.author._id.toString();

  // Like Toggle
  const handleToggleLike = async () => {
    if (!currentUser) return;

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/posts/${post._id}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsLiked(data.isLiked);
        setLikesCount(data.likesCount);
      }
    } catch {
      // Revert on failure
      setIsLiked(!nextLiked);
      setLikesCount((prev) => (!nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  // Double tap to like
  const handleDoubleTap = () => {
    if (!isLiked) {
      handleToggleLike();
    }
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 800);
  };

  // Save / Bookmark Toggle
  const handleToggleSave = async () => {
    if (!currentUser) return;

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      const res = await fetch(`/api/posts/${post._id}/save`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsSaved(data.isSaved);
      }
    } catch {
      setIsSaved(!nextSaved);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/u/${post.author.username}#${post._id}`;
    navigator.clipboard.writeText(postUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    setIsMenuOpen(false);
  };

  // Delete Post
  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${post._id}`, { method: 'DELETE' });
      if (res.ok && onPostDeleted) {
        onPostDeleted(post._id);
      }
    } catch (e) {
      console.error('Delete post failed:', e);
    }
  };

  // Inline Quick Comment
  const handleInlineComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${post._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }),
      });

      if (res.ok) {
        setCommentText('');
        setCommentsCount((prev) => prev + 1);
        if (onOpenComments) {
          onOpenComments(post._id);
        }
      }
    } catch (e) {
      console.error('Add comment error:', e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <article className="w-full max-w-lg mx-auto bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-lg shadow-black/40">
      {/* ===================================================================== */}
      {/* Post Header: Author info & options menu */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#27272a]/60">
        <Link href={`/u/${post.author.username}`} className="flex items-center gap-3 group min-w-0">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
            {post.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author.avatar} alt={post.author.displayName} className="w-full h-full object-cover" />
            ) : (
              post.author.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate group-hover:underline">
              {post.author.displayName}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">@{post.author.username}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">{timeAgo(post.createdAt)}</span>
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  {isCopied ? 'Link Copied!' : 'Copy Link'}
                </button>
                {isAuthor && (
                  <button
                    onClick={handleDeletePost}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Image Carousel with Double-Tap Heart Animation */}
      {/* ===================================================================== */}
      <div className="relative">
        <ImageCarousel images={post.images} onDoubleTap={handleDoubleTap} />

        {/* Floating animated heart on double tap */}
        {showHeartPop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
            <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl opacity-90 scale-110 transition-transform" />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* Action Buttons Row */}
      {/* ===================================================================== */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleLike}
            className={`p-1 -ml-1 transition-transform active:scale-125 focus:outline-none ${
              isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-300 hover:text-white'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          <button
            onClick={() => onOpenComments && onOpenComments(post._id)}
            className="p-1 text-zinc-300 hover:text-white transition-colors focus:outline-none"
            aria-label="View comments"
          >
            <MessageCircle className="w-6 h-6" />
          </button>

          <button
            onClick={handleCopyLink}
            className="p-1 text-zinc-300 hover:text-white transition-colors focus:outline-none"
            title="Share post"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={handleToggleSave}
          className={`p-1 -mr-1 transition-colors focus:outline-none ${
            isSaved ? 'text-white fill-white' : 'text-zinc-300 hover:text-white'
          }`}
          aria-label={isSaved ? 'Remove Bookmark' : 'Bookmark'}
        >
          <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* ===================================================================== */}
      {/* Likes Count & Caption & Comments */}
      {/* ===================================================================== */}
      <div className="px-4 py-2 space-y-1.5 text-xs">
        {likesCount > 0 && (
          <p className="font-semibold text-white">
            {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {post.caption && (
          <div className="text-zinc-200 leading-relaxed">
            <Link href={`/u/${post.author.username}`} className="font-semibold text-white hover:underline mr-1.5">
              {post.author.username}
            </Link>
            <span>
              {post.caption.length > 120 && !isExpanded
                ? `${post.caption.slice(0, 120)}...`
                : post.caption}
            </span>
            {post.caption.length > 120 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-zinc-400 hover:text-white ml-1 font-medium focus:outline-none"
              >
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* View Comments Link */}
        {commentsCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenComments && onOpenComments(post._id)}
            className="text-zinc-400 hover:text-zinc-200 block pt-0.5"
          >
            View all {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* Inline Quick Comment Input */}
      {/* ===================================================================== */}
      {currentUser && (
        <form
          onSubmit={handleInlineComment}
          className="border-t border-[#27272a]/60 px-4 py-2.5 flex items-center gap-2 bg-[#0e0e11]"
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            maxLength={300}
            disabled={isSubmittingComment}
          />
          {commentText.trim().length > 0 && (
            <button
              type="submit"
              disabled={isSubmittingComment}
              className="text-xs font-semibold text-white hover:text-zinc-300 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      )}
    </article>
  );
}

