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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ShareToChatModal } from '@/components/messages/ShareToChatModal';
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

export function ReelPlayer({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
}: ReelPlayerProps) {
  const { user: currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [isSaved, setIsSaved] = useState(reel.isSaved);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);

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
          // Start 3-second watch timer for view counting
          if (!viewCountedRef.current) {
            watchTimerRef.current = setTimeout(recordView, 3000);
          }
        })
        .catch(() => {
          // Autoplay prevented
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

  return (
    <div className="relative w-full max-w-sm sm:max-w-md h-[82vh] sm:h-[86vh] mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border border-[#27272a]/60 select-none flex items-center justify-center snap-center group">
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
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
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
      <div className="absolute right-3 bottom-14 z-20 flex flex-col items-center gap-5 text-white">
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
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleLike}
            className={`p-2 rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-125 focus:outline-none ${
              isLiked ? 'text-rose-500 fill-rose-500' : 'text-white hover:text-zinc-200'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
          <span className="text-[11px] font-bold drop-shadow-md">{likesCount}</span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onOpenComments(reel._id)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:text-zinc-200 transition-colors focus:outline-none"
            aria-label="View comments"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <span className="text-[11px] font-bold drop-shadow-md">{reel.commentsCount || 0}</span>
        </div>

        {/* Save / Bookmark Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded-full bg-black/40 backdrop-blur-md transition-colors focus:outline-none ${
              isSaved ? 'text-amber-400 fill-amber-400' : 'text-white hover:text-zinc-200'
            }`}
            aria-label={isSaved ? 'Remove Bookmark' : 'Bookmark'}
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:text-zinc-200 transition-colors focus:outline-none"
            title="Share reel"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Overlay: Author details & caption */}
      <div className="absolute left-0 right-14 bottom-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent space-y-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href={`/u/${reel.author.username}`} className="text-sm font-bold text-white hover:underline flex items-center gap-1.5">
            <span>@{reel.author.username}</span>
          </Link>
        </div>

        {reel.caption && (
          <div className="pointer-events-auto text-xs text-zinc-100 leading-snug">
            <span>
              {reel.caption.length > 80 && !isCaptionExpanded
                ? `${reel.caption.slice(0, 80)}...`
                : reel.caption}
            </span>
            {reel.caption.length > 80 && (
              <button
                type="button"
                onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                className="text-zinc-300 hover:text-white font-semibold ml-1 focus:outline-none"
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30 pointer-events-none">
        <div className="h-full bg-white transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      {/* Share to Chat Modal */}
      <ShareToChatModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contentType="reel"
        contentId={reel._id}
      />
    </div>
  );
}
