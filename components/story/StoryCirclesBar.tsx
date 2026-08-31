'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { StoryViewerModal, StoryGroupData } from './StoryViewerModal';
import { CreateStoryModal } from './CreateStoryModal';
import { getStorageCache, setStorageCache } from '@/lib/storage-cache';

const STORIES_CACHE_KEY = 'lioran_cached_stories';

export function StoryCirclesBar() {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();

  const [storyGroups, setStoryGroups] = useState<StoryGroupData[]>(() => {
    return getStorageCache<StoryGroupData[]>(STORIES_CACHE_KEY) || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStorageCache<StoryGroupData[]>(STORIES_CACHE_KEY);
    return !(cached && cached.length > 0);
  });
  const [activeAuthorIndex, setActiveAuthorIndex] = useState<number | null>(null);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);

  const fetchStoriesData = useCallback(async () => {
    try {
      const res = await fetch('/api/stories', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.storyGroups) {
        setStorageCache(STORIES_CACHE_KEY, data.storyGroups);
        return data.storyGroups || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch stories error:', e);
      return [];
    }
  }, []);

  const refreshStories = useCallback(async () => {
    const groups = await fetchStoriesData();
    if (groups.length > 0) {
      setStoryGroups(groups);
    }
  }, [fetchStoriesData]);

  const handleStoryViewed = useCallback((storyId: string) => {
    setStoryGroups((prev) => {
      const updated = prev.map((g) => {
        const hasStory = g.stories.some((s) => s._id === storyId);
        if (!hasStory) return g;
        const newStories = g.stories.map((s) =>
          s._id === storyId ? { ...s, hasViewed: true } : s
        );
        const isSelf = currentUser && g.author._id === currentUser._id;
        return {
          ...g,
          stories: newStories,
          hasUnseen: isSelf ? false : newStories.some((s) => !s.hasViewed),
        };
      });

      // Maintain sorting: self first, then unseen (glow), then seen (no glow)
      return [...updated].sort((a, b) => {
        const aIsSelf = currentUser && a.author._id === currentUser._id;
        const bIsSelf = currentUser && b.author._id === currentUser._id;
        if (aIsSelf) return -1;
        if (bIsSelf) return 1;
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        return 0;
      });
    });
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    fetchStoriesData().then((groups) => {
      if (isMounted) {
        setStoryGroups(groups);
        setLoading(false);
      }
    });

    // Realtime Socket & Custom Event Listeners
    const handleStoryRefresh = () => {
      if (isMounted) {
        refreshStories();
      }
    };

    window.addEventListener('story:refresh', handleStoryRefresh);

    if (socket) {
      socket.on('story:new', handleStoryRefresh);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('story:refresh', handleStoryRefresh);
      if (socket) {
        socket.off('story:new', handleStoryRefresh);
      }
    };
  }, [fetchStoriesData, refreshStories, socket]);

  // Check if current user has active stories
  const userStoryGroupIndex = storyGroups.findIndex(
    (g) => currentUser && g.author._id === currentUser._id
  );

  // Separate others' stories: unseen pushed to front (glowing), seen pushed to back (no glow)
  const otherStoryGroups = useMemo(() => {
    return storyGroups
      .filter((g) => !currentUser || g.author._id !== currentUser._id)
      .sort((a, b) => {
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        return 0;
      });
  }, [storyGroups, currentUser]);

  return (
    <div className="w-full bg-[#121215] border border-[#27272a] rounded-2xl p-3 sm:p-4 overflow-hidden">
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none select-none">
        {/* ================================================================= */}
        {/* User's Add Story Circle */}
        {/* ================================================================= */}
        {currentUser && (
          <div
            onClick={() => {
              if (userStoryGroupIndex >= 0) {
                setActiveAuthorIndex(userStoryGroupIndex);
              } else {
                setIsCreateStoryOpen(true);
              }
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div className="relative">
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] ${
                  userStoryGroupIndex >= 0
                    ? 'border-2 border-zinc-700 group-hover:border-zinc-500'
                    : 'border-2 border-dashed border-zinc-600 group-hover:border-zinc-400'
                } transition-all`}
              >
                <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-black overflow-hidden flex items-center justify-center font-bold text-sm text-white">
                  {currentUser.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentUser.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              </div>

              {/* Plus badge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateStoryOpen(true);
                }}
                className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-md border-2 border-black hover:scale-110 transition-transform"
                title="Add Story"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
            <span className="text-[11px] font-medium text-zinc-300 max-w-[64px] truncate">
              Your story
            </span>
          </div>
        )}

        {/* ================================================================= */}
        {/* Other Users' Story Circles (Unseen Glowing First, Seen Back) */}
        {/* ================================================================= */}
        {otherStoryGroups.map((group) => {
          const authorIdx = storyGroups.findIndex((g) => g.author._id === group.author._id);
          return (
            <div
              key={group.author._id}
              onClick={() => setActiveAuthorIndex(authorIdx >= 0 ? authorIdx : 0)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
            >
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] ${
                  group.hasUnseen
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md group-hover:scale-105'
                    : 'border-2 border-zinc-700 opacity-80 group-hover:opacity-100 group-hover:border-zinc-500'
                } transition-all duration-200`}
              >
                <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-black overflow-hidden flex items-center justify-center font-bold text-sm text-white">
                  {group.author.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.author.avatar}
                      alt={group.author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    group.author.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] max-w-[64px] truncate transition-colors ${
                  group.hasUnseen ? 'font-semibold text-white' : 'font-medium text-zinc-400'
                }`}
              >
                {group.author.username}
              </span>
            </div>
          );
        })}

        {!loading && storyGroups.length === 0 && !currentUser && (
          <p className="text-xs text-zinc-500 py-3 px-2">No active stories available right now.</p>
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeAuthorIndex !== null && (
        <StoryViewerModal
          key={activeAuthorIndex}
          storyGroups={storyGroups}
          initialAuthorIndex={activeAuthorIndex}
          isOpen={activeAuthorIndex !== null}
          onClose={() => {
            setActiveAuthorIndex(null);
            refreshStories();
          }}
          onStoryViewed={handleStoryViewed}
        />
      )}

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onStoryCreated={refreshStories}
      />
    </div>
  );
}
