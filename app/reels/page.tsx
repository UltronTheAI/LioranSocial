'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Clapperboard, Plus, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ReelPlayer, ReelData } from '@/components/reel/ReelPlayer';
import { ReelCommentDrawer } from '@/components/reel/ReelCommentDrawer';
import { CreateReelModal } from '@/components/reel/CreateReelModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function ReelsPage() {
  const { user: currentUser } = useAuth();

  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Active reel in viewport & audio mute state
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Modals & Drawers
  const [commentDrawerReelId, setCommentDrawerReelId] = useState<string | null>(null);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);

  // Refs for snap container and item observers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const fetchInitialReelsData = useCallback(async () => {
    try {
      const res = await fetch('/api/reels?limit=6', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return {
          reels: data.reels || [],
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
        };
      }
      return { reels: [], nextCursor: null, hasMore: false };
    } catch (e) {
      console.error('Fetch reels error:', e);
      return { reels: [], nextCursor: null, hasMore: false };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchInitialReelsData().then((result) => {
      if (isMounted) {
        setReels(result.reels);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchInitialReelsData]);

  const loadMoreReels = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/reels?cursor=${nextCursor}&limit=6`);
      const data = await res.json();

      if (res.ok) {
        setReels((prev) => {
          const existingIds = new Set(prev.map((r) => r._id));
          const newUnique = data.reels.filter((r: ReelData) => !existingIds.has(r._id));
          return [...prev, ...newUnique];
        });

        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (e) {
      console.error('Load more reels error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, hasMore]);

  // Set up IntersectionObserver to detect which Reel is in the viewport center
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-reel-index'));
            if (!isNaN(index)) {
              setActiveReelIndex(index);
              // Trigger preloading next reels when nearing the end
              if (index >= reels.length - 2 && hasMore && !loadingMore) {
                loadMoreReels();
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6, // Reel is considered active when 60% visible
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels, hasMore, loadingMore, loadMoreReels]);

  const handleReelCreated = (newReel: ReelData) => {
    setReels((prev) => [newReel, ...prev]);
    setActiveReelIndex(0);
  };

  const handleReelDeleted = (deletedReelId: string) => {
    setReels((prev) => prev.filter((r) => r._id !== deletedReelId));
  };

  const handleCommentCountChange = (newCount: number) => {
    if (!commentDrawerReelId) return;
    setReels((prev) =>
      prev.map((r) =>
        r._id === commentDrawerReelId ? { ...r, commentsCount: newCount } : r
      )
    );
  };

  return (
    <AppShell>
      <div className="relative h-[calc(100vh-4rem)] md:h-screen overflow-hidden flex flex-col items-center justify-center">
        {/* Floating Create Reel Button */}
        {currentUser && (
          <button
            onClick={() => setIsCreateReelOpen(true)}
            className="absolute top-4 right-4 md:right-8 z-30 flex items-center gap-2 bg-white text-zinc-950 font-bold px-3.5 py-2 rounded-xl text-xs hover:bg-zinc-200 transition-all shadow-xl hover:scale-105"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Reel</span>
          </button>
        )}

        {/* Loading State */}
        {loading && (
          <div className="w-full max-w-sm sm:max-w-md h-[82vh] sm:h-[86vh] bg-[#121215] border border-[#27272a] rounded-2xl flex flex-col items-center justify-center space-y-3 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            <p className="text-xs text-zinc-500">Loading reels...</p>
          </div>
        )}

        {/* Empty Reels State */}
        {!loading && reels.length === 0 && (
          <div className="w-full max-w-sm sm:max-w-md bg-[#121215] border border-[#27272a] rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-white">
              <Clapperboard className="w-7 h-7 text-rose-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">No Reels Yet</h2>
              <p className="text-xs text-zinc-400">
                Be the first to share a vertical video Reel with the community!
              </p>
            </div>
            {currentUser && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateReelOpen(true)}
                leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
              >
                Create Reel
              </Button>
            )}
          </div>
        )}

        {/* Snap Scrolling Reels Feed Container */}
        {!loading && reels.length > 0 && (
          <div
            ref={containerRef}
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none py-2 space-y-6"
          >
            {reels.map((reel, idx) => (
              <div
                key={reel._id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                data-reel-index={idx}
                className="w-full h-full flex items-center justify-center snap-start"
              >
                <ReelPlayer
                  reel={reel}
                  isActive={idx === activeReelIndex}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                  onOpenComments={(id) => setCommentDrawerReelId(id)}
                  onReelDeleted={handleReelDeleted}
                />
              </div>
            ))}

            {/* End of Feed: "You're all caught up" State */}
            {!hasMore && reels.length > 0 && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 space-y-3 snap-start">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">You&apos;re all caught up</h3>
                <p className="text-xs text-zinc-400 max-w-xs">
                  You have watched all available Reels. Check back soon for fresh videos!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reel Comments Drawer */}
      <ReelCommentDrawer
        reelId={commentDrawerReelId}
        isOpen={Boolean(commentDrawerReelId)}
        onClose={() => setCommentDrawerReelId(null)}
        onCommentCountChange={handleCommentCountChange}
      />

      {/* Create Reel Modal */}
      <CreateReelModal
        isOpen={isCreateReelOpen}
        onClose={() => setIsCreateReelOpen(false)}
        onReelCreated={handleReelCreated}
      />
    </AppShell>
  );
}
