'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, Users, Grid, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/post/PostGrid';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { PostCardData } from '@/components/post/PostCard';
import { useAuth } from '@/context/AuthContext';

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
  const [activeTab, setActiveTab] = useState<'top' | 'users' | 'posts'>('top');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [togglingUsernames, setTogglingUsernames] = useState<Record<string, boolean>>({});

  const executeSearch = useCallback(async (searchQuery: string, searchType: string) => {
    if (!searchQuery.trim()) {
      setUsers([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(query, activeTab);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab, executeSearch]);

  const handleToggleFollow = async (targetUsername: string) => {
    if (!currentUser) return;
    setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: true }));

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
      )
    );

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
      } else {
        // Rollback
        setUsers((prev) =>
          prev.map((u) =>
            u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
          )
        );
      }
    } catch {
      // Rollback
      setUsers((prev) =>
        prev.map((u) =>
          u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
        )
      );
    } finally {
      setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: false }));
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Search Header */}
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-white">Search</h1>
          <Input
            placeholder="Search accounts or post captions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<SearchIcon className="w-4 h-4" />}
            autoFocus
          />

          {/* Search Tabs */}
          {query.trim().length > 0 && (
            <div className="flex items-center gap-2 border-b border-[#27272a] pb-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('top')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'top' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'users' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Users
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'posts' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Posts
              </button>
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}

        {/* Initial Empty State */}
        {!loading && !query.trim() && (
          <div className="py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Explore the Community</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Type in a name, username, or topic above to find accounts and photo posts.
            </p>
          </div>
        )}

        {/* Results Container */}
        {!loading && query.trim().length > 0 && (
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
            {users.length === 0 && posts.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
                  <Grid className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">No Results Found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  No accounts or posts matched &quot;{query}&quot;. Try a different search keyword.
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
