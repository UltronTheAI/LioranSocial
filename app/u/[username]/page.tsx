'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Bookmark,
  ShieldCheck,
  Calendar,
  UserPlus,
  UserCheck,
  Settings,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/post/PostGrid';
import { PostCardData } from '@/components/post/PostCard';
import { PostDetailModal } from '@/components/post/PostDetailModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { FollowersListModal } from '@/components/profile/FollowersListModal';
import { useAuth } from '@/context/AuthContext';
import { SafeUser } from '@/types/user';

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
  const username = resolvedParams.username;

  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Tabs & Posts State
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [userPosts, setUserPosts] = useState<PostCardData[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostCardData[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Modals state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [followModalMode, setFollowModalMode] = useState<'followers' | 'following' | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${username}`, { cache: 'no-store' });
      if (res.status === 404) {
        return { notFound: true, profile: null };
      }

      const data = await res.json();
      if (res.ok) {
        return { notFound: false, profile: data };
      }
      return { notFound: true, profile: null };
    } catch {
      return { notFound: true, profile: null };
    }
  }, [username]);

  const fetchUserPostsData = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${username}/posts?limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return data.posts || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch user posts error:', e);
      return [];
    }
  }, [username]);

  const fetchSavedPostsData = useCallback(async () => {
    if (!profile?.isSelf) return [];
    try {
      const res = await fetch(`/api/users/${username}/saved?limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return data.posts || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch saved posts error:', e);
      return [];
    }
  }, [username, profile?.isSelf]);

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
  }, [fetchProfileData]);

  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'posts') {
      fetchUserPostsData().then((posts) => {
        if (isMounted) {
          setUserPosts(posts);
          setPostsLoading(false);
        }
      });
    } else if (activeTab === 'saved') {
      fetchSavedPostsData().then((posts) => {
        if (isMounted) {
          setSavedPosts(posts);
          setPostsLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, fetchUserPostsData, fetchSavedPostsData]);

  const refreshProfile = useCallback(async () => {
    const result = await fetchProfileData();
    if (result.profile) {
      setProfile(result.profile);
    }
  }, [fetchProfileData]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      router.push(`/login?callbackUrl=/u/${username}`);
      return;
    }
    if (!profile) return;

    setIsFollowLoading(true);

    // Optimistic UI update
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

    try {
      const res = await fetch(`/api/users/${username}/follow`, {
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
      if (updatedUser.username !== username) {
        router.replace(`/u/${updatedUser.username}`);
      }
    }
  };

  const handlePostDeleted = (deletedPostId: string) => {
    setUserPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
    setSavedPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
    if (profile) {
      setProfile({
        ...profile,
        user: {
          ...profile.user,
          postsCount: Math.max(0, profile.user.postsCount - 1),
        },
      });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-800" />
            <div className="space-y-3 flex-1 w-full text-center sm:text-left">
              <div className="h-6 bg-zinc-800 rounded w-48 mx-auto sm:mx-0" />
              <div className="h-4 bg-zinc-800 rounded w-32 mx-auto sm:mx-0" />
              <div className="h-4 bg-zinc-800 rounded w-64 mx-auto sm:mx-0" />
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
          <div className="w-14 h-14 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">User Not Found</h2>
          <p className="text-sm text-zinc-400">
            The user @{username} doesn&apos;t exist or might have been removed.
          </p>
          <Link href="/">
            <Button variant="secondary" size="sm">
              Back to Home
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const { user, isFollowing, isSelf } = profile;
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8">
        {/* ================================================================= */}
        {/* Profile Header */}
        {/* ================================================================= */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 bg-[#121215] border border-[#27272a] rounded-2xl p-6 sm:p-8">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-900 border-2 border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-3xl text-white shrink-0 shadow-xl">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              user.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {user.displayName}
                  </h1>
                  {user.emailVerified && (
                    <span title="Verified Account">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-sm font-mono text-zinc-400">@{user.username}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center sm:justify-start gap-2">
                {isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                    leftIcon={<Settings className="w-4 h-4" />}
                    className="text-xs px-4"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Button
                    variant={isFollowing ? 'secondary' : 'primary'}
                    size="sm"
                    isLoading={isFollowLoading}
                    onClick={handleToggleFollow}
                    leftIcon={
                      isFollowing ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )
                    }
                    className="text-xs px-5"
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
              </div>
            </div>

            {/* Bio */}
            {user.bio ? (
              <p className="text-sm text-zinc-300 leading-relaxed max-w-xl whitespace-pre-wrap">
                {user.bio}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 italic">No bio available</p>
            )}

            {/* Joined Date */}
            {joinDate && (
              <p className="text-xs text-zinc-500 flex items-center justify-center sm:justify-start gap-1.5 pt-1">
                <Calendar className="w-3.5 h-3.5" /> Joined {joinDate}
              </p>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Stats Row */}
        {/* ================================================================= */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-white">{user.postsCount || 0}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Posts</p>
          </div>

          <button
            type="button"
            onClick={() => setFollowModalMode('followers')}
            className="bg-[#121215] border border-[#27272a] hover:border-zinc-500 rounded-xl p-4 text-center transition-all cursor-pointer group"
          >
            <p className="text-xl sm:text-2xl font-bold text-white group-hover:text-zinc-200">
              {user.followersCount || 0}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 group-hover:underline">Followers</p>
          </button>

          <button
            type="button"
            onClick={() => setFollowModalMode('following')}
            className="bg-[#121215] border border-[#27272a] hover:border-zinc-500 rounded-xl p-4 text-center transition-all cursor-pointer group"
          >
            <p className="text-xl sm:text-2xl font-bold text-white group-hover:text-zinc-200">
              {user.followingCount || 0}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 group-hover:underline">Following</p>
          </button>
        </div>

        {/* ================================================================= */}
        {/* Posts and Saved Tabs Navigation */}
        {/* ================================================================= */}
        <div className="border-t border-[#27272a] pt-4 space-y-6">
          <div className="flex justify-center gap-8 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 pb-2 transition-colors cursor-pointer ${
                activeTab === 'posts'
                  ? 'border-b-2 border-white text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Grid className="w-4 h-4" /> Posts
            </button>
            {isSelf && (
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`flex items-center gap-2 pb-2 transition-colors cursor-pointer ${
                  activeTab === 'saved'
                    ? 'border-b-2 border-white text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Bookmark className="w-4 h-4" /> Saved
              </button>
            )}
          </div>

          {/* Posts Grid Container */}
          {postsLoading ? (
            <div className="py-16 text-center text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : (
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
