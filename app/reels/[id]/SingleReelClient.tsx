'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ReelPlayer, ReelData } from '@/components/reel/ReelPlayer';
import { ReelCommentDrawer } from '@/components/reel/ReelCommentDrawer';
import { GuestAuthGateModal } from '@/components/auth/GuestAuthGateModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export function SingleReelClient({
  reelId,
  initialReel,
}: {
  reelId: string;
  initialReel?: ReelData | null;
}) {
  const { user, loading: authLoading } = useAuth();

  const [reel, setReel] = useState<ReelData | null>(initialReel || null);
  const [loading, setLoading] = useState(!initialReel);
  const [notFound, setNotFound] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [commentDrawerReelId, setCommentDrawerReelId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const timerTriggeredRef = useRef(false);

  // 1. Fetch Reel Details (Only if not provided initially or refresh needed)
  useEffect(() => {
    if (initialReel) return;
    let isMounted = true;

    fetch(`/api/reels/${reelId}`, { cache: 'no-store' })
      .then((res) => {
        if (res.status === 404) {
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.reel) {
          setReel(data.reel);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reelId, initialReel]);

  // 2. 10-second Guest Timer to Show Login Option
  useEffect(() => {
    if (authLoading || user || timerTriggeredRef.current) return;

    const timer = setTimeout(() => {
      if (!user && !timerTriggeredRef.current) {
        timerTriggeredRef.current = true;
        setIsAuthModalOpen(true);
      }
    }, 10000); // 10 seconds of watching reel

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  const handleCommentCountChange = (newCount: number) => {
    if (reel) {
      setReel({
        ...reel,
        commentsCount: newCount,
      });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-[100dvh] md:h-screen flex items-center justify-center bg-[#09090b]">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            <p className="text-xs text-zinc-500">Loading reel...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound || !reel) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Reel Not Found</h2>
          <p className="text-sm text-zinc-400">
            This reel may have been deleted or the link is invalid.
          </p>
          <div className="pt-2">
            <Link href="/reels">
              <Button variant="secondary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Explore More Reels
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relative w-full h-[calc(100dvh-3.5rem)] md:h-screen overflow-hidden flex flex-col items-center justify-center select-none bg-[#09090b]">
        {/* Top Back / Login Bar */}
        <div className="absolute top-4 left-4 md:left-8 z-30 flex items-center gap-3">
          <Link
            href="/reels"
            className="flex items-center gap-2 bg-black/60 backdrop-blur-md text-white font-semibold px-3 py-1.5 rounded-xl text-xs hover:bg-black/80 transition-all shadow-lg border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>More Reels</span>
          </Link>
        </div>

        {!user && (
          <div className="absolute top-4 right-4 md:right-8 z-30 flex items-center gap-2">
            <Link href={`/login?callbackUrl=/reels/${reelId}`}>
              <Button variant="secondary" size="sm" className="text-xs px-3 py-1 h-8 font-bold bg-black/60 border border-white/20 backdrop-blur-md text-white">
                Log In
              </Button>
            </Link>
            <Link href={`/register?callbackUrl=/reels/${reelId}`}>
              <Button variant="primary" size="sm" className="text-xs px-3 py-1 h-8 font-bold shadow-lg">
                Sign Up
              </Button>
            </Link>
          </div>
        )}

        {/* Reel Player (Cleanly fits above bottom nav on mobile) */}
        <div className="w-full h-[calc(100dvh-3.5rem)] md:h-screen flex items-center justify-center p-0 sm:py-2">
          <ReelPlayer
            reel={reel}
            isActive={true}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onOpenComments={(id) => {
              if (!user) {
                setIsAuthModalOpen(true);
              } else {
                setCommentDrawerReelId(id);
              }
            }}
          />
        </div>

        {/* Reel Comments Drawer */}
        <ReelCommentDrawer
          reelId={commentDrawerReelId}
          isOpen={Boolean(commentDrawerReelId)}
          onClose={() => setCommentDrawerReelId(null)}
          onCommentCountChange={handleCommentCountChange}
        />

        {/* Guest 10s Timer & Interaction Login Modal */}
        <GuestAuthGateModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          author={{
            username: reel.author.username,
            displayName: reel.author.displayName,
            avatar: reel.author.avatar,
            emailVerified: reel.author.emailVerified,
          }}
        />
      </div>
    </AppShell>
  );
}
