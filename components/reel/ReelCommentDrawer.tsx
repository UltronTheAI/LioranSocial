'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  Send,
  Trash2,
  Loader2,
  Heart,
  Pin,
  CornerDownRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CommentItem } from '@/components/post/PostDetailModal';

export interface ReelCommentDrawerProps {
  reelId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
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

export function ReelCommentDrawer({
  reelId,
  isOpen,
  onClose,
  onCommentCountChange,
}: ReelCommentDrawerProps) {
  const { user: currentUser } = useAuth();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Threading and reply state
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  const fetchCommentsData = useCallback(async () => {
    if (!reelId || !isOpen) return [];
    try {
      const res = await fetch(`/api/reels/${reelId}/comments`);
      const data = await res.json();
      if (res.ok) {
        return data.comments || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch reel comments error:', e);
      return [];
    }
  }, [reelId, isOpen]);

  useEffect(() => {
    let isMounted = true;
    if (reelId && isOpen) {
      fetchCommentsData().then((fetched) => {
        if (isMounted) {
          setComments(fetched);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [reelId, isOpen, fetchCommentsData]);

  // Split comments into top-level and replies
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

    topLevel.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    return { topLevelComments: topLevel, repliesByParent: repliesMap };
  }, [comments]);

  // Like comment toggle
  const handleToggleCommentLike = async (commentId: string) => {
    if (!currentUser || !reelId) return;

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
      const res = await fetch(`/api/reels/${reelId}/comments/${commentId}/like`, {
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
      console.error('Like reel comment error:', e);
    }
  };

  // Pin / Unpin comment
  const handleTogglePinComment = async (commentId: string) => {
    if (!reelId) return;

    try {
      const res = await fetch(`/api/reels/${reelId}/comments/${commentId}/pin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? { ...c, isPinned: data.isPinned } : c))
        );
      }
    } catch (e) {
      console.error('Pin reel comment error:', e);
    }
  };

  // Submit comment or reply
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !reelId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentText.trim(),
          parentId: replyingTo?.commentId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const nextComments = [...comments, data.comment];
        setComments(nextComments);
        if (replyingTo) {
          setExpandedThreads((prev) => ({ ...prev, [replyingTo.commentId]: true }));
        }
        setCommentText('');
        setReplyingTo(null);
        if (onCommentCountChange) {
          onCommentCountChange(nextComments.length);
        }
      }
    } catch (e) {
      console.error('Submit reel comment error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!reelId) return;
    try {
      const res = await fetch(`/api/reels/${reelId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const nextComments = comments.filter((c) => c._id !== commentId && c.parentId !== commentId);
        setComments(nextComments);
        if (onCommentCountChange) {
          onCommentCountChange(nextComments.length);
        }
      }
    } catch (e) {
      console.error('Delete reel comment error:', e);
    }
  };

  if (!isOpen) return null;

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
              className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center font-bold text-[10px] text-white"
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

              {/* Sub actions row */}
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

                {(isCommentAuthor || comment.canDelete) && (
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] h-[550px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : topLevelComments.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs">
              No comments yet. Be the first to comment on this reel!
            </div>
          ) : (
            topLevelComments.map((comment) => renderCommentRow(comment, false))
          )}
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-zinc-800/80 px-4 py-1.5 text-xs text-zinc-300 border-t border-[#27272a]">
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

        {/* Comment Input */}
        {currentUser && (
          <form
            onSubmit={handleAddComment}
            className="p-4 border-t border-[#27272a] flex items-center gap-2 bg-[#0e0e11]"
          >
            <input
              type="text"
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              maxLength={300}
              disabled={isSubmitting}
            />
            {commentText.trim().length > 0 && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="p-1.5 rounded-full bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
