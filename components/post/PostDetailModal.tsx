'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  Heart,
  Bookmark,
  Share2,
  Trash2,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';
import { useAuth } from '@/context/AuthContext';
import { PostCardData } from './PostCard';

export interface CommentItem {
  _id: string;
  author: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  text: string;
  createdAt: string | Date;
  canDelete: boolean;
}

export interface PostDetailModalProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
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

export function PostDetailModal({
  postId,
  isOpen,
  onClose,
  onPostDeleted,
}: PostDetailModalProps) {
  const { user: currentUser } = useAuth();

  const [post, setPost] = useState<PostCardData | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchPostDetailsData = useCallback(async () => {
    if (!postId || !isOpen) return { post: null, comments: [] };
    try {
      const [postRes, commentsRes] = await Promise.all([
        fetch(`/api/posts/${postId}`),
        fetch(`/api/posts/${postId}/comments`),
      ]);

      let fetchedPost = null;
      let fetchedComments: CommentItem[] = [];

      if (postRes.ok) {
        const postData = await postRes.json();
        fetchedPost = postData.post;
      }
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        fetchedComments = commentsData.comments || [];
      }

      return { post: fetchedPost, comments: fetchedComments };
    } catch (e) {
      console.error('Fetch post details error:', e);
      return { post: null, comments: [] };
    }
  }, [postId, isOpen]);

  const refreshPostDetails = useCallback(async () => {
    const res = await fetchPostDetailsData();
    if (res.post) {
      setPost(res.post);
      setComments(res.comments);
    }
  }, [fetchPostDetailsData]);

  useEffect(() => {
    let isMounted = true;
    if (postId && isOpen) {
      fetchPostDetailsData().then((res) => {
        if (isMounted) {
          setPost(res.post);
          setComments(res.comments);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [postId, isOpen, fetchPostDetailsData]);

  // Like Toggle
  const handleToggleLike = async () => {
    if (!currentUser || !post) return;

    const nextLiked = !post.isLiked;
    const nextCount = nextLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1);

    setPost({ ...post, isLiked: nextLiked, likesCount: nextCount });

    try {
      const res = await fetch(`/api/posts/${post._id}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPost((prev) => (prev ? { ...prev, isLiked: data.isLiked, likesCount: data.likesCount } : null));
      }
    } catch {
      refreshPostDetails();
    }
  };

  // Save Toggle
  const handleToggleSave = async () => {
    if (!currentUser || !post) return;
    const nextSaved = !post.isSaved;
    setPost({ ...post, isSaved: nextSaved });

    try {
      const res = await fetch(`/api/posts/${post._id}/save`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPost((prev) => (prev ? { ...prev, isSaved: data.isSaved } : null));
      }
    } catch {
      refreshPostDetails();
    }
  };

  // Submit Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !post || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${post._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }),
      });

      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setPost((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null));
        setCommentText('');
      }
    } catch (e) {
      console.error('Submit comment error:', e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    try {
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        setPost((prev) => (prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : null));
      }
    } catch (e) {
      console.error('Delete comment error:', e);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    if (!post) return;
    const postUrl = `${window.location.origin}/u/${post.author.username}#${post._id}`;
    navigator.clipboard.writeText(postUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Delete Post
  const handleDeletePost = async () => {
    if (!post || !confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${post._id}`, { method: 'DELETE' });
      if (res.ok) {
        if (onPostDeleted) onPostDeleted(post._id);
        onClose();
      }
    } catch (e) {
      console.error('Delete post error:', e);
    }
  };

  if (!isOpen) return null;

  const isAuthor = currentUser && post && currentUser._id.toString() === post.author._id.toString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-30 p-1.5 rounded-full bg-black/60 hover:bg-black text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="w-full h-80 md:h-[550px] flex items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !post ? (
          <div className="p-8 text-center text-zinc-400 w-full">Post not found.</div>
        ) : (
          <>
            {/* Left: Images Carousel */}
            <div className="w-full md:w-3/5 bg-black flex items-center justify-center">
              <ImageCarousel images={post.images} onDoubleTap={handleToggleLike} />
            </div>

            {/* Right: Author, Caption, Comments & Interaction */}
            <div className="w-full md:w-2/5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#27272a] bg-[#121215]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
                <Link
                  href={`/u/${post.author.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 group min-w-0"
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                    {post.author.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
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

                {isAuthor && (
                  <button
                    onClick={handleDeletePost}
                    title="Delete post"
                    className="p-1.5 text-zinc-400 hover:text-rose-400 mr-8 md:mr-0 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Comments Thread & Caption */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-64 md:max-h-[360px]">
                {/* Author Caption */}
                {post.caption && (
                  <div className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white">
                      {post.author.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        post.author.displayName?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <p>
                        <Link
                          href={`/u/${post.author.username}`}
                          onClick={onClose}
                          className="font-semibold text-white hover:underline mr-1.5"
                        >
                          {post.author.username}
                        </Link>
                        <span className="text-zinc-200">{post.caption}</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">{timeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                )}

                {/* Comments List */}
                {comments.map((comment) => (
                  <div key={comment._id} className="flex items-start justify-between gap-3 text-xs group">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white">
                        {comment.author.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={comment.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          comment.author.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="leading-relaxed">
                          <Link
                            href={`/u/${comment.author.username}`}
                            onClick={onClose}
                            className="font-semibold text-white hover:underline mr-1.5"
                          >
                            {comment.author.username}
                          </Link>
                          <span className="text-zinc-200">{comment.text}</span>
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{timeAgo(comment.createdAt)}</p>
                      </div>
                    </div>

                    {comment.canDelete && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {comments.length === 0 && !post.caption && (
                  <p className="text-xs text-zinc-500 text-center py-6">No comments yet.</p>
                )}
              </div>

              {/* Action Buttons & Likes Summary */}
              <div className="border-t border-[#27272a] p-4 bg-[#0e0e11] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleLike}
                      className={`p-1 -ml-1 transition-transform active:scale-125 focus:outline-none ${
                        post.isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="p-1 text-zinc-300 hover:text-white transition-colors"
                      title="Share link"
                    >
                      {isCopied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
                    </button>
                  </div>

                  <button
                    onClick={handleToggleSave}
                    className={`p-1 -mr-1 transition-colors ${
                      post.isSaved ? 'text-white fill-white' : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Bookmark className={`w-6 h-6 ${post.isSaved ? 'fill-white' : ''}`} />
                  </button>
                </div>

                {post.likesCount > 0 && (
                  <p className="text-xs font-semibold text-white">
                    {post.likesCount.toLocaleString()} {post.likesCount === 1 ? 'like' : 'likes'}
                  </p>
                )}
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{timeAgo(post.createdAt)}</p>

                {/* Comment Input */}
                {currentUser && (
                  <form onSubmit={handleAddComment} className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none border-b border-[#27272a] pb-1.5 focus:border-zinc-400 transition-colors"
                      maxLength={300}
                      disabled={isSubmittingComment}
                    />
                    {commentText.trim().length > 0 && (
                      <button
                        type="submit"
                        disabled={isSubmittingComment}
                        className="text-xs font-semibold text-white hover:text-zinc-300 disabled:opacity-50 transition-colors"
                      >
                        {isSubmittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
