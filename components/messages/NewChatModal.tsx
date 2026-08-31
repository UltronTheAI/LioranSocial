'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
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
        throw new Error(data.error || 'Failed to create conversation');
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

  const handleReset = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">New Message</h3>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-2.5 text-xs bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300">
              {error}
            </div>
          )}

          {/* Search User Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">To:</label>
            <Input
              placeholder="Search user by name or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* User Results List */}
          <div className="space-y-2 pt-1">
            {searching || isSubmitting ? (
              <div className="py-8 text-center text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  {isSubmitting ? 'Starting conversation...' : 'Searching users...'}
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto divide-y divide-[#27272a]/40">
                {searchResults.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => handleCreateDM(item._id)}
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

                    <span className="text-xs font-medium text-zinc-400 hover:text-white">Chat</span>
                  </div>
                ))}
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
      </div>
    </div>
  );
}
