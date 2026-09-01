'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Clapperboard,
  Bookmark,
  ShieldCheck,
  Calendar,
  UserPlus,
  UserCheck,
  Settings,
  MessageCircle,
  AlertCircle,
  Play,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/post/PostGrid';
import { PostCardData } from '@/components/post/PostCard';
import { ReelData } from '@/components/reel/ReelPlayer';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { FollowersListModal } from '@/components/profile/FollowersListModal';
import { useAuth } from '@/context/AuthContext';
import { SafeUser } from '@/types/user';
import { getOfflineCache, getStorageCache, setStorageCache, syncUserFollow, syncPostDeleted } from '@/lib/storage-cache';

interface ProfileData {
  user: SafeUser;
  isFollowing: boolean;
  isSelf: boolean;
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = use(params);
  const username = decodeURIComponent(resolvedParams.username || '').toLowerCase().trim();

  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(() => {
    return getOfflineCache<ProfileData>(`lioran_cached_profile_${username}`) || null;
  });
  const [loading, setLoading] = useState(() => {
    const offlineCache = getOfflineCache<ProfileData>(`lioran_cached_profile_${username}`);
    return !(offlineCache && offlineCache.user);
  });
  const [notFound, setNotFound] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Tabs & Media State (Loaded fresh, or from cache only if offline)
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [savedSubTab, setSavedSubTab] = useState<'posts' | 'reels'>('posts');
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [userPosts, setUserPosts] = useState<PostCardData[]>(() => {
    return getOfflineCache<PostCardData[]>(`lioran_cached_profile_posts_${username}`) || [];
  });
  const [userReels, setUserReels] = useState<ReelData[]>(() => {
    return getOfflineCache<ReelData[]>(`lioran_cached_profile_reels_${username}`) || [];
  });
  const [savedPosts, setSavedPosts] = useState<PostCardData[]>([]);
  const [savedReels, setSavedReels] = useState<ReelData[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const handleTabChange = (newTab: 'posts' | 'reels' | 'saved') => {
    if (newTab === activeTab) return;
    setIsTabTransitioning(true);
    setActiveTab(newTab);
    setTimeout(() => {
      setIsTabTransitioning(false);
    }, 240);
  };

  const handleSavedSubTabChange = (newSubTab: 'posts' | 'reels') => {
    if (newSubTab === savedSubTab) return;
    setIsTabTransitioning(true);
    setSavedSubTab(newSubTab);
    setTimeout(() => {
      setIsTabTransitioning(false);
    }, 240);
  };

  // Modals state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [followModalMode, setFollowModalMode] = useState<'followers' | 'following' | null>(null);

  const fetchProfileData = useCallback(async () => {
    if (!username) return { notFound: true, profile: null };
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, { cache: 'no-store' });
      if (res.status === 404) {
        return { notFound: true, profile: null };
      }

      const data = await res.json();
      if (res.ok && data.user) {
        setStorageCache(`lioran_cached_profile_${username}`, data);
        return { notFound: false, profile: data };
      }
      const fallbackCache = getStorageCache<ProfileData>(`lioran_cached_profile_${username}`);
      if (fallbackCache?.user) {
        return { notFound: false, profile: fallbackCache };
      }
      return { notFound: true, profile: null };
    } catch {
      const fallbackCache = getStorageCache<ProfileData>(`lioran_cached_profile_${username}`);
      if (fallbackCache?.user) {
        return { notFound: false, profile: fallbackCache };
      }
      return { notFound: true, profile: null };
    }
  }, [username]);

  const fetchUserPostsData = useCallback(async () => {
    if (!username) return [];
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/posts?limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.posts) {
        const posts = data.posts || [];
        setStorageCache(`lioran_cached_profile_posts_${username}`, posts.slice(0, 20));
        return posts;
      }
      return getStorageCache<PostCardData[]>(`lioran_cached_profile_posts_${username}`) || [];
    } catch (e) {
      console.error('Fetch user posts error:', e);
      return getStorageCache<PostCardData[]>(`lioran_cached_profile_posts_${username}`) || [];
    }
  }, [username]);

  const fetchUserReelsData = useCallback(async () => {
    if (!username) return [];
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/reels?limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.reels) {
        const reels = data.reels || [];
        setStorageCache(`lioran_cached_profile_reels_${username}`, reels.slice(0, 20));
        return reels;
      }
      return getStorageCache<ReelData[]>(`lioran_cached_profile_reels_${username}`) || [];
    } catch (e) {
      console.error('Fetch user reels error:', e);
      return getStorageCache<ReelData[]>(`lioran_cached_profile_reels_${username}`) || [];
    }
  }, [username]);

  const fetchSavedData = useCallback(async () => {
    if (!username || !profile?.isSelf) return { posts: [], reels: [] };
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/saved?limit=50`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return { posts: data.posts || [], reels: data.reels || [] };
      }
      return { posts: [], reels: [] };
    } catch (e) {
      console.error('Fetch saved items error:', e);
      return { posts: [], reels: [] };
    }
  }, [username, profile?.isSelf]);

  // When username changes, fetch fresh profile data in background
  useEffect(() => {
    let isMounted = true;

    fetchProfileData().then((result) => {
      if (isMounted) {
        setProfile(result.profile);
        setNotFound(result.notFound);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [username, fetchProfileData]);

  // Fetch active tab media
  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'posts') {
      fetchUserPostsData().then((posts) => {
        if (isMounted) {
          setUserPosts(posts);
          setMediaLoading(false);
        }
      });
    } else if (activeTab === 'reels') {
      fetchUserReelsData().then((reels) => {
        if (isMounted) {
          setUserReels(reels);
          setMediaLoading(false);
        }
      });
    } else if (activeTab === 'saved') {
      fetchSavedData().then((result) => {
        if (isMounted) {
          setSavedPosts(result.posts);
          setSavedReels(result.reels);
          setMediaLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [username, activeTab, fetchUserPostsData, fetchUserReelsData, fetchSavedData]);

  const refreshProfile = useCallback(async () => {
    const result = await fetchProfileData();
    if (result.profile) {
      setProfile(result.profile);
    }
  }, [fetchProfileData]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      router.push(`/login?callbackUrl=/u/${encodeURIComponent(username)}`);
      return;
    }
    if (!profile) return;

    setIsFollowLoading(true);

    const nextIsFollowing = !profile.isFollowing;
    const nextFollowersCount = nextIsFollowing
      ? profile.user.followersCount + 1
      : Math.max(0, profile.user.followersCount - 1);

    setProfile({
      ...profile,
      isFollowing: nextIsFollowing,
      user: {
        ...profile.user,
        followersCount: nextFollowersCount,
      },
    });
    syncUserFollow(username, nextIsFollowing, nextIsFollowing ? 1 : -1);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: data.isFollowing,
                user: {
                  ...prev.user,
                  followersCount: data.followersCount,
                },
              }
            : null
        );
        syncUserFollow(username, data.isFollowing, data.isFollowing ? 1 : -1);
      } else {
        refreshProfile();
      }
    } catch {
      refreshProfile();
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleProfileUpdated = (updatedUser: SafeUser) => {
    if (profile) {
      setProfile({
        ...profile,
        user: updatedUser,
      });
      setStorageCache(`lioran_cached_profile_${username}`, {
        ...profile,
        user: updatedUser,
      });
    }
  };

  const handlePostDeleted = (postId: string) => {
    syncPostDeleted(postId);
    setUserPosts((prev) => prev.filter((p) => p._id !== postId));
    setSavedPosts((prev) => prev.filter((p) => p._id !== postId));
    if (profile) {
      const updatedProfile = {
        ...profile,
        user: {
          ...profile.user,
          postsCount: Math.max(0, profile.user.postsCount - 1),
        },
      };
      setProfile(updatedProfile);
      setStorageCache(`lioran_cached_profile_${username}`, updatedProfile);
    }
  };

  if (loading && !profile) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-pulse">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-zinc-800 shrink-0" />
            <div className="space-y-4 w-full text-center md:text-left">
              <div className="h-6 bg-zinc-800 rounded w-48 mx-auto md:mx-0" />
              <div className="h-4 bg-zinc-800 rounded w-32 mx-auto md:mx-0" />
              <div className="h-10 bg-zinc-800 rounded w-full max-w-sm mx-auto md:mx-0" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound || !profile) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">User Not Found</h2>
          <p className="text-sm text-zinc-400">
            The profile for &quot;@{username}&quot; does not exist or may have been removed.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="secondary" size="md">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { user, isFollowing, isSelf } = profile;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8 pb-24 md:pb-8 select-none">
        {/* ================================================================= */}
        {/* Profile Header Area */}
        {/* ================================================================= */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-8 md:gap-12">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full border-2 border-[#27272a] bg-zinc-800 overflow-hidden flex items-center justify-center text-3xl font-bold text-white shadow-xl">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.displayName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
          </div>

          {/* User Details & Action Buttons */}
          <div className="space-y-3 sm:space-y-4 flex-1 text-center md:text-left min-w-0 w-full">
            {/* Username & Verification & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-all">
                  {user.displayName}
                </h1>
                {user.emailVerified && (
                  <span title="Verified Account">
                    <ShieldCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center md:justify-start gap-2">
                {isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                    leftIcon={<Settings className="w-4 h-4" />}
                    className="cursor-pointer"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      variant={isFollowing ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={handleToggleFollow}
                      isLoading={isFollowLoading}
                      leftIcon={
                        !isFollowLoading &&
                        (isFollowing ? (
                          <UserCheck className="w-4 h-4 text-zinc-300" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-zinc-950" />
                        ))
                      }
                      className="cursor-pointer"
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>

                    <Link href={`/messages?user=${user._id}`}>
                      <Button variant="secondary" size="sm" leftIcon={<MessageCircle className="w-4 h-4" />}>
                        Message
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Handle & Joined Date */}
            <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-zinc-400">
              <span className="font-mono text-zinc-300">@{user.username}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined{' '}
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            {/* Bio */}
            {user.bio ? (
              <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-line leading-relaxed max-w-xl mx-auto md:mx-0">
                {user.bio}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 italic max-w-xl mx-auto md:mx-0">
                {isSelf ? 'No bio yet. Click Edit Profile to add one.' : 'No bio provided.'}
              </p>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Followers / Following / Posts Counts Row */}
        {/* ================================================================= */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto md:max-w-none pt-1">
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-white">{user.postsCount || 0}</p>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Posts</p>
          </div>

          <button
            type="button"
            onClick={() => setFollowModalMode('followers')}
            className="bg-[#121215] border border-[#27272a] hover:border-zinc-500 rounded-xl p-3 sm:p-4 text-center transition-all cursor-pointer group"
          >
            <p className="text-lg sm:text-2xl font-bold text-white group-hover:text-zinc-200">
              {user.followersCount || 0}
            </p>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 group-hover:underline">Followers</p>
          </button>

          <button
            type="button"
            onClick={() => setFollowModalMode('following')}
            className="bg-[#121215] border border-[#27272a] hover:border-zinc-500 rounded-xl p-3 sm:p-4 text-center transition-all cursor-pointer group"
          >
            <p className="text-lg sm:text-2xl font-bold text-white group-hover:text-zinc-200">
              {user.followingCount || 0}
            </p>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 group-hover:underline">Following</p>
          </button>
        </div>

        {/* ================================================================= */}
        {/* Posts, Reels, and Saved Tabs Navigation */}
        {/* ================================================================= */}
        <div className="border-t border-[#27272a] pt-4 space-y-4 sm:space-y-6">
          <div className="flex justify-center gap-6 sm:gap-8 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => handleTabChange('posts')}
              className={`flex items-center gap-2 pb-2 transition-all duration-200 cursor-pointer ${
                activeTab === 'posts'
                  ? 'border-b-2 border-white text-white font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Grid className="w-4 h-4" /> Posts
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('reels')}
              className={`flex items-center gap-2 pb-2 transition-all duration-200 cursor-pointer ${
                activeTab === 'reels'
                  ? 'border-b-2 border-white text-white font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Clapperboard className="w-4 h-4" /> Reels
            </button>

            {isSelf && (
              <button
                type="button"
                onClick={() => handleTabChange('saved')}
                className={`flex items-center gap-2 pb-2 transition-all duration-200 cursor-pointer ${
                  activeTab === 'saved'
                    ? 'border-b-2 border-white text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Bookmark className="w-4 h-4" /> Saved
              </button>
            )}
          </div>

          {/* Sub-tabs for Saved (Posts vs Reels) */}
          {activeTab === 'saved' && (
            <div className="flex justify-center gap-3 pt-1 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => handleSavedSubTabChange('posts')}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                  savedSubTab === 'posts'
                    ? 'bg-white text-zinc-950 border-white font-bold'
                    : 'bg-[#18181b] text-zinc-400 border-[#27272a] hover:text-white'
                }`}
              >
                Saved Photos ({savedPosts.length})
              </button>
              <button
                type="button"
                onClick={() => handleSavedSubTabChange('reels')}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                  savedSubTab === 'reels'
                    ? 'bg-white text-zinc-950 border-white font-bold'
                    : 'bg-[#18181b] text-zinc-400 border-[#27272a] hover:text-white'
                }`}
              >
                Saved Reels ({savedReels.length})
              </button>
            </div>
          )}

          {/* Media Grid Container with Smooth Loading Animation */}
          {isTabTransitioning || (mediaLoading && userPosts.length === 0 && userReels.length === 0) ? (
            /* Sleek Skeleton Shimmer Grid Matching Tab Aspect Ratio */
            activeTab === 'reels' || (activeTab === 'saved' && savedSubTab === 'reels') ? (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 animate-in fade-in duration-200">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="relative aspect-[9/16] bg-[#141418] border border-[#27272a]/60 rounded-xl overflow-hidden animate-pulse flex flex-col justify-end p-2.5 sm:p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-zinc-800" />
                      <div className="h-3 w-8 bg-zinc-800 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 animate-in fade-in duration-200">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-[#141418] border border-[#27272a]/60 rounded-xl overflow-hidden animate-pulse flex items-center justify-center"
                  >
                    <div className="w-6 h-6 rounded-lg bg-zinc-800/60" />
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'reels' || (activeTab === 'saved' && savedSubTab === 'reels') ? (
            /* REELS 3-column vertical 9:16 grid */
            (activeTab === 'reels' ? userReels : savedReels).length === 0 ? (
              <div className="bg-[#121215]/50 border border-dashed border-[#27272a] rounded-2xl py-16 text-center space-y-3 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
                  <Clapperboard className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    {activeTab === 'saved' ? 'No Saved Reels' : 'No Reels Yet'}
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto px-4">
                    {activeTab === 'saved'
                      ? 'Reels you save will appear here.'
                      : isSelf
                      ? 'Create and share short vertical videos.'
                      : `@${user.username} hasn't published any reels yet.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 animate-in fade-in duration-200">
                {(activeTab === 'reels' ? userReels : savedReels).map((reel) => (
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 sm:p-3">
                      <div className="flex items-center gap-1.5 text-white text-xs font-bold">
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{reel.viewsCount || 0}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            /* POSTS / SAVED 3-column square grid */
            <div className="animate-in fade-in duration-200">
              <PostGrid
                posts={activeTab === 'posts' ? userPosts : savedPosts}
                onPostClick={(post) => setSelectedPostId(post._id)}
                emptyTitle={activeTab === 'posts' ? 'No Posts Yet' : 'No Saved Posts'}
                emptySubtitle={
                  activeTab === 'posts'
                    ? isSelf
                    ? 'Share your first photo with the world.'
                    : `@${user.username} hasn't published any posts yet.`
                    : 'Save photos and videos that you want to see again.'
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isSelf && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Followers / Following List Modal */}
      {followModalMode && (
        <FollowersListModal
          isOpen={Boolean(followModalMode)}
          onClose={() => setFollowModalMode(null)}
          username={user.username}
          mode={followModalMode}
          onRelationshipChanged={refreshProfile}
        />
      )}

      {/* Post Detail Modal */}
      <PostDetailModal
        postId={selectedPostId}
        isOpen={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
        onPostDeleted={handlePostDeleted}
      />
    </AppShell>
  );
}
