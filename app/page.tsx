'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, Users, Loader2, PlusSquare } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PostCard, PostCardData } from '@/components/post/PostCard';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Selected post for detail/comments modal
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sentinel ref for IntersectionObserver
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Initial fetch
  const fetchInitialFeedData = useCallback(async () => {
    try {
      const res = await fetch('/api/posts?limit=10', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return {
          posts: data.posts || [],
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
        };
      }
      return { posts: [], nextCursor: null, hasMore: false };
    } catch (e) {
      console.error('Fetch feed error:', e);
      return { posts: [], nextCursor: null, hasMore: false };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchInitialFeedData().then((result) => {
      if (isMounted) {
        setPosts(result.posts);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchInitialFeedData]);

  // Load more posts using cursor
  const loadMorePosts = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts?cursor=${nextCursor}&limit=10`);
      const data = await res.json();

      if (res.ok) {
        // Prevent duplicate posts
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p._id));
          const newUniquePosts = data.posts.filter((p: PostCardData) => !existingIds.has(p._id));
          return [...prev, ...newUniquePosts];
        });

        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (e) {
      console.error('Load more posts error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, hasMore]);

  // Setup IntersectionObserver for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, loadMorePosts]);

  const handlePostDeleted = (deletedPostId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  };

  const handlePostCreated = (newPost: PostCardData) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="w-full bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-28 h-3.5 bg-zinc-800 rounded" />
                    <div className="w-16 h-3 bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="w-full aspect-square bg-zinc-900" />
                <div className="p-4 space-y-2">
                  <div className="w-24 h-4 bg-zinc-800 rounded" />
                  <div className="w-48 h-3.5 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty Feed State */}
        {!loading && posts.length === 0 && (
          <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-white">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Welcome to Your Feed</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Your feed shows photos from people you follow and your own posts. Start following creators or share your first post!
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Link href="/search">
                <Button variant="secondary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                  Find People
                </Button>
              </Link>
              {user && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  leftIcon={<PlusSquare className="w-4 h-4" />}
                >
                  Create Post
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Posts List */}
        {!loading && posts.length > 0 && (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onOpenComments={(id) => setSelectedPostId(id)}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </div>
        )}

        {/* IntersectionObserver Sentinel for Infinite Scroll */}
        <div ref={observerTarget} className="py-4 text-center">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more posts...</span>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-xs text-zinc-600">You&apos;ve reached the end of the feed.</p>
          )}
        </div>
      </div>

      {/* Post Detail / Comments Modal */}
      <PostDetailModal
        postId={selectedPostId}
        isOpen={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
        onPostDeleted={handlePostDeleted}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </AppShell>
  );
}
