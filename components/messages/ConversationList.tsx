'use client';

import React, { useState } from 'react';
import { Search, Plus, Users, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PopulatedConversation } from '@/services/conversation.service';
import { NewChatModal } from './NewChatModal';

export interface ConversationListProps {
  conversations: PopulatedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onConversationCreated: (conversation: PopulatedConversation) => void;
  loading: boolean;
}

function timeAgo(dateInput: string | Date): string {
  const now = new Date();
  const date = new Date(dateInput);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return `${Math.floor(diffInSeconds / 604800)}w`;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onConversationCreated,
  loading,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] border-r border-[#27272a] select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
        <h2 className="text-base font-bold text-white tracking-tight">Messages</h2>
        <button
          onClick={() => setIsNewChatOpen(true)}
          className="p-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#27272a]/60">
        <Input
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="text-xs"
        />
      </div>

      {/* Conversation Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="py-12 text-center text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-xs text-zinc-500">
              {searchQuery ? 'No chats matched your search.' : 'No conversations yet.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="text-xs font-semibold text-white underline hover:text-zinc-300"
              >
                Start a message
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv._id === activeConversationId;
            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv._id)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#18181b] border border-[#27272a]'
                    : 'hover:bg-[#121215] border border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-sm text-white">
                    {conv.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={conv.avatar} alt={conv.title} className="w-full h-full object-cover" />
                    ) : conv.type === 'group' ? (
                      <Users className="w-5 h-5 text-zinc-400" />
                    ) : (
                      conv.title.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                {/* Info & Last snippet */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-zinc-200'}`}>
                      {conv.title}
                    </p>
                    <span className="text-[10px] text-zinc-500 shrink-0 ml-1">
                      {timeAgo(conv.lastActivityAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 truncate">
                    {conv.lastMessage?.text ||
                      (conv.lastMessage?.type === 'image'
                        ? '📷 Photo'
                        : conv.lastMessage?.type === 'post'
                        ? '📸 Shared post'
                        : conv.lastMessage?.type === 'reel'
                        ? '🎬 Shared reel'
                        : conv.lastMessage?.type === 'story_reply'
                        ? '✨ Story reply'
                        : 'Started a conversation')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onConversationCreated={onConversationCreated}
      />
    </div>
  );
}
