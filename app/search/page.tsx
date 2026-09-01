'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search as SearchIcon,
  Grid,
  UserPlus,
  UserCheck,
  Loader2,
  Play,
  Sparkles,
  Clapperboard,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/post/PostGrid';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { PostCardData } from '@/components/post/PostCard';
import { ReelData } from '@/components/reel/ReelPlayer';
import { useAuth } from '@/context/AuthContext';
import { getOfflineCache, getStorageCache, setStorageCache, syncUserFollow, SEARCH_CACHE_KEY } from '@/lib/storage-cache';

interface SearchUser {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isFollowing?: boolean;
}

export default function SearchPage() {
  const { user: currentUser } = useAuth();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'top' | 'users' | 'posts' | 'reels'>('top');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(false);

  // Discovery data (only loaded from cache if offline)
  const [discoveryUsers, setDiscoveryUsers] = useState<SearchUser[]>(() => {
    const offlineCache = getOfflineCache<{ users: SearchUser[] }>(SEARCH_CACHE_KEY);
    return offlineCache?.users || [];
  });
  const [discoveryPosts, setDiscoveryPosts] = useState<PostCardData[]>(() => {
    const offlineCache = getOfflineCache<{ posts: PostCardData[] }>(SEARCH_CACHE_KEY);
    return offlineCache?.posts || [];
  });
  const [discoveryReels, setDiscoveryReels] = useState<ReelData[]>(() => {
    const offlineCache = getOfflineCache<{ reels: ReelData[] }>(SEARCH_CACHE_KEY);
    return offlineCache?.reels || [];
  });
  const [loadingDiscovery, setLoadingDiscovery] = useState(() => {
    const offlineCache = getOfflineCache<{ users: SearchUser[] }>(SEARCH_CACHE_KEY);
    return !(offlineCache && offlineCache.users && offlineCache.users.length > 0);
  });

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [togglingUsernames, setTogglingUsernames] = useState<Record<string, boolean>>({});

  // Always fetch fresh discovery suggestions from internet when online
  useEffect(() => {
    let isMounted = true;

    fetch('/api/search?q=&type=top', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const freshUsers = data.users || [];
        const freshPosts = data.posts || [];
        const freshReels = data.reels || [];

        setDiscoveryUsers(freshUsers);
        setDiscoveryPosts(freshPosts);
        setDiscoveryReels(freshReels);

        setStorageCache(SEARCH_CACHE_KEY, {
          users: freshUsers,
          posts: freshPosts,
          reels: freshReels,
        });
        setLoadingDiscovery(false);
      })
      .catch((e) => {
        console.error('Fetch discovery error:', e);
        if (isMounted) {
          const fallbackCache = getStorageCache<{ users: SearchUser[]; posts: PostCardData[]; reels: ReelData[] }>(SEARCH_CACHE_KEY);
          if (fallbackCache) {
            if (fallbackCache.users) setDiscoveryUsers(fallbackCache.users);
            if (fallbackCache.posts) setDiscoveryPosts(fallbackCache.posts);
            if (fallbackCache.reels) setDiscoveryReels(fallbackCache.reels);
          }
          setLoadingDiscovery(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Execute active query search
  const executeSearch = useCallback(async (searchQuery: string, searchType: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=${searchType}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setPosts(data.posts || []);
        setReels(data.reels || []);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query, activeTab);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab, executeSearch]);

  const handleToggleFollow = async (targetUsername: string) => {
    if (!currentUser) return;
    setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: true }));

    const targetUser = users.find((u) => u.username === targetUsername) || discoveryUsers.find((u) => u.username === targetUsername);
    const nextIsFollowing = !targetUser?.isFollowing;

    // Optimistic UI update & storage sync
    setUsers((prev) =>
      prev.map((u) =>
        u.username === targetUsername ? { ...u, isFollowing: nextIsFollowing } : u
      )
    );
    setDiscoveryUsers((prev) =>
      prev.map((u) =>
        u.username === targetUsername ? { ...u, isFollowing: nextIsFollowing } : u
      )
    );
    syncUserFollow(targetUsername, nextIsFollowing, nextIsFollowing ? 1 : -1);

    try {
      const res = await fetch(`/api/users/${targetUsername}/follow`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.username === targetUsername ? { ...u, isFollowing: data.isFollowing } : u
          )
        );
        setDiscoveryUsers((prev) =>
          prev.map((u) =>
            u.username === targetUsername ? { ...u, isFollowing: data.isFollowing } : u
          )
        );
        syncUserFollow(targetUsername, data.isFollowing, data.isFollowing ? 1 : -1);
      }
    } catch {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) =>
          u.username === targetUsername ? { ...u, isFollowing: !nextIsFollowing } : u
        )
      );
      setDiscoveryUsers((prev) =>
        prev.map((u) =>
          u.username === targetUsername ? { ...u, isFollowing: !nextIsFollowing } : u
        )
      );
      syncUserFollow(targetUsername, !nextIsFollowing, !nextIsFollowing ? 1 : -1);
    } finally {
      setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: false }));
    }
  };

  const isSearching = query.trim().length > 0;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 pb-24 md:pb-8 select-none">
        {/* Search Header */}
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-white tracking-tight">Search & Discovery</h1>
          <Input
            placeholder="Search accounts, posts, or reels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<SearchIcon className="w-4 h-4" />}
            autoFocus
          />

          {/* Search Tabs (Shown when typing) */}
          {isSearching && (
            <div className="flex items-center gap-2 border-b border-[#27272a] pb-2 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('top')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'top' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'users' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Users
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'posts' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Posts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reels')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'reels' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Reels
              </button>
            </div>
          )}
        </div>

        {/* Loading Spinner during search */}
        {loading && (
          <div className="py-16 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}

        {/* ================================================================= */}
        {/* DEFAULT DISCOVERY VIEW (When search box is empty) */}
        {/* ================================================================= */}
        {!isSearching && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Suggested 5 Accounts Section */}
            {discoveryUsers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Suggested Creators</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">5 Discovery Accounts</span>
                </div>

                <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-2 divide-y divide-[#27272a]/60 shadow-xl">
                  {discoveryUsers.map((item) => {
                    const isSelf = currentUser && currentUser._id.toString() === item._id;
                    return (
                      <div
                        key={item._id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-[#18181b] transition-colors group"
                      >
                        <Link
                          href={`/u/${item.username}`}
                          className="flex items-center gap-3 min-w-0 flex-1"
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                            {item.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.avatar}
                                alt={item.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.displayName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate group-hover:underline">
                              {item.displayName}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">@{item.username}</p>
                          </div>
                        </Link>

                        {currentUser && !isSelf && (
                          <Button
                            size="sm"
                            variant={item.isFollowing ? 'secondary' : 'primary'}
                            isLoading={togglingUsernames[item.username]}
                            onClick={() => handleToggleFollow(item.username)}
                            className="ml-3 shrink-0 text-xs px-3 py-1.5 h-8 cursor-pointer"
                            leftIcon={
                              item.isFollowing ? (
                                <UserCheck className="w-3.5 h-3.5 text-zinc-300" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5 text-zinc-950" />
                              )
                            }
                          >
                            {item.isFollowing ? 'Following' : 'Follow'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trending Discovery Reels */}
            {discoveryReels.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <Clapperboard className="w-3.5 h-3.5 text-rose-400" />
                  <span>Trending Reels</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {discoveryReels.map((reel) => (
                    <Link
                      key={reel._id}
                      href={`/reels#${reel._id}`}
                      className="relative aspect-[9/16] bg-[#121215] border border-[#27272a]/60 rounded-xl overflow-hidden group cursor-pointer"
                    >
                      {reel.video.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={reel.video.thumbnail}
                          alt="Reel thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <video
                          src={reel.video.secureUrl || reel.video.url}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="flex items-center gap-1 text-white text-[11px] font-bold">
                          <Play className="w-3 h-3 fill-white" />
                          <span>{reel.viewsCount || 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Explore Posts Grid */}
            {discoveryPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <Grid className="w-3.5 h-3.5 text-blue-400" />
                  <span>Explore Posts</span>
                </div>
                <PostGrid
                  posts={discoveryPosts}
                  onPostClick={(post) => setSelectedPostId(post._id)}
                />
              </div>
            )}

            {loadingDiscovery && discoveryUsers.length === 0 && (
              <div className="py-12 text-center text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <p className="text-xs text-zinc-400">Loading discovery suggestions...</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ACTIVE SEARCH RESULTS CONTAINER */}
        {/* ================================================================= */}
        {!loading && isSearching && (
          <div className="space-y-6">
            {/* Users Section */}
            {(activeTab === 'top' || activeTab === 'users') && users.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'top' && (
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Accounts</h3>
                )}
                <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-2 divide-y divide-[#27272a]/60">
                  {users.map((item) => {
                    const isSelf = currentUser && currentUser._id.toString() === item._id;
                    return (
                      <div
                        key={item._id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-[#18181b] transition-colors"
                      >
                        <Link
                          href={`/u/${item.username}`}
                          className="flex items-center gap-3 min-w-0 flex-1 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-semibold text-sm text-white shrink-0">
                            {item.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.avatar}
                                alt={item.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.displayName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate group-hover:underline">
                              {item.displayName}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">@{item.username}</p>
                          </div>
                        </Link>

                        {currentUser && !isSelf && (
                          <Button
                            size="sm"
                            variant={item.isFollowing ? 'secondary' : 'primary'}
                            isLoading={togglingUsernames[item.username]}
                            onClick={() => handleToggleFollow(item.username)}
                            className="ml-3 shrink-0 text-xs px-3 py-1.5 h-8"
                            leftIcon={
                              item.isFollowing ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5" />
                              )
                            }
                          >
                            {item.isFollowing ? 'Following' : 'Follow'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reels Section */}
            {(activeTab === 'top' || activeTab === 'reels') && reels.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'top' && (
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Reels</h3>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {reels.map((reel) => (
                    <Link
                      key={reel._id}
                      href={`/reels#${reel._id}`}
                      className="relative aspect-[9/16] bg-[#121215] border border-[#27272a]/60 rounded-xl overflow-hidden group cursor-pointer"
                    >
                      {reel.video.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={reel.video.thumbnail}
                          alt="Reel thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <video
                          src={reel.video.secureUrl || reel.video.url}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="flex items-center gap-1 text-white text-[11px] font-bold">
                          <Play className="w-3 h-3 fill-white" />
                          <span>{reel.viewsCount || 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Section */}
            {(activeTab === 'top' || activeTab === 'posts') && posts.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'top' && (
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Posts</h3>
                )}
                <PostGrid
                  posts={posts}
                  onPostClick={(post) => setSelectedPostId(post._id)}
                />
              </div>
            )}

            {/* No Results Found */}
            {users.length === 0 && posts.length === 0 && reels.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
                  <Grid className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">No Results Found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  No accounts, posts, or reels matched &quot;{query}&quot;. Try a different search keyword.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      <PostDetailModal
        postId={selectedPostId}
        isOpen={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
      />
    </AppShell>
  );
}
