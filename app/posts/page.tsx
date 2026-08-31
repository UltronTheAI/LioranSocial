'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Grid,
  LayoutList,
  Sparkles,
  Plus,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PostCard, PostCardData } from '@/components/post/PostCard';
import { PostGrid } from '@/components/post/PostGrid';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { GuestAuthGateModal } from '@/components/auth/GuestAuthGateModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import {
  getStorageCache,
  setStorageCache,
  syncPostCreated,
} from '@/lib/storage-cache';

const EXPLORE_POSTS_CACHE_KEY = 'lioran_cached_explore_posts';

export default function PostsPage() {
  const { user: currentUser } = useAuth();

  const [posts, setPosts] = useState<PostCardData[]>(() => {
    const cached = getStorageCache<{ posts: PostCardData[] }>(EXPLORE_POSTS_CACHE_KEY);
    return cached?.posts || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStorageCache<{ posts: PostCardData[] }>(EXPLORE_POSTS_CACHE_KEY);
    return !(cached?.posts && cached.posts.length > 0);
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(() => {
    const cached = getStorageCache<{ nextCursor: string | null }>(EXPLORE_POSTS_CACHE_KEY);
    return cached?.nextCursor || null;
  });
  const [hasMore, setHasMore] = useState(true);

  // View Mode: 'feed' or 'grid'
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');

  // Modals
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isGuestAuthOpen, setIsGuestAuthOpen] = useState(false);

  const guestTimerTriggeredRef = useRef(false);

  // Initial Fetch with LocalStorage caching
  useEffect(() => {
    let isMounted = true;

    fetch('/api/posts?limit=12', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.posts) {
          setPosts(data.posts);
          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          setStorageCache(EXPLORE_POSTS_CACHE_KEY, {
            posts: data.posts.slice(0, 30),
            nextCursor: data.nextCursor || null,
            hasMore: Boolean(data.hasMore),
          });
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('Fetch posts error:', e);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 10-second Guest Timer to Show Login Option
  useEffect(() => {
    if (currentUser || guestTimerTriggeredRef.current) return;

    const timer = setTimeout(() => {
      if (!currentUser && !guestTimerTriggeredRef.current) {
        guestTimerTriggeredRef.current = true;
        setIsGuestAuthOpen(true);
      }
    }, 10000); // 10s of browsing posts

    return () => clearTimeout(timer);
  }, [currentUser]);

  // Infinite Scroll Load More
  const loadMorePosts = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts?cursor=${nextCursor}&limit=9`);
      const data = await res.json();
      if (res.ok && data.posts) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p._id));
          const newUnique = data.posts.filter((p: PostCardData) => !existingIds.has(p._id));
          const combined = [...prev, ...newUnique];
          setStorageCache(EXPLORE_POSTS_CACHE_KEY, {
            posts: combined.slice(0, 30),
            nextCursor: data.nextCursor || null,
            hasMore: Boolean(data.hasMore),
          });
          return combined;
        });
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (e) {
      console.error('Load more posts error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, hasMore]);

  const handlePostCreated = (newPost: PostCardData) => {
    syncPostCreated(newPost);
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostUpdated = (updatedPost: PostCardData) => {
    setPosts((prev) => prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
  };

  const handlePostDeleted = (deletedPostId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 pb-24 md:pb-12 select-none">
        {/* Header with Title & Controls */}
        <div className="flex items-center justify-between gap-4 border-b border-[#27272a] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Posts</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Explore
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Discover photos, carousels, and stories from creators
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode('feed')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'feed'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Feed View"
                aria-label="Feed View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Create Post Button (Logged-in) or Log In (Guest) */}
            {currentUser ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreatePostOpen(true)}
                leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
                className="text-xs font-bold shadow-lg"
              >
                <span className="hidden sm:inline">Create Post</span>
                <span className="sm:hidden">Post</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link href="/login?callbackUrl=/posts">
                  <Button variant="secondary" size="sm" className="text-xs px-3 font-semibold">
                    Log In
                  </Button>
                </Link>
                <Link href="/register?callbackUrl=/posts" className="hidden sm:block">
                  <Button variant="primary" size="sm" className="text-xs px-3 font-bold shadow-md">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && posts.length === 0 && (
          <div className="space-y-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#121215] border border-[#27272a] rounded-2xl p-4 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-zinc-800 rounded w-28" />
                    <div className="h-2.5 bg-zinc-800 rounded w-16" />
                  </div>
                </div>
                <div className="aspect-square bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && posts.length === 0 && (
          <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-10 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
              <ImageIcon className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">No Posts Yet</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Be the first to share a high-resolution photo or carousel with the community!
              </p>
            </div>
            {currentUser && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreatePostOpen(true)}
                leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
              >
                Create Post
              </Button>
            )}
          </div>
        )}

        {/* Content: Feed View */}
        {posts.length > 0 && viewMode === 'feed' && (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onOpenComments={(id) => setSelectedPostId(id)}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </div>
        )}

        {/* Content: Grid View */}
        {posts.length > 0 && viewMode === 'grid' && (
          <PostGrid
            posts={posts}
            onPostClick={(post) => setSelectedPostId(post._id)}
          />
        )}

        {/* Load More Button / Indicator */}
        {hasMore && posts.length > 0 && (
          <div className="pt-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMorePosts}
              disabled={loadingMore}
              leftIcon={
                loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined
              }
              className="text-xs font-semibold px-6 py-2"
            >
              {loadingMore ? 'Loading more posts...' : 'Load More Posts'}
            </Button>
          </div>
        )}

        {/* Caught Up Indicator */}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-6 border-t border-[#27272a]/60 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-400">You&apos;re all caught up!</p>
          </div>
        )}

        {/* Post Detail Modal */}
        <PostDetailModal
          postId={selectedPostId}
          isOpen={Boolean(selectedPostId)}
          onClose={() => setSelectedPostId(null)}
          onPostDeleted={handlePostDeleted}
        />

        {/* Create Post Modal */}
        <CreatePostModal
          isOpen={isCreatePostOpen}
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={handlePostCreated}
        />

        {/* Guest 10s Timer & Interaction Login Modal */}
        <GuestAuthGateModal
          isOpen={isGuestAuthOpen}
          onClose={() => setIsGuestAuthOpen(false)}
        />
      </div>
    </AppShell>
  );
}
