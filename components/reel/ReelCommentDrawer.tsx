'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, Send, Trash2, Loader2 } from 'lucide-react';
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
  return `${Math.floor(diffInSeconds / 86400)}d`;
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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !reelId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }),
      });

      const data = await res.json();
      if (res.ok) {
        setComments((prev) => {
          const updated = [...prev, data.comment];
          if (onCommentCountChange) onCommentCountChange(updated.length);
          return updated;
        });
        setCommentText('');
      }
    } catch (e) {
      console.error('Submit reel comment error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!reelId) return;
    try {
      const res = await fetch(`/api/reels/${reelId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) => {
          const updated = prev.filter((c) => c._id !== commentId);
          if (onCommentCountChange) onCommentCountChange(updated.length);
          return updated;
        });
      }
    } catch (e) {
      console.error('Delete reel comment error:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] h-[550px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-16">No comments yet. Start the conversation!</p>
          ) : (
            comments.map((comment) => (
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
            ))
          )}
        </div>

        {/* Comment Input */}
        {currentUser ? (
          <form
            onSubmit={handleAddComment}
            className="border-t border-[#27272a] p-3.5 bg-[#0e0e11] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none px-2"
              maxLength={300}
              disabled={isSubmitting}
            />
            {commentText.trim().length > 0 && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-xs font-semibold text-white hover:text-zinc-300 disabled:opacity-50 transition-colors p-1"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            )}
          </form>
        ) : (
          <div className="border-t border-[#27272a] p-3 text-center text-xs text-zinc-500">
            <Link href="/login" className="text-white underline">
              Sign in
            </Link>{' '}
            to comment.
          </div>
        )}
      </div>
    </div>
  );
}

