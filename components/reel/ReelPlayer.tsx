'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Volume2,
  VolumeX,
  Play,
  Eye,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ShareToChatModal } from '@/components/messages/ShareToChatModal';
import { LikesListModal } from '@/components/post/LikesListModal';
import { IReelVideo } from '@/models/Reel';

export interface ReelData {
  _id: string;
  author: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  video: IReelVideo;
  caption: string;
  mentions?: string[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  viewsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string | Date;
}

export interface ReelPlayerProps {
  reel: ReelData;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenComments: (reelId: string) => void;
  onReelDeleted?: (reelId: string) => void;
}

function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link
          key={index}
          href={`/u/${username}`}
          className="text-blue-400 hover:underline font-semibold"
        >
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ReelPlayer({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onReelDeleted,
}: ReelPlayerProps) {
  const { user: currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [currentCaption, setCurrentCaption] = useState(reel.caption);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [isSaved, setIsSaved] = useState(reel.isSaved);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Edit Caption state
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaptionValue, setEditCaptionValue] = useState(reel.caption);
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);

  const isAuthor = currentUser && currentUser._id.toString() === reel.author._id.toString();

  // View count threshold tracking (3s continuous playback)
  const viewCountedRef = useRef(false);
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const recordView = useCallback(async () => {
    if (viewCountedRef.current) return;
    viewCountedRef.current = true;
    try {
      await fetch(`/api/reels/${reel._id}/view`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to record reel view:', e);
    }
  }, [reel._id]);

  // Video Autoplay / Pause management based on viewport activity
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      video
        .play()
        .then(() => {
          if (!viewCountedRef.current) {
            watchTimerRef.current = setTimeout(recordView, 3000);
          }
        })
        .catch(() => {
          // Fallback to muted playback if browser policy blocks unmuted autoplay without gesture
          if (!isMuted) {
            video.muted = true;
            video.play().catch(() => {});
          }
        });
    } else {
      video.pause();
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    }

    return () => {
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current);
      }
    };
  }, [isActive, isMuted, recordView]);

  // Synchronize muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Track progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  // Tap video to play/pause
  const handleVideoTap = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  // Like Toggle
  const handleToggleLike = async () => {
    if (!currentUser) return;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/reels/${reel._id}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsLiked(data.isLiked);
        setLikesCount(data.likesCount);
      }
    } catch {
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
      const res = await fetch(`/api/reels/${reel._id}/save`, { method: 'POST' });
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
    const reelUrl = `${window.location.origin}/reels#${reel._id}`;
    navigator.clipboard.writeText(reelUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    setIsMenuOpen(false);
  };

  // Save Edited Caption
  const handleSaveCaption = async () => {
    setIsSavingCaption(true);
    try {
      const res = await fetch(`/api/reels/${reel._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: editCaptionValue }),
      });
      if (res.ok) {
        setCurrentCaption(editCaptionValue);
        setIsEditingCaption(false);
      }
    } catch (e) {
      console.error('Update caption failed:', e);
    } finally {
      setIsSavingCaption(false);
      setIsMenuOpen(false);
    }
  };

  // Delete Reel
  const handleDeleteReel = async () => {
    if (!confirm('Are you sure you want to delete this reel?')) return;
    try {
      const res = await fetch(`/api/reels/${reel._id}`, { method: 'DELETE' });
      if (res.ok && onReelDeleted) {
        onReelDeleted(reel._id);
      }
    } catch (e) {
      console.error('Delete reel failed:', e);
    }
  };

  return (
    <div className="relative w-full max-w-sm sm:max-w-md h-[82vh] sm:h-[86vh] mx-auto bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border-0 sm:border sm:border-[#27272a]/60 select-none flex items-center justify-center snap-center group">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={reel.video.secureUrl || reel.video.url}
        poster={reel.video.thumbnail}
        loop
        playsInline
        preload={isActive ? 'auto' : 'metadata'}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onClick={handleVideoTap}
        onDoubleClick={handleDoubleTap}
        className="w-full h-full object-cover cursor-pointer"
      />

      {/* Play/Pause Center Indicator */}
      {!isPlaying && (
        <div
          onClick={handleVideoTap}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer pointer-events-auto"
        >
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
            <Play className="w-8 h-8 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Floating animated heart on double tap */}
      {showHeartPop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
          <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl opacity-90 scale-110" />
        </div>
      )}

      {/* Audio Mute/Unmute Overlay Button (Top-Right) */}
      <button
        onClick={onToggleMute}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg cursor-pointer"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Views Badge (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90 flex items-center gap-1.5 shadow-md">
        <Eye className="w-3.5 h-3.5 text-zinc-300" />
        <span>{reel.viewsCount?.toLocaleString() || 0}</span>
      </div>

      {/* Right Interaction Sidebar */}
      <div className="absolute right-3 bottom-14 z-20 flex flex-col items-center gap-4 text-white">
        {/* Author Avatar with Link */}
        <Link
          href={`/u/${reel.author.username}`}
          className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-xs shadow-lg hover:scale-105 transition-transform"
        >
          {reel.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.author.avatar} alt={reel.author.displayName} className="w-full h-full object-cover" />
          ) : (
            reel.author.displayName?.charAt(0).toUpperCase() || 'U'
          )}
        </Link>
        {/* Like Button */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={handleToggleLike}
            className={`p-2 rounded-full bg-black/40 backdrop-blur-md transition-colors focus:outline-none cursor-pointer ${
              isLiked ? 'text-rose-500 fill-rose-500' : 'text-white hover:text-zinc-200'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
          <span
            onClick={() => isAuthor && setIsLikesModalOpen(true)}
            className={`text-[11px] font-bold drop-shadow-md ${
              isAuthor ? 'hover:underline cursor-pointer hover:text-rose-300' : ''
            }`}
            title={isAuthor ? 'View likes' : undefined}
          >
            {likesCount}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => onOpenComments(reel._id)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer"
            aria-label="View comments"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <span className="text-[11px] font-bold drop-shadow-md">{reel.commentsCount || 0}</span>
        </div>

        {/* Save / Bookmark Button */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded-full bg-black/40 backdrop-blur-md transition-colors focus:outline-none cursor-pointer ${
              isSaved ? 'text-amber-400 fill-amber-400' : 'text-white hover:text-zinc-200'
            }`}
            aria-label={isSaved ? 'Remove Bookmark' : 'Bookmark'}
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer"
            title="Share reel"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* More Options / 3 dots */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer"
            title="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-36 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95">
              <button
                onClick={handleCopyLink}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                {isCopied ? 'Copied' : 'Copy link'}
              </button>
              {isAuthor && (
                <>
                  <button
                    onClick={() => {
                      setIsLikesModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    View likes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingCaption(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    Edit caption
                  </button>
                  <button
                    onClick={handleDeleteReel}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete reel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Overlay: Author details & caption */}
      <div className="absolute left-0 right-14 bottom-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent space-y-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href={`/u/${reel.author.username}`} className="text-sm font-bold text-white hover:underline flex items-center gap-1.5">
            <span>@{reel.author.username}</span>
          </Link>
        </div>

        {isEditingCaption ? (
          <div className="pointer-events-auto space-y-2 bg-[#121215]/90 p-2.5 rounded-xl border border-zinc-700">
            <textarea
              value={editCaptionValue}
              onChange={(e) => setEditCaptionValue(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              rows={2}
              maxLength={500}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditCaptionValue(currentCaption);
                  setIsEditingCaption(false);
                }}
                className="px-2 py-0.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCaption}
                disabled={isSavingCaption}
                className="px-2.5 py-0.5 bg-white text-zinc-950 font-bold rounded-lg text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isSavingCaption && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          currentCaption && (
            <div className="pointer-events-auto text-xs text-zinc-100 leading-snug break-words">
              <span>
                {renderTextWithMentions(
                  currentCaption.length > 80 && !isCaptionExpanded
                    ? `${currentCaption.slice(0, 80)}...`
                    : currentCaption
                )}
              </span>
              {currentCaption.length > 80 && (
                <button
                  type="button"
                  onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                  className="text-zinc-300 hover:text-white font-semibold ml-1 focus:outline-none cursor-pointer"
                >
                  {isCaptionExpanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30 pointer-events-none">
        <div className="h-full bg-white transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      {/* Share to Chat / Story Modal */}
      <ShareToChatModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contentType="reel"
        contentId={reel._id}
        author={reel.author}
        media={reel.video}
        mediaType="video"
      />

      {/* Author Reel Likes Modal */}
      {isAuthor && (
        <LikesListModal
          isOpen={isLikesModalOpen}
          onClose={() => setIsLikesModalOpen(false)}
          targetId={reel._id}
          type="reel"
          title="Reel Likes"
        />
      )}
    </div>
  );
}
