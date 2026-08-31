'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Check,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { IStoryMedia } from '@/models/Story';

export interface StoryItemData {
  _id: string;
  media: IStoryMedia;
  mediaType: 'image' | 'video';
  viewsCount: number;
  hasViewed: boolean;
  expiresAt: Date | string;
  createdAt: Date | string;
}

export interface StoryGroupData {
  author: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  hasUnseen: boolean;
  stories: StoryItemData[];
}

export interface StoryViewerModalProps {
  storyGroups: StoryGroupData[];
  initialAuthorIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '😢'];

export function StoryViewerModal({
  storyGroups: initialGroups,
  initialAuthorIndex,
  isOpen,
  onClose,
  onStoryViewed,
}: StoryViewerModalProps) {
  const { user: currentUser } = useAuth();

  const [storyGroups, setStoryGroups] = useState<StoryGroupData[]>(initialGroups);
  const [authorIndex, setAuthorIndex] = useState(initialAuthorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [sentToast, setSentToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewRecordedRef = useRef<Record<string, boolean>>({});

  const currentGroup = storyGroups[authorIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Record view after 1s
  const recordStoryView = useCallback(
    async (storyId: string) => {
      if (viewRecordedRef.current[storyId]) return;
      viewRecordedRef.current[storyId] = true;

      try {
        await fetch(`/api/stories/${storyId}/view`, { method: 'POST' });
        if (onStoryViewed) onStoryViewed(storyId);
      } catch (e) {
        console.error('Record story view error:', e);
      }
    },
    [onStoryViewed]
  );

  // Advance to next story / group
  const handleNext = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (authorIndex < storyGroups.length - 1) {
      setAuthorIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIndex, authorIndex, storyGroups.length, onClose]);

  // Go to previous story / group
  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (authorIndex > 0) {
      const prevGroup = storyGroups[authorIndex - 1];
      setAuthorIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, authorIndex, storyGroups]);

  // Handle timer & progress for current story
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || isDeleting) return;

    // Record view
    const viewTimer = setTimeout(() => {
      recordStoryView(currentStory._id);
    }, 1000);

    const DURATION = currentStory.mediaType === 'video' ? 10000 : 5000;
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, INTERVAL);

    return () => {
      clearTimeout(viewTimer);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isOpen, currentStory, isPaused, isDeleting, handleNext, recordStoryView]);

  // Delete current story
  const handleDeleteStory = async () => {
    if (!currentStory || isDeleting) return;
    if (!confirm('Are you sure you want to delete this story?')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/stories/${currentStory._id}`, { method: 'DELETE' });
      if (res.ok) {
        const remainingInGroup = currentGroup.stories.filter((s) => s._id !== currentStory._id);

        if (remainingInGroup.length > 0) {
          setStoryGroups((prev) =>
            prev.map((g, idx) =>
              idx === authorIndex ? { ...g, stories: remainingInGroup } : g
            )
          );
          if (storyIndex >= remainingInGroup.length) {
            setStoryIndex(Math.max(0, remainingInGroup.length - 1));
          }
          setProgress(0);
        } else {
          const remainingGroups = storyGroups.filter((_, idx) => idx !== authorIndex);
          if (remainingGroups.length === 0) {
            onClose();
          } else {
            setStoryGroups(remainingGroups);
            setAuthorIndex(Math.min(authorIndex, remainingGroups.length - 1));
            setStoryIndex(0);
            setProgress(0);
          }
        }
      }
    } catch (e) {
      console.error('Delete story error:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Send quick reaction
  const handleSendReaction = async (emoji: string) => {
    if (!currentStory || isSubmittingReply) return;
    setIsSubmittingReply(true);

    try {
      await fetch(`/api/stories/${currentStory._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2000);
    } catch (e) {
      console.error('Send reaction error:', e);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Send text reply
  const handleSendTextReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStory || !replyText.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);

    try {
      await fetch(`/api/stories/${currentStory._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      setReplyText('');
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2000);
    } catch (e) {
      console.error('Send text reply error:', e);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  const isOwner = currentUser && currentGroup.author._id === currentUser._id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Close Button (Desktop) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Nav arrow Left (Desktop) */}
      {!(authorIndex === 0 && storyIndex === 0) && (
        <button
          onClick={handlePrev}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Nav arrow Right (Desktop) */}
      {!(authorIndex === storyGroups.length - 1 && storyIndex === currentGroup.stories.length - 1) && (
        <button
          onClick={handleNext}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Story Player Container */}
      <div
        className="relative w-full sm:max-w-md h-full sm:h-[88vh] bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border-0 sm:border sm:border-[#27272a]/60 flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* ================================================================= */}
        {/* Top: Progress Bars & Author Header */}
        {/* ================================================================= */}
        <div className="relative z-30 p-3.5 space-y-3 bg-gradient-to-b from-black/80 to-transparent">
          {/* Segmented Progress Bars */}
          <div className="flex items-center gap-1.5 w-full">
            {currentGroup.stories.map((s, idx) => {
              let fillPercent = 0;
              if (idx < storyIndex) fillPercent = 100;
              else if (idx === storyIndex) fillPercent = progress;

              return (
                <div key={s._id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between">
            <Link
              href={`/u/${currentGroup.author.username}`}
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-full border border-white/60 overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-xs text-white shrink-0">
                {currentGroup.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentGroup.author.avatar}
                    alt={currentGroup.author.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentGroup.author.displayName?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:underline">
                  {currentGroup.author.username}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {currentStory.viewsCount > 0 ? `${currentStory.viewsCount} views` : '24h Story'}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStory();
                  }}
                  disabled={isDeleting}
                  className="p-1.5 rounded-full bg-black/50 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title="Delete this story"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white sm:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Media (Image or Video) */}
        {/* ================================================================= */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          {currentStory.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.media.secureUrl || currentStory.media.url}
              autoPlay
              playsInline
              loop
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentStory.media.secureUrl || currentStory.media.url}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {/* Invisible Left / Right Tap zones */}
          <div
            className="absolute top-16 bottom-20 left-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
          <div
            className="absolute top-16 bottom-20 right-0 w-2/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />
        </div>

        {/* ================================================================= */}
        {/* Bottom: Quick Emoji Reactions & Reply Input */}
        {/* ================================================================= */}
        <div className="relative z-30 p-3.5 space-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          {sentToast && (
            <div className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-emerald-400 animate-in fade-in zoom-in-95">
              <Check className="w-4 h-4" /> Reaction Sent
            </div>
          )}

          {!isOwner && currentUser && (
            <>
              {/* Quick Reactions Bar */}
              <div className="flex items-center justify-around py-1">
                {EMOJI_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendReaction(emoji);
                    }}
                    className="text-xl sm:text-2xl hover:scale-125 active:scale-95 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Text Reply Input */}
              <form
                onSubmit={(e) => {
                  e.stopPropagation();
                  handleSendTextReply(e);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={`Reply to ${currentGroup.author.username}...`}
                  value={replyText}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-xs text-white placeholder:text-white/60 border border-white/20 focus:outline-none focus:border-white transition-colors"
                  maxLength={300}
                />
                {replyText.trim().length > 0 && (
                  <button
                    type="submit"
                    disabled={isSubmittingReply}
                    className="p-2 rounded-full bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
