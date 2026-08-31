'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Clapperboard, Plus, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ReelPlayer, ReelData } from '@/components/reel/ReelPlayer';
import { ReelCommentDrawer } from '@/components/reel/ReelCommentDrawer';
import { CreateReelModal } from '@/components/reel/CreateReelModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { getStorageCache, setStorageCache } from '@/lib/storage-cache';

const REELS_CACHE_KEY = 'lioran_cached_reels_top';

function ReelsContent() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();

  const [reels, setReels] = useState<ReelData[]>(() => {
    const cached = getStorageCache<{ reels: ReelData[] }>(REELS_CACHE_KEY);
    return cached?.reels || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStorageCache<{ reels: ReelData[] }>(REELS_CACHE_KEY);
    return !(cached?.reels && cached.reels.length > 0);
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(() => {
    const cached = getStorageCache<{ nextCursor: string | null }>(REELS_CACHE_KEY);
    return cached?.nextCursor || null;
  });
  const [hasMore, setHasMore] = useState(true);

  // Active reel in viewport & unmuted by default
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Modals & Drawers
  const [commentDrawerReelId, setCommentDrawerReelId] = useState<string | null>(null);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);

  // Refs for snap container and item observers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const initialScrolledRef = useRef(false);

  // Get target reel ID from query or hash
  const getTargetReelId = useCallback((): string | null => {
    const paramId = searchParams.get('id') || searchParams.get('r');
    if (paramId) return paramId;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '').trim();
      if (hash) return hash;
    }
    return null;
  }, [searchParams]);

  // Initial Fetch with LocalStorage Cache in background
  useEffect(() => {
    let isMounted = true;

    fetch('/api/reels?limit=10', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.reels) {
          const fetchedReels = data.reels || [];
          setReels(fetchedReels);
          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          setStorageCache(REELS_CACHE_KEY, {
            reels: fetchedReels.slice(0, 20),
            nextCursor: data.nextCursor || null,
            hasMore: Boolean(data.hasMore),
          });
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('Fetch reels error:', e);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle deep-linking to target reel B (e.g. /reels#<id> or /reels?id=<id>)
  useEffect(() => {
    const targetId = getTargetReelId();
    if (!targetId || reels.length === 0) return;

    const targetIdx = reels.findIndex((r) => r._id === targetId);
    if (targetIdx >= 0) {
      if (!initialScrolledRef.current || activeReelIndex !== targetIdx) {
        initialScrolledRef.current = true;
        setActiveReelIndex(targetIdx);
        setTimeout(() => {
          itemRefs.current[targetIdx]?.scrollIntoView({ behavior: 'auto', block: 'center' });
        }, 50);
      }
    } else {
      // If target reel is not in loaded batch, fetch it specifically and place in front
      fetch(`/api/reels/${targetId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.reel) {
            setReels((prev) => {
              const filtered = prev.filter((r) => r._id !== targetId);
              return [data.reel, ...filtered];
            });
            setActiveReelIndex(0);
            setTimeout(() => {
              itemRefs.current[0]?.scrollIntoView({ behavior: 'auto', block: 'center' });
            }, 50);
          }
        })
        .catch((err) => console.error('Fetch specific target reel error:', err));
    }
  }, [reels, getTargetReelId, activeReelIndex]);

  // Listen for hashchange events
  useEffect(() => {
    const handleHashChange = () => {
      const targetId = getTargetReelId();
      if (!targetId) return;
      const targetIdx = reels.findIndex((r) => r._id === targetId);
      if (targetIdx >= 0) {
        setActiveReelIndex(targetIdx);
        itemRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [reels, getTargetReelId]);

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
          const combined = [...prev, ...newUnique];
          setStorageCache(REELS_CACHE_KEY, {
            reels: combined.slice(0, 20),
            nextCursor: data.nextCursor || null,
            hasMore: Boolean(data.hasMore),
          });
          return combined;
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
    setReels((prev) => {
      const updated = [newReel, ...prev];
      setStorageCache(REELS_CACHE_KEY, {
        reels: updated.slice(0, 20),
        nextCursor,
        hasMore,
      });
      return updated;
    });
    setActiveReelIndex(0);
    setTimeout(() => {
      itemRefs.current[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleReelDeleted = (deletedReelId: string) => {
    setReels((prev) => {
      const updated = prev.filter((r) => r._id !== deletedReelId);
      setStorageCache(REELS_CACHE_KEY, {
        reels: updated.slice(0, 20),
        nextCursor,
        hasMore,
      });
      return updated;
    });
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
    <div className="relative h-[calc(100dvh-3.5rem)] md:h-screen overflow-hidden flex flex-col items-center justify-center select-none bg-[#09090b]">
      {/* Floating Create Reel Button */}
      {currentUser && (
        <button
          onClick={() => setIsCreateReelOpen(true)}
          className="absolute top-4 right-4 md:right-8 z-30 flex items-center gap-2 bg-white text-zinc-950 font-bold px-3.5 py-2 rounded-xl text-xs hover:bg-zinc-200 transition-all shadow-2xl hover:scale-105 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Create Reel</span>
        </button>
      )}

      {/* Loading State */}
      {loading && reels.length === 0 && (
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

      {/* Snap Scrolling Reels Feed Container (Smooth Android Snap Experience) */}
      {reels.length > 0 && (
        <div
          ref={containerRef}
          className="w-full h-full overflow-y-auto snap-y snap-mandatory overscroll-y-contain scrollbar-none touch-pan-y"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {reels.map((reel, idx) => (
            <div
              key={reel._id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              data-reel-index={idx}
              className="w-full h-full flex items-center justify-center snap-start snap-always py-1 sm:py-2"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
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
            <div
              className="w-full h-full flex flex-col items-center justify-center text-center p-8 space-y-3 snap-start snap-always"
              style={{ scrollSnapAlign: 'start' }}
            >
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
    </div>
  );
}

export default function ReelsPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-[calc(100vh-4rem)] md:h-screen flex items-center justify-center bg-[#09090b]">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        }
      >
        <ReelsContent />
      </Suspense>
    </AppShell>
  );
}
