'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Check,
  Send,
  Loader2,
  CirclePlus,
  Copy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PopulatedConversation } from '@/services/conversation.service';
import { useAuth } from '@/context/AuthContext';

export interface ShareToChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'post' | 'reel';
  contentId: string;
  author?: {
    username: string;
    displayName?: string;
    avatar?: string;
  };
  media?: { url: string; secureUrl: string; publicId?: string; width?: number; height?: number };
  mediaType?: 'image' | 'video';
}

interface SearchUserItem {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
}

export function ShareToChatModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  author,
  media,
  mediaType,
}: ShareToChatModalProps) {
  const { user: currentUser } = useAuth();

  const [conversations, setConversations] = useState<PopulatedConversation[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<SearchUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isSharingToStory, setIsSharingToStory] = useState(false);
  const [storySharedToast, setStorySharedToast] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const fetchConversationsData = useCallback(async () => {
    if (!isOpen) return [];
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (res.ok) {
        return data.conversations || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch conversations error:', e);
      return [];
    }
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      fetchConversationsData().then((convs) => {
        if (isMounted) {
          setConversations(convs);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, fetchConversationsData]);

  // Search users if query is typed
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?type=users&q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (res.ok) {
          setSearchedUsers(data.users || []);
        }
      } catch (e) {
        console.error('Search users error:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedSearchedUsers = searchQuery.trim().length >= 2 ? searchedUsers : [];

  const toggleSelectConversation = (convId: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // 1. Share to DMs / Groups
  const handleShare = async () => {
    if ((selectedConvIds.length === 0 && selectedUserIds.length === 0) || isSharing) return;

    setIsSharing(true);
    try {
      const res = await fetch('/api/conversations/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          targetConversationIds: selectedConvIds,
          targetUserIds: selectedUserIds,
          text: text.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSuccessToast(true);
        setTimeout(() => {
          setSuccessToast(false);
          onClose();
        }, 1200);
      }
    } catch (e) {
      console.error('Share content error:', e);
    } finally {
      setIsSharing(false);
    }
  };

  // 2. Share to Your Story
  const handleShareToStory = async () => {
    if (!currentUser || isSharingToStory) return;
    setIsSharingToStory(true);

    try {
      let storyMedia = media;
      let authorUsername = author?.username;
      let authorAvatar = author?.avatar;
      const targetMediaType = mediaType || (contentType === 'reel' ? 'video' : 'image');

      // If media or author wasn't supplied directly, resolve via content endpoint
      if (!storyMedia || !authorUsername) {
        if (contentType === 'post') {
          const res = await fetch(`/api/posts/${contentId}`);
          const data = await res.json();
          if (data?.post) {
            if (data.post.images && data.post.images[0]) {
              storyMedia = storyMedia || {
                url: data.post.images[0].url,
                secureUrl: data.post.images[0].secureUrl,
                publicId: data.post.images[0].publicId || 'post_share',
              };
            }
            authorUsername = authorUsername || data.post.author?.username;
            authorAvatar = authorAvatar || data.post.author?.avatar;
          }
        } else {
          const res = await fetch(`/api/reels/${contentId}`);
          const data = await res.json();
          if (data?.reel) {
            if (data.reel.video) {
              storyMedia = storyMedia || {
                url: data.reel.video.url,
                secureUrl: data.reel.video.secureUrl,
                publicId: data.reel.video.publicId || 'reel_share',
              };
            }
            authorUsername = authorUsername || data.reel.author?.username;
            authorAvatar = authorAvatar || data.reel.author?.avatar;
          }
        }
      }

      if (!storyMedia) {
        alert('Could not resolve media to share to story.');
        return;
      }

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media: storyMedia,
          mediaType: targetMediaType,
          sharedContent: {
            contentType,
            postId: contentType === 'post' ? contentId : undefined,
            reelId: contentType === 'reel' ? contentId : undefined,
            authorUsername: authorUsername || 'user',
            authorAvatar: authorAvatar || undefined,
          },
        }),
      });

      if (res.ok) {
        // Trigger live refresh event for story circles
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('story:refresh'));
        }

        setStorySharedToast(true);
        setTimeout(() => {
          setStorySharedToast(false);
          onClose();
        }, 1200);
      }
    } catch (e) {
      console.error('Share to story error:', e);
    } finally {
      setIsSharingToStory(false);
    }
  };

  // 3. Copy Link
  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl =
      contentType === 'reel'
        ? `${origin}/reels#${contentId}`
        : `${origin}/`;

    navigator.clipboard.writeText(shareUrl);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSelected = selectedConvIds.length + selectedUserIds.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">
            Share {contentType === 'post' ? 'Post' : 'Reel'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add to Your Story Option */}
        <div className="p-3 border-b border-[#27272a] bg-[#0e0e11]">
          <button
            type="button"
            onClick={handleShareToStory}
            disabled={isSharingToStory}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#18181b] to-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[1.5px] flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white">
                  {isSharingToStory ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  ) : (
                    <CirclePlus className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  )}
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                  Add {contentType === 'post' ? 'post' : 'reel'} to your story
                </p>
                <p className="text-[10px] text-zinc-400">Share to your 24-hour story</p>
              </div>
            </div>

            {storySharedToast ? (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Added!
              </span>
            ) : (
              <span className="text-xs text-zinc-500 group-hover:text-zinc-300 font-medium">
                Add +
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#27272a]">
          <Input
            placeholder="Search conversations or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Recipient List: Conversations & Users */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-60">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Existing Conversations */}
              {filteredConversations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    Conversations & Groups
                  </p>
                  {filteredConversations.map((conv) => {
                    const isSelected = selectedConvIds.includes(conv._id);
                    return (
                      <div
                        key={conv._id}
                        onClick={() => toggleSelectConversation(conv._id)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[#18181b] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                            {conv.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={conv.avatar} alt={conv.title} className="w-full h-full object-cover" />
                            ) : conv.type === 'group' ? (
                              <Users className="w-4 h-4 text-zinc-400" />
                            ) : (
                              conv.title.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{conv.title}</p>
                            <p className="text-[10px] text-zinc-400 capitalize">
                              {conv.type === 'group' ? `${conv.members.length} members` : 'Direct Message'}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-white border-white text-zinc-950' : 'border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Searched Users (for starting new DMs) */}
              {displayedSearchedUsers.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    Users
                  </p>
                  {displayedSearchedUsers.map((user) => {
                    const isSelected = selectedUserIds.includes(user._id);
                    return (
                      <div
                        key={user._id}
                        onClick={() => toggleSelectUser(user._id)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[#18181b] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                            {user.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                            ) : (
                              user.displayName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                            <p className="text-[10px] text-zinc-400">@{user.username}</p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-white border-white text-zinc-950' : 'border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredConversations.length === 0 && displayedSearchedUsers.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-8">No matching recipients found.</p>
              )}
            </>
          )}
        </div>

        {/* Optional Comment & Send Footer */}
        <div className="p-3.5 border-t border-[#27272a] bg-[#0e0e11] space-y-3">
          <input
            type="text"
            placeholder="Write a message (optional)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            maxLength={500}
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-[#18181b] px-3 py-1.5 rounded-xl border border-[#27272a] transition-colors cursor-pointer"
            >
              {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedToast ? 'Copied' : 'Copy link'}</span>
            </button>

            {successToast ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Check className="w-4 h-4" /> Sent!
              </div>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={totalSelected === 0 || isSharing}
                isLoading={isSharing}
                onClick={handleShare}
                rightIcon={<Send className="w-3.5 h-3.5" />}
                className="cursor-pointer"
              >
                Send ({totalSelected})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
