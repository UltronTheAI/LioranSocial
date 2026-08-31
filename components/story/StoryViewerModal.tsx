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
  Heart,
  Eye,
  ChevronUp,
  Play,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { IStoryMedia } from '@/models/Story';

export interface StoryItemData {
  _id: string;
  media: IStoryMedia;
  mediaType: 'image' | 'video';
  sharedContent?: {
    contentType: 'post' | 'reel';
    postId?: string;
    reelId?: string;
    authorUsername: string;
    authorAvatar?: string;
  };
  viewsCount: number;
  likesCount?: number;
  hasViewed: boolean;
  isLiked?: boolean;
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

interface ViewerItem {
  _id: string;
  user: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  viewedAt: string | Date;
  isLiked: boolean;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '😢'];

function formatViewerTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

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

  // Pause states (Holding, Typing, Drawer)
  const [isHolding, setIsHolding] = useState(false);
  const [isTypingReply, setIsTypingReply] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Heart pop animation
  const [showHeartPop, setShowHeartPop] = useState(false);

  // Author Viewers Activity State
  const [viewersList, setViewersList] = useState<ViewerItem[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Reply & Delete states
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [sentToast, setSentToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewRecordedRef = useRef<Record<string, boolean>>({});

  const currentGroup = storyGroups[authorIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwner = currentUser && currentGroup?.author._id === currentUser._id;

  // Record view after short duration
  const recordStoryView = useCallback(
    async (storyId: string) => {
      if (viewRecordedRef.current[storyId]) return;
      viewRecordedRef.current[storyId] = true;

      try {
        await fetch(`/api/stories/${storyId}/view`, { method: 'POST' });
        setStoryGroups((prev) =>
          prev.map((g) => {
            const hasTarget = g.stories.some((s) => s._id === storyId);
            if (!hasTarget) return g;
            const updatedStories = g.stories.map((s) =>
              s._id === storyId ? { ...s, hasViewed: true } : s
            );
            return {
              ...g,
              stories: updatedStories,
              hasUnseen: updatedStories.some((s) => !s.hasViewed),
            };
          })
        );
        if (onStoryViewed) onStoryViewed(storyId);
      } catch (e) {
        console.error('Record story view error:', e);
      }
    },
    [onStoryViewed]
  );

  // Fetch Viewers List for Story Author
  const fetchStoryViewers = useCallback(async (storyId: string) => {
    setLoadingViewers(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/viewers`);
      const data = await res.json();
      if (res.ok) {
        setViewersList(data.viewers || []);
      }
    } catch (e) {
      console.error('Fetch story viewers error:', e);
    } finally {
      setLoadingViewers(false);
    }
  }, []);

  // Open Activity Drawer for Author
  const handleOpenActivity = () => {
    if (!currentStory || !isOwner) return;
    setIsActivityOpen(true);
    fetchStoryViewers(currentStory._id);
  };

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

  // Pause condition: Holding screen OR Typing reply OR Activity Drawer open OR Deleting
  const isPlaybackPaused = isHolding || isTypingReply || isActivityOpen || isDeleting;

  // Handle timer & progress for current story
  useEffect(() => {
    if (!isOpen || !currentStory || isPlaybackPaused) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }

    // Record view promptly
    const viewTimer = setTimeout(() => {
      recordStoryView(currentStory._id);
    }, 300);

    const DURATION = currentStory.mediaType === 'video' ? 10000 : 5000;
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;
    let currentProg = progress;

    progressTimerRef.current = setInterval(() => {
      currentProg += step;
      if (currentProg >= 100) {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setProgress(100);
        handleNext();
      } else {
        setProgress(currentProg);
      }
    }, INTERVAL);

    return () => {
      clearTimeout(viewTimer);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isOpen, currentStory, isPlaybackPaused, handleNext, recordStoryView, progress]);

  // Toggle Story Like
  const handleToggleLike = async () => {
    if (!currentStory || !currentUser) return;

    const storyId = currentStory._id;
    const nextLiked = !currentStory.isLiked;
    const nextCount = nextLiked ? (currentStory.likesCount || 0) + 1 : Math.max(0, (currentStory.likesCount || 0) - 1);

    setStoryGroups((prev) =>
      prev.map((g, aIdx) =>
        aIdx === authorIndex
          ? {
              ...g,
              stories: g.stories.map((s, sIdx) =>
                sIdx === storyIndex ? { ...s, isLiked: nextLiked, likesCount: nextCount } : s
              ),
            }
          : g
      )
    );

    if (nextLiked) {
      setShowHeartPop(true);
      setTimeout(() => setShowHeartPop(false), 800);
    }

    try {
      const res = await fetch(`/api/stories/${storyId}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStoryGroups((prev) =>
          prev.map((g, aIdx) =>
            aIdx === authorIndex
              ? {
                  ...g,
                  stories: g.stories.map((s, sIdx) =>
                    sIdx === storyIndex ? { ...s, isLiked: data.isLiked, likesCount: data.likesCount } : s
                  ),
                }
              : g
          )
        );
      }
    } catch (e) {
      console.error('Toggle story like error:', e);
    }
  };

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
      setIsTypingReply(false);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Close Button (Desktop) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black transition-colors cursor-pointer"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Nav arrow Left (Desktop) */}
      {!(authorIndex === 0 && storyIndex === 0) && (
        <button
          onClick={handlePrev}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Nav arrow Right (Desktop) */}
      {!(authorIndex === storyGroups.length - 1 && storyIndex === currentGroup.stories.length - 1) && (
        <button
          onClick={handleNext}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black transition-colors cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Story Player Container */}
      <div
        className="relative w-full sm:max-w-md h-full sm:h-[88vh] bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border-0 sm:border sm:border-[#27272a]/60 flex flex-col justify-between"
        onPointerDown={() => setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerCancel={() => setIsHolding(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* ================================================================= */}
        {/* Top: Progress Bars & Author Header */}
        {/* ================================================================= */}
        <div
          className={`relative z-30 p-3.5 space-y-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 ${
            isHolding ? 'opacity-0' : 'opacity-100'
          }`}
        >
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
                className="p-1.5 text-white/80 hover:text-white sm:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Media (Image or Video / Shared Content Card) */}
        {/* ================================================================= */}
        <div className={`absolute inset-0 z-10 flex items-center justify-center ${
          currentStory.sharedContent ? 'bg-gradient-to-b from-indigo-950/80 via-[#18181b] to-black p-4' : 'bg-black'
        }`}>
          {currentStory.sharedContent ? (
            /* Compact Shared Story Card */
            <div className="relative w-[86%] max-h-[64%] bg-black/90 rounded-2xl overflow-hidden border border-white/20 shadow-2xl flex flex-col group/card animate-in zoom-in-95 duration-200">
              {/* Original Author Badge Header */}
              <div className="p-2.5 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center gap-2 z-20">
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                  {currentStory.sharedContent.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentStory.sharedContent.authorAvatar}
                      alt={currentStory.sharedContent.authorUsername}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentStory.sharedContent.authorUsername.charAt(0).toUpperCase()
                  )}
                </div>
                <p className="text-xs font-bold text-white truncate">
                  @{currentStory.sharedContent.authorUsername}
                </p>
                <span className="text-[10px] text-zinc-400 ml-auto capitalize">
                  {currentStory.sharedContent.contentType}
                </span>
              </div>

              {/* Shared Media */}
              <div className="relative w-full aspect-square sm:aspect-[4/5] max-h-[46vh] bg-black flex items-center justify-center overflow-hidden">
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
                    alt="Shared Story"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Interactive Clickable View Post / Watch Reel Button */}
                <Link
                  href={
                    currentStory.sharedContent.contentType === 'reel'
                      ? `/reels#${currentStory.sharedContent.reelId || ''}`
                      : `/post/${currentStory.sharedContent.postId || ''}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 hover:bg-black backdrop-blur-md border border-white/30 text-xs font-bold text-white shadow-2xl hover:scale-105 transition-all cursor-pointer z-30"
                >
                  {currentStory.sharedContent.contentType === 'reel' ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white text-white" />
                      <span>Watch Reel</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                      <span>View Post</span>
                    </>
                  )}
                </Link>
              </div>
            </div>
          ) : (
            /* Fullscreen Story Media */
            currentStory.mediaType === 'video' ? (
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
            )
          )}

          {/* Floating animated heart on story like */}
          {showHeartPop && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200 z-30">
              <Heart className="w-28 h-28 fill-rose-500 text-rose-500 drop-shadow-2xl opacity-90 scale-125 transition-transform animate-pulse" />
            </div>
          )}

          {/* Left / Right Tap zones (only active when not holding or typing) */}
          {!isHolding && !isTypingReply && !isActivityOpen && (
            <>
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
            </>
          )}
        </div>

        {/* ================================================================= */}
        {/* Bottom: Author Viewers Pill / Viewer Reactions & Likes */}
        {/* ================================================================= */}
        <div
          className={`relative z-30 p-3.5 space-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 ${
            isHolding ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {sentToast && (
            <div className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-emerald-400 animate-in fade-in zoom-in-95">
              <Check className="w-4 h-4" /> Reaction Sent
            </div>
          )}

          {/* Author Mode: "Activity / Seen by X" trigger pill */}
          {isOwner ? (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenActivity();
                }}
                className="flex items-center gap-2.5 bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-xs font-semibold text-white transition-all cursor-pointer shadow-xl hover:scale-105"
              >
                <span className="flex items-center gap-1.5 text-zinc-200">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>{currentStory.viewsCount || 0} {currentStory.viewsCount === 1 ? 'view' : 'views'}</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 border-l border-white/20 pl-2.5">
                  <Heart className="w-3.5 h-3.5 fill-rose-400" />
                  <span>{currentStory.likesCount || 0}</span>
                </span>
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
              </button>
            </div>
          ) : (
            currentUser && (
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
                      className="text-xl sm:text-2xl hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Reply Input and Story Heart Button */}
                <div className="flex items-center gap-2">
                  <form
                    onSubmit={(e) => {
                      e.stopPropagation();
                      handleSendTextReply(e);
                    }}
                    className="flex-1 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder={`Reply to ${currentGroup.author.username}...`}
                      value={replyText}
                      onFocus={() => setIsTypingReply(true)}
                      onBlur={() => setIsTypingReply(false)}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-xs text-white placeholder:text-white/60 border border-white/20 focus:outline-none focus:border-white transition-colors"
                      maxLength={300}
                    />
                    {replyText.trim().length > 0 && (
                      <button
                        type="submit"
                        disabled={isSubmittingReply}
                        className="p-2 rounded-full bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </form>

                  {/* Story Like Heart Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike();
                    }}
                    className={`p-2 rounded-full backdrop-blur-md border transition-transform active:scale-125 cursor-pointer shrink-0 ${
                      currentStory.isLiked
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                        : 'bg-white/20 border-white/20 text-white hover:bg-white/30'
                    }`}
                    title={currentStory.isLiked ? 'Unlike Story' : 'Like Story'}
                  >
                    <Heart className={`w-4 h-4 ${currentStory.isLiked ? 'fill-rose-500' : ''}`} />
                  </button>
                </div>
              </>
            )
          )}
        </div>

        {/* ================================================================= */}
        {/* Author Story Activity Drawer (Instagram style) */}
        {/* ================================================================= */}
        {isActivityOpen && isOwner && (
          <div
            className="absolute inset-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col justify-between animate-in slide-in-from-bottom duration-250 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Story Activity</h3>
                <p className="text-[11px] text-zinc-400">
                  {currentStory.viewsCount || 0} views • {currentStory.likesCount || 0} likes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityOpen(false)}
                className="p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewers List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {loadingViewers ? (
                <div className="py-12 text-center text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : viewersList.length === 0 ? (
                <div className="py-12 text-center space-y-1">
                  <Eye className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No views yet</p>
                  <p className="text-[10px] text-zinc-600">When people view your story, they will appear here.</p>
                </div>
              ) : (
                viewersList.map((viewer) => (
                  <div
                    key={viewer._id}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#121215] border border-zinc-800/60"
                  >
                    <Link
                      href={`/u/${viewer.user.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 min-w-0 flex-1 group"
                    >
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {viewer.user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={viewer.user.avatar}
                            alt={viewer.user.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          viewer.user.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate group-hover:underline">
                          {viewer.user.displayName}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">@{viewer.user.username}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      {viewer.isLiked && (
                        <span title="Liked your story">
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500">
                        {formatViewerTime(viewer.viewedAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Dismiss Button */}
            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsActivityOpen(false)}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Activity
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
