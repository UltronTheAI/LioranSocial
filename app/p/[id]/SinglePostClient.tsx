'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PostCard, PostCardData } from '@/components/post/PostCard';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { GuestAuthGateModal } from '@/components/auth/GuestAuthGateModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export function SinglePostClient({
  postId,
  initialPost,
}: {
  postId: string;
  initialPost?: PostCardData | null;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState<PostCardData | null>(initialPost || null);
  const [loading, setLoading] = useState(!initialPost);
  const [notFound, setNotFound] = useState(false);

  // Selected post for modal comments
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const timerTriggeredRef = useRef(false);

  // 1. Fetch Post Details (only if not provided initially)
  useEffect(() => {
    if (initialPost) return;
    let isMounted = true;

    fetch(`/api/posts/${postId}`, { cache: 'no-store' })
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
        if (data.post) {
          setPost(data.post);
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
  }, [postId, initialPost]);

  // 2. 10-second Guest Timer to Show Login Option
  useEffect(() => {
    if (authLoading || user || timerTriggeredRef.current) return;

    const timer = setTimeout(() => {
      if (!user && !timerTriggeredRef.current) {
        timerTriggeredRef.current = true;
        setIsAuthModalOpen(true);
      }
    }, 10000); // 10 seconds of watching/reading

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
          <div className="w-full bg-[#121215] border border-[#27272a] rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            <p className="text-xs text-zinc-500">Loading post...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound || !post) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Post Not Found</h2>
          <p className="text-sm text-zinc-400">
            This post may have been deleted or the link is invalid.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="secondary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Go to Home
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 pb-24 md:pb-8">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/posts');
              }
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {!user && (
            <div className="flex items-center gap-2">
              <Link href={`/login?callbackUrl=/p/${postId}`}>
                <Button variant="secondary" size="sm" className="text-xs px-3 py-1 h-8 font-bold">
                  Log In
                </Button>
              </Link>
              <Link href={`/register?callbackUrl=/p/${postId}`}>
                <Button variant="primary" size="sm" className="text-xs px-3 py-1 h-8 font-bold">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Guest Banner (if not logged in) */}
        {!user && !authLoading && (
          <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/60 to-zinc-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Experience more on LioranSocial</p>
                <p className="text-[11px] text-zinc-300">
                  Log in to follow @{post.author.username} and view stories.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs px-4 py-1.5 shrink-0 cursor-pointer font-bold"
            >
              Join Now
            </Button>
          </div>
        )}

        {/* The Post Card */}
        <PostCard
          post={post}
          onOpenComments={(id) => {
            if (!user) {
              setIsAuthModalOpen(true);
            } else {
              setSelectedPostId(id);
            }
          }}
        />
      </div>

      {/* Post Detail / Comments Modal for Authenticated users */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          isOpen={Boolean(selectedPostId)}
          onClose={() => setSelectedPostId(null)}
        />
      )}

      {/* Guest 10s Timer & Interaction Login Modal */}
      <GuestAuthGateModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        author={{
          username: post.author.username,
          displayName: post.author.displayName,
          avatar: post.author.avatar,
          emailVerified: post.author.emailVerified,
        }}
      />
    </AppShell>
  );
}

