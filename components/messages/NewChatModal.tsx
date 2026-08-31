'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Users, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { PopulatedConversation } from '@/services/conversation.service';

interface SearchUser {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
}

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: PopulatedConversation) => void;
}

export function NewChatModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewChatModalProps) {
  const { user: currentUser } = useAuth();

  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=users`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(
          (data.users || []).filter(
            (u: SearchUser) => currentUser && u._id !== currentUser._id
          )
        );
      }
    } catch (e) {
      console.error('Search users error:', e);
    } finally {
      setSearching(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleToggleSelectUser = (userId: string) => {
    if (mode === 'dm') {
      handleCreateDM(userId);
    } else {
      setSelectedUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreateDM = async (recipientUserId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dm', recipientUserId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create DM');
      }

      onConversationCreated(data.conversation);
      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to create conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || selectedUserIds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          title: groupTitle.trim(),
          memberUserIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create group');
      }

      onConversationCreated(data.conversation);
      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUserIds([]);
    setGroupTitle('');
    setError(null);
    setMode('dm');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">
            {mode === 'dm' ? 'New Direct Message' : 'Create Group Chat'}
          </h3>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch (DM / Group) */}
        <div className="flex items-center border-b border-[#27272a] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('dm')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              mode === 'dm'
                ? 'border-b-2 border-white text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Direct Message
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              mode === 'group'
                ? 'border-b-2 border-white text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Group Chat
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {error && <div className="p-2.5 text-xs bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300">{error}</div>}

          {/* Group Name input if in group mode */}
          {mode === 'group' && (
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Group Name</label>
              <Input
                placeholder="e.g. Design Enthusiasts, Weekend Squad"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {/* Search User Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">
              {mode === 'dm' ? 'To:' : 'Add Members:'}
            </label>
            <Input
              placeholder="Search user by name or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* User Results List */}
          <div className="space-y-2 pt-1">
            {searching ? (
              <div className="py-6 text-center text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto divide-y divide-[#27272a]/40">
                {searchResults.map((item) => {
                  const isSelected = selectedUserIds.includes(item._id);
                  return (
                    <div
                      key={item._id}
                      onClick={() => handleToggleSelectUser(item._id)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181b] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {item.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            item.displayName?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.displayName}</p>
                          <p className="text-[11px] text-zinc-400 truncate">@{item.username}</p>
                        </div>
                      </div>

                      {mode === 'group' && (
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-white border-white text-zinc-950' : 'border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : searchQuery.trim().length > 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No users found.</p>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-6">
                Type above to search accounts to message.
              </p>
            )}
          </div>
        </div>

        {/* Footer for Group creation */}
        {mode === 'group' && (
          <div className="p-4 border-t border-[#27272a] bg-[#0e0e11] flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {selectedUserIds.length} member{selectedUserIds.length === 1 ? '' : 's'} selected
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={!groupTitle.trim() || selectedUserIds.length === 0 || isSubmitting}
              isLoading={isSubmitting}
              onClick={handleCreateGroup}
              leftIcon={<Users className="w-4 h-4" />}
            >
              Create Group
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
