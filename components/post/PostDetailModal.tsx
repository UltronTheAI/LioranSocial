'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  X,
  Heart,
  Bookmark,
  Share2,
  Trash2,
  Edit2,
  Pin,
  Send,
  Loader2,
  CornerDownRight,
} from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';
import { useAuth } from '@/context/AuthContext';
import { PostCardData } from './PostCard';
import { ShareToChatModal } from '@/components/messages/ShareToChatModal';
import { LikesListModal } from './LikesListModal';
import { syncPostUpdate, syncPostDeleted } from '@/lib/storage-cache';

export interface CommentItem {
  _id: string;
  author: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  parentId: string | null;
  text: string;
  likesCount: number;
  isLiked: boolean;
  isPinned: boolean;
  replyCount: number;
  createdAt: string | Date;
  canDelete: boolean;
  canPin: boolean;
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

function renderTextWithMentions(text: string, onLinkClick?: () => void) {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link
          key={index}
          href={`/u/${username}`}
          onClick={onLinkClick}
          className="text-blue-400 hover:underline font-semibold"
        >
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Reply and Threading state
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // Edit Caption state
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaptionValue, setEditCaptionValue] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);

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
      setEditCaptionValue(res.post.caption);
      setComments(res.comments);
    }
  }, [fetchPostDetailsData]);

  useEffect(() => {
    let isMounted = true;
    if (postId && isOpen) {
      fetchPostDetailsData().then((res) => {
        if (isMounted) {
          setPost(res.post);
          if (res.post) setEditCaptionValue(res.post.caption);
          setComments(res.comments);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [postId, isOpen, fetchPostDetailsData]);

  // Jam background page scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const isPushedRef = useRef(false);

  // Android & Browser Hardware Back button support (Closes post modal instantly on Back)
  useEffect(() => {
    if (!isOpen) {
      isPushedRef.current = false;
      return;
    }

    // Push history state exactly ONCE when opened
    if (!isPushedRef.current && typeof window !== 'undefined') {
      window.history.pushState({ modal: 'post-detail' }, '');
      isPushedRef.current = true;
    }

    const handlePopState = () => {
      isPushedRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleSafeClose = useCallback(() => {
    if (isPushedRef.current && typeof window !== 'undefined') {
      isPushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);

  // Organize top-level comments vs replies
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel: CommentItem[] = [];
    const repliesMap: Record<string, CommentItem[]> = {};

    comments.forEach((c) => {
      if (!c.parentId) {
        topLevel.push(c);
      } else {
        if (!repliesMap[c.parentId]) {
          repliesMap[c.parentId] = [];
        }
        repliesMap[c.parentId].push(c);
      }
    });

    // Pinned top-level comments first
    topLevel.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    return { topLevelComments: topLevel, repliesByParent: repliesMap };
  }, [comments]);

  // Like Toggle for Post
  const handleToggleLike = async () => {
    if (!currentUser || !post) return;

    const nextLiked = !post.isLiked;
    const nextCount = nextLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1);

    setPost({ ...post, isLiked: nextLiked, likesCount: nextCount });
    syncPostUpdate(post._id, { isLiked: nextLiked, likesCount: nextCount });

    try {
      const res = await fetch(`/api/posts/${post._id}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPost((prev) => (prev ? { ...prev, isLiked: data.isLiked, likesCount: data.likesCount } : null));
        syncPostUpdate(post._id, { isLiked: data.isLiked, likesCount: data.likesCount });
      }
    } catch {
      refreshPostDetails();
    }
  };

  // Save Toggle for Post
  const handleToggleSave = async () => {
    if (!currentUser || !post) return;
    const nextSaved = !post.isSaved;
    setPost({ ...post, isSaved: nextSaved });
    syncPostUpdate(post._id, { isSaved: nextSaved });

    try {
      const res = await fetch(`/api/posts/${post._id}/save`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPost((prev) => (prev ? { ...prev, isSaved: data.isSaved } : null));
        syncPostUpdate(post._id, { isSaved: data.isSaved });
      }
    } catch {
      refreshPostDetails();
    }
  };

  // Like Comment Toggle
  const handleToggleCommentLike = async (commentId: string) => {
    if (!currentUser || !post) return;

    setComments((prev) =>
      prev.map((c) => {
        if (c._id === commentId) {
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
          };
        }
        return c;
      })
    );

    try {
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}/like`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, isLiked: data.isLiked, likesCount: data.likesCount }
              : c
          )
        );
      }
    } catch (e) {
      console.error('Like comment error:', e);
    }
  };

  // Pin / Unpin Comment
  const handleTogglePinComment = async (commentId: string) => {
    if (!post) return;

    try {
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}/pin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? { ...c, isPinned: data.isPinned } : c))
        );
      }
    } catch (e) {
      console.error('Pin comment error:', e);
    }
  };

  // Submit Comment or Reply
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !post || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${post._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentText.trim(),
          parentId: replyingTo?.commentId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setPost((prev) => {
          if (!prev) return null;
          const nextCount = prev.commentsCount + 1;
          syncPostUpdate(prev._id, { commentsCount: nextCount });
          return { ...prev, commentsCount: nextCount };
        });
        if (replyingTo) {
          setExpandedThreads((prev) => ({ ...prev, [replyingTo.commentId]: true }));
        }
        setCommentText('');
        setReplyingTo(null);
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
        setComments((prev) => prev.filter((c) => c._id !== commentId && c.parentId !== commentId));
        setPost((prev) => {
          if (!prev) return null;
          const nextCount = Math.max(0, prev.commentsCount - 1);
          syncPostUpdate(prev._id, { commentsCount: nextCount });
          return { ...prev, commentsCount: nextCount };
        });
      }
    } catch (e) {
      console.error('Delete comment error:', e);
    }
  };

  // Save Caption Edit
  const handleSaveCaption = async () => {
    if (!post) return;
    setIsSavingCaption(true);
    try {
      const res = await fetch(`/api/posts/${post._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: editCaptionValue }),
      });
      if (res.ok) {
        setPost((prev) => (prev ? { ...prev, caption: editCaptionValue } : null));
        setIsEditingCaption(false);
        syncPostUpdate(post._id, { caption: editCaptionValue });
      }
    } catch (e) {
      console.error('Edit caption error:', e);
    } finally {
      setIsSavingCaption(false);
    }
  };

  // Delete Post
  const handleDeletePost = async () => {
    if (!post || !confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${post._id}`, { method: 'DELETE' });
      if (res.ok) {
        syncPostDeleted(post._id);
        if (onPostDeleted) onPostDeleted(post._id);
        onClose();
      }
    } catch (e) {
      console.error('Delete post error:', e);
    }
  };

  if (!isOpen) return null;

  const isAuthor = currentUser && post && currentUser._id.toString() === post.author._id.toString();

  const renderCommentRow = (comment: CommentItem, isReply = false) => {
    const isCommentAuthor = currentUser && currentUser._id.toString() === comment.author._id.toString();
    const replies = repliesByParent[comment._id] || [];
    const isExpanded = expandedThreads[comment._id];

    return (
      <div key={comment._id} className={`space-y-2 ${isReply ? 'ml-8 pl-2 border-l border-[#27272a]' : ''}`}>
        <div className="flex items-start justify-between gap-3 text-xs group">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Link
              href={`/u/${comment.author.username}`}
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center font-bold text-[9px] text-white"
            >
              {comment.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comment.author.avatar}
                  alt={comment.author.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                comment.author.displayName?.charAt(0).toUpperCase() || 'U'
              )}
            </Link>

            <div className="min-w-0 flex-1 leading-snug break-words">
              {/* Pinned Badge */}
              {comment.isPinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 mb-0.5">
                  <Pin className="w-3 h-3 fill-amber-400" /> Pinned
                </span>
              )}

              <p>
                <Link
                  href={`/u/${comment.author.username}`}
                  onClick={onClose}
                  className="font-semibold text-white hover:underline mr-1.5"
                >
                  {comment.author.username}
                </Link>
                <span className="text-zinc-300">
                  {renderTextWithMentions(comment.text, onClose)}
                </span>
              </p>

              {/* Sub actions row: Time, Likes, Reply, Pin, Delete */}
              <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1">
                <span>{timeAgo(comment.createdAt)}</span>

                {comment.likesCount > 0 && (
                  <span className="font-semibold text-zinc-400">
                    {comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}
                  </span>
                )}

                {currentUser && !isReply && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo({ commentId: comment._id, username: comment.author.username });
                      setCommentText(`@${comment.author.username} `);
                    }}
                    className="font-semibold text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Reply
                  </button>
                )}

                {comment.canPin && !isReply && (
                  <button
                    type="button"
                    onClick={() => handleTogglePinComment(comment._id)}
                    className="font-semibold text-zinc-400 hover:text-amber-400 cursor-pointer"
                  >
                    {comment.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                )}

                {(isCommentAuthor || isAuthor) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment._id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Like Heart Button */}
          <button
            type="button"
            onClick={() => handleToggleCommentLike(comment._id)}
            className={`p-1 transition-transform active:scale-125 shrink-0 cursor-pointer ${
              comment.isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* View / Hide Replies Button */}
        {!isReply && replies.length > 0 && (
          <div className="ml-8">
            <button
              type="button"
              onClick={() =>
                setExpandedThreads((prev) => ({ ...prev, [comment._id]: !prev[comment._id] }))
              }
              className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <CornerDownRight className="w-3 h-3 text-zinc-500" />
              <span>
                {isExpanded ? 'Hide replies' : `View replies (${replies.length})`}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-3 pt-2">
                {replies.map((reply) => renderCommentRow(reply, true))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleSafeClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
      >
        {loading ? (
          <div className="w-full h-72 md:h-[550px] flex items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !post ? (
          <div className="p-8 text-center text-zinc-400 w-full flex flex-col items-center justify-center gap-3">
            <p>Post not found.</p>
            <button
              onClick={handleSafeClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Left: Images Carousel */}
            <div className="w-full md:w-3/5 bg-black flex items-center justify-center max-h-[40vh] sm:max-h-[48vh] md:max-h-none overflow-hidden shrink-0 md:shrink">
              <ImageCarousel images={post.images} onDoubleTap={handleToggleLike} />
            </div>

            {/* Right: Author, Caption, Comments & Interaction */}
            <div className="w-full md:w-2/5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#27272a] bg-[#121215] min-h-0 flex-1">
              {/* Header with Author + Single-Line Action Controls */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#27272a]">
                <Link
                  href={`/u/${post.author.username}`}
                  onClick={handleSafeClose}
                  className="flex items-center gap-3 group min-w-0 flex-1 mr-2"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
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

                {/* All Actions in One Clean Line */}
                <div className="flex items-center gap-1 shrink-0">
                  {isAuthor && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingCaption(!isEditingCaption)}
                        title="Edit caption"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeletePost}
                        title="Delete post"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleSafeClose}
                    title="Close"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Comments Thread & Caption */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 max-h-[30vh] sm:max-h-[35vh] md:max-h-[360px]">
                {/* Author Caption or Inline Edit Box */}
                {isEditingCaption ? (
                  <div className="space-y-2 bg-[#18181b] p-3 rounded-xl border border-zinc-700">
                    <textarea
                      value={editCaptionValue}
                      onChange={(e) => setEditCaptionValue(e.target.value)}
                      className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditCaptionValue(post.caption);
                          setIsEditingCaption(false);
                        }}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCaption}
                        disabled={isSavingCaption}
                        className="px-3 py-1 bg-white text-zinc-950 font-bold rounded-lg text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isSavingCaption && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  post.caption && (
                    <div className="flex items-start gap-3 text-xs leading-relaxed">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white">
                        {post.author.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          post.author.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="flex-1 break-words">
                        <p>
                          <Link
                            href={`/u/${post.author.username}`}
                            onClick={onClose}
                            className="font-semibold text-white hover:underline mr-1.5"
                          >
                            {post.author.username}
                          </Link>
                          <span className="text-zinc-200">
                            {renderTextWithMentions(post.caption, onClose)}
                          </span>
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">{timeAgo(post.createdAt)}</p>
                      </div>
                    </div>
                  )
                )}

                {/* Divider */}
                <div className="border-t border-[#27272a]/60 my-2" />

                {/* Comments List */}
                {topLevelComments.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-6">No comments yet. Start the conversation!</p>
                ) : (
                  topLevelComments.map((comment) => renderCommentRow(comment, false))
                )}
              </div>

              {/* Bottom Actions, Likes, and Comment Input */}
              <div className="border-t border-[#27272a] p-4 space-y-3 bg-[#121215]">
                {/* Actions Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleLike}
                      className={`p-1 -ml-1 transition-transform active:scale-125 focus:outline-none cursor-pointer ${
                        post.isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>

                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="p-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title="Share post"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleToggleSave}
                    className={`p-1 -mr-1 transition-colors focus:outline-none cursor-pointer ${
                      post.isSaved ? 'text-white fill-white' : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Bookmark className={`w-6 h-6 ${post.isSaved ? 'fill-white' : ''}`} />
                  </button>
                </div>

                {/* Likes count & Timestamp */}
                <div className="text-xs">
                  {post.likesCount > 0 && (
                    <p
                      onClick={() => isAuthor && setIsLikesModalOpen(true)}
                      className={`font-semibold text-white ${
                        isAuthor ? 'hover:underline cursor-pointer' : ''
                      }`}
                    >
                      {post.likesCount.toLocaleString()} {post.likesCount === 1 ? 'like' : 'likes'}
                      {isAuthor && (
                        <span className="text-[10px] text-zinc-400 font-normal ml-1.5 hover:text-white">
                          • View likes
                        </span>
                      )}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{timeAgo(post.createdAt)}</p>
                </div>

                {/* Replying Banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-zinc-800/80 px-3 py-1.5 rounded-lg text-xs text-zinc-300">
                    <span>
                      Replying to <span className="font-bold text-white">@{replyingTo.username}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setCommentText('');
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Add Comment Input */}
                {currentUser && (
                  <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1 border-t border-[#27272a]/60">
                    <input
                      type="text"
                      placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                      maxLength={300}
                    />
                    {commentText.trim().length > 0 && (
                      <button
                        type="submit"
                        disabled={isSubmittingComment}
                        className="text-xs font-semibold text-white hover:text-zinc-300 disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Share to Chat / Story Modal */}
      {post && (
        <ShareToChatModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          contentType="post"
          contentId={post._id}
          author={post.author}
          media={post.images[0]}
          mediaType="image"
        />
      )}

      {/* Author Likes Modal */}
      {isAuthor && post && (
        <LikesListModal
          isOpen={isLikesModalOpen}
          onClose={() => setIsLikesModalOpen(false)}
          targetId={post._id}
          type="post"
          title="Liked by"
        />
      )}
    </div>
  );
}
