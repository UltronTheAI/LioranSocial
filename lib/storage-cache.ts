/**
 * Safe client-side localStorage caching and real-time state synchronization utility
 */

import { PostCardData } from '@/components/post/PostCard';
import { ReelData } from '@/components/reel/ReelPlayer';
import { StoryGroupData } from '@/components/story/StoryViewerModal';
import { SafeUser } from '@/types/user';

export const FEED_POSTS_CACHE_KEY = 'lioran_cached_feed_posts';
export const REELS_CACHE_KEY = 'lioran_cached_reels_top';
export const STORIES_CACHE_KEY = 'lioran_cached_stories';
export const SEARCH_CACHE_KEY = 'lioran_cached_search_discovery';

export function isOffline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

/**
 * Retrieve cached data only when offline (offline-first fallback)
 */
export function getOfflineCache<T>(key: string): T | null {
  if (!isOffline()) return null;
  return getStorageCache<T>(key);
}

export function getStorageCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`[Cache] Error reading ${key} from localStorage:`, err);
    return null;
  }
}

export function setStorageCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Cache] Error saving ${key} to localStorage:`, err);
  }
}

export function removeStorageCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Cache] Error removing ${key} from localStorage:`, err);
  }
}

// ============================================================================
// REALTIME MULTI-ENTITY SYNCHRONIZATION HELPERS
// ============================================================================

/**
 * Synchronize post updates (likes, saves, comments count, captions) across all cached lists
 */
export function syncPostUpdate(postId: string, update: Partial<PostCardData>): void {
  if (typeof window === 'undefined') return;

  // 1. Update Feed Posts Cache
  const feedCache = getStorageCache<{ posts: PostCardData[]; nextCursor: string | null; hasMore: boolean }>(FEED_POSTS_CACHE_KEY);
  if (feedCache?.posts) {
    const updated = feedCache.posts.map((p) => (p._id === postId ? { ...p, ...update } : p));
    setStorageCache(FEED_POSTS_CACHE_KEY, { ...feedCache, posts: updated });
  }

  // 2. Update Search Discovery Posts Cache
  const searchCache = getStorageCache<{ users: unknown[]; posts: PostCardData[]; reels: unknown[] }>(SEARCH_CACHE_KEY);
  if (searchCache?.posts) {
    const updated = searchCache.posts.map((p) => (p._id === postId ? { ...p, ...update } : p));
    setStorageCache(SEARCH_CACHE_KEY, { ...searchCache, posts: updated });
  }

  // 3. Update all cached profile posts
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('lioran_cached_profile_posts_')) {
        const posts = getStorageCache<PostCardData[]>(k);
        if (Array.isArray(posts) && posts.some((p) => p._id === postId)) {
          const updated = posts.map((p) => (p._id === postId ? { ...p, ...update } : p));
          setStorageCache(k, updated);
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error scanning profile posts for update:', e);
  }
}

/**
 * Synchronize new post creation into local cache
 */
export function syncPostCreated(newPost: PostCardData): void {
  if (typeof window === 'undefined') return;

  // 1. Prepend to Feed cache
  const feedCache = getStorageCache<{ posts: PostCardData[]; nextCursor: string | null; hasMore: boolean }>(FEED_POSTS_CACHE_KEY);
  if (feedCache) {
    const existing = feedCache.posts || [];
    const filtered = existing.filter((p) => p._id !== newPost._id);
    setStorageCache(FEED_POSTS_CACHE_KEY, {
      ...feedCache,
      posts: [newPost, ...filtered].slice(0, 20),
    });
  }

  // 2. Prepend to Author Profile Posts cache
  if (newPost.author?.username) {
    const profilePostsKey = `lioran_cached_profile_posts_${newPost.author.username.toLowerCase()}`;
    const profilePosts = getStorageCache<PostCardData[]>(profilePostsKey) || [];
    const filtered = profilePosts.filter((p) => p._id !== newPost._id);
    setStorageCache(profilePostsKey, [newPost, ...filtered].slice(0, 20));

    // Increment postsCount in profile info cache
    const profileInfoKey = `lioran_cached_profile_${newPost.author.username.toLowerCase()}`;
    const profileData = getStorageCache<{ user: SafeUser; isFollowing: boolean; isSelf: boolean }>(profileInfoKey);
    if (profileData?.user) {
      setStorageCache(profileInfoKey, {
        ...profileData,
        user: {
          ...profileData.user,
          postsCount: (profileData.user.postsCount || 0) + 1,
        },
      });
    }
  }
}

/**
 * Synchronize post deletion across all caches
 */
export function syncPostDeleted(postId: string): void {
  if (typeof window === 'undefined') return;

  // 1. Remove from Feed cache
  const feedCache = getStorageCache<{ posts: PostCardData[]; nextCursor: string | null; hasMore: boolean }>(FEED_POSTS_CACHE_KEY);
  if (feedCache?.posts) {
    setStorageCache(FEED_POSTS_CACHE_KEY, {
      ...feedCache,
      posts: feedCache.posts.filter((p) => p._id !== postId),
    });
  }

  // 2. Remove from Search discovery cache
  const searchCache = getStorageCache<{ users: unknown[]; posts: PostCardData[]; reels: unknown[] }>(SEARCH_CACHE_KEY);
  if (searchCache?.posts) {
    setStorageCache(SEARCH_CACHE_KEY, {
      ...searchCache,
      posts: searchCache.posts.filter((p) => p._id !== postId),
    });
  }

  // 3. Remove from all profile posts caches
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('lioran_cached_profile_posts_')) {
        const posts = getStorageCache<PostCardData[]>(k);
        if (Array.isArray(posts) && posts.some((p) => p._id === postId)) {
          setStorageCache(k, posts.filter((p) => p._id !== postId));
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error scanning profile posts for deletion:', e);
  }
}

/**
 * Synchronize reel updates (likes, saves, comments count, views count, caption) across all caches
 */
export function syncReelUpdate(reelId: string, update: Partial<ReelData>): void {
  if (typeof window === 'undefined') return;

  // 1. Update Reels Feed cache
  const reelsCache = getStorageCache<{ reels: ReelData[]; nextCursor: string | null; hasMore: boolean }>(REELS_CACHE_KEY);
  if (reelsCache?.reels) {
    const updated = reelsCache.reels.map((r) => (r._id === reelId ? { ...r, ...update } : r));
    setStorageCache(REELS_CACHE_KEY, { ...reelsCache, reels: updated });
  }

  // 2. Update Search Discovery Reels cache
  const searchCache = getStorageCache<{ users: unknown[]; posts: unknown[]; reels: ReelData[] }>(SEARCH_CACHE_KEY);
  if (searchCache?.reels) {
    const updated = searchCache.reels.map((r) => (r._id === reelId ? { ...r, ...update } : r));
    setStorageCache(SEARCH_CACHE_KEY, { ...searchCache, reels: updated });
  }

  // 3. Update all profile reels caches
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('lioran_cached_profile_reels_')) {
        const reels = getStorageCache<ReelData[]>(k);
        if (Array.isArray(reels) && reels.some((r) => r._id === reelId)) {
          const updated = reels.map((r) => (r._id === reelId ? { ...r, ...update } : r));
          setStorageCache(k, updated);
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error scanning profile reels for update:', e);
  }
}

/**
 * Synchronize new reel creation into local cache
 */
export function syncReelCreated(newReel: ReelData): void {
  if (typeof window === 'undefined') return;

  // 1. Prepend to Reels Feed cache
  const reelsCache = getStorageCache<{ reels: ReelData[]; nextCursor: string | null; hasMore: boolean }>(REELS_CACHE_KEY);
  if (reelsCache) {
    const existing = reelsCache.reels || [];
    const filtered = existing.filter((r) => r._id !== newReel._id);
    setStorageCache(REELS_CACHE_KEY, {
      ...reelsCache,
      reels: [newReel, ...filtered].slice(0, 20),
    });
  }

  // 2. Prepend to Author Profile Reels cache
  if (newReel.author?.username) {
    const profileReelsKey = `lioran_cached_profile_reels_${newReel.author.username.toLowerCase()}`;
    const profileReels = getStorageCache<ReelData[]>(profileReelsKey) || [];
    const filtered = profileReels.filter((r) => r._id !== newReel._id);
    setStorageCache(profileReelsKey, [newReel, ...filtered].slice(0, 20));
  }
}

/**
 * Synchronize reel deletion across all caches
 */
export function syncReelDeleted(reelId: string): void {
  if (typeof window === 'undefined') return;

  // 1. Remove from Reels Feed cache
  const reelsCache = getStorageCache<{ reels: ReelData[]; nextCursor: string | null; hasMore: boolean }>(REELS_CACHE_KEY);
  if (reelsCache?.reels) {
    setStorageCache(REELS_CACHE_KEY, {
      ...reelsCache,
      reels: reelsCache.reels.filter((r) => r._id !== reelId),
    });
  }

  // 2. Remove from Search discovery cache
  const searchCache = getStorageCache<{ users: unknown[]; posts: unknown[]; reels: ReelData[] }>(SEARCH_CACHE_KEY);
  if (searchCache?.reels) {
    setStorageCache(SEARCH_CACHE_KEY, {
      ...searchCache,
      reels: searchCache.reels.filter((r) => r._id !== reelId),
    });
  }

  // 3. Remove from profile reels caches
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('lioran_cached_profile_reels_')) {
        const reels = getStorageCache<ReelData[]>(k);
        if (Array.isArray(reels) && reels.some((r) => r._id === reelId)) {
          setStorageCache(k, reels.filter((r) => r._id !== reelId));
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error scanning profile reels for deletion:', e);
  }
}

/**
 * Synchronize user follow/unfollow status across Discovery and Profile caches
 */
export function syncUserFollow(targetUsername: string, isFollowing: boolean, followersDelta: number = 0): void {
  if (typeof window === 'undefined' || !targetUsername) return;
  const usernameLower = targetUsername.toLowerCase().trim();

  // 1. Update in Search Discovery cache
  const searchCache = getStorageCache<{ users: Array<{ username: string; isFollowing?: boolean }>; posts: unknown[]; reels: unknown[] }>(SEARCH_CACHE_KEY);
  if (searchCache?.users) {
    const updated = searchCache.users.map((u) =>
      u.username.toLowerCase() === usernameLower ? { ...u, isFollowing } : u
    );
    setStorageCache(SEARCH_CACHE_KEY, { ...searchCache, users: updated });
  }

  // 2. Update in Profile Info cache
  const profileKey = `lioran_cached_profile_${usernameLower}`;
  const profileData = getStorageCache<{ user: SafeUser; isFollowing: boolean; isSelf: boolean }>(profileKey);
  if (profileData?.user) {
    const currentFollowers = profileData.user.followersCount || 0;
    const newFollowers = Math.max(0, currentFollowers + followersDelta);
    setStorageCache(profileKey, {
      ...profileData,
      isFollowing,
      user: {
        ...profileData.user,
        followersCount: newFollowers,
      },
    });
  }
}

/**
 * Synchronize story viewed / de-glow in Stories cache
 */
export function syncStoryViewed(storyId: string, currentUserId?: string): void {
  if (typeof window === 'undefined') return;

  const cachedGroups = getStorageCache<StoryGroupData[]>(STORIES_CACHE_KEY);
  if (!cachedGroups || !Array.isArray(cachedGroups)) return;

  const updated = cachedGroups.map((g) => {
    const hasStory = g.stories.some((s) => s._id === storyId);
    if (!hasStory) return g;
    const newStories = g.stories.map((s) =>
      s._id === storyId ? { ...s, hasViewed: true } : s
    );
    const isSelf = currentUserId && g.author._id === currentUserId;
    return {
      ...g,
      stories: newStories,
      hasUnseen: isSelf ? false : newStories.some((s) => !s.hasViewed),
    };
  });

  // Re-sort: self first, then unseen in front, then seen in back
  const sorted = [...updated].sort((a, b) => {
    const aIsSelf = currentUserId && a.author._id === currentUserId;
    const bIsSelf = currentUserId && b.author._id === currentUserId;
    if (aIsSelf) return -1;
    if (bIsSelf) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    return 0;
  });

  setStorageCache(STORIES_CACHE_KEY, sorted);
}
