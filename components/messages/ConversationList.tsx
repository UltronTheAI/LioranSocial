'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Users,
  Loader2,
  Trash2,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PopulatedConversation } from '@/services/conversation.service';
import { NewChatModal } from './NewChatModal';

export interface ConversationListProps {
  conversations: PopulatedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onConversationCreated: (conversation: PopulatedConversation) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onBulkDeleteConversations?: (conversationIds: string[]) => void;
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
  onDeleteConversation,
  onBulkDeleteConversations,
  loading,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectConversation = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedConvIds.length === filtered.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(filtered.map((c) => c._id));
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this conversation? This will remove it from your chat list.')) {
      if (onDeleteConversation) {
        onDeleteConversation(id);
      } else {
        try {
          await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
          window.location.reload();
        } catch (err) {
          console.error('Delete conversation error:', err);
        }
      }
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedConvIds.length === 0 || isDeletingBulk) return;
    if (
      confirm(
        `Are you sure you want to delete ${selectedConvIds.length} selected conversation${
          selectedConvIds.length === 1 ? '' : 's'
        }?`
      )
    ) {
      setIsDeletingBulk(true);
      try {
        if (onBulkDeleteConversations) {
          await onBulkDeleteConversations(selectedConvIds);
        } else {
          await fetch('/api/conversations/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationIds: selectedConvIds }),
          });
          window.location.reload();
        }
        setSelectedConvIds([]);
        setIsSelectionMode(false);
      } catch (err) {
        console.error('Bulk delete error:', err);
      } finally {
        setIsDeletingBulk(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] border-r border-[#27272a] select-none">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white tracking-tight">Messages</h2>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedConvIds([]);
              }}
              className="text-xs font-semibold px-2 py-0.5 rounded-lg text-zinc-400 hover:text-white bg-[#18181b] hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              {isSelectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isSelectionMode ? (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-[#18181b] transition-colors cursor-pointer"
            >
              {selectedConvIds.length === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
          ) : (
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="p-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white transition-colors cursor-pointer"
              title="New conversation"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          )}
        </div>
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
                className="text-xs font-semibold text-white underline hover:text-zinc-300 cursor-pointer"
              >
                Start a message
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv._id === activeConversationId;
            const isSelected = selectedConvIds.includes(conv._id);
            const isHovered = hoveredConvId === conv._id;

            return (
              <div
                key={conv._id}
                onMouseEnter={() => setHoveredConvId(conv._id)}
                onMouseLeave={() => setHoveredConvId(null)}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelectConversation(conv._id);
                  } else {
                    onSelectConversation(conv._id);
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 relative group ${
                  isActive && !isSelectionMode
                    ? 'bg-[#18181b] border border-[#27272a]'
                    : isSelected
                    ? 'bg-zinc-900 border border-zinc-700'
                    : 'hover:bg-[#121215] border border-transparent'
                }`}
              >
                {/* Selection Checkbox */}
                {isSelectionMode && (
                  <div
                    onClick={(e) => toggleSelectConversation(conv._id, e)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      isSelected ? 'bg-white border-white text-black' : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                )}

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-sm text-white">
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

                {/* Delete single chat action button on hover */}
                {!isSelectionMode && (isHovered || isActive) && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(conv._id, e)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Multi-Selection Bottom Action Bar */}
      {isSelectionMode && (
        <div className="p-3 border-t border-[#27272a] bg-[#121215] flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
          <span className="text-xs text-zinc-400">
            {selectedConvIds.length} selected
          </span>
          <button
            type="button"
            onClick={handleDeleteBulk}
            disabled={selectedConvIds.length === 0 || isDeletingBulk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            {isDeletingBulk ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Delete Selected</span>
          </button>
        </div>
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onConversationCreated={onConversationCreated}
      />
    </div>
  );
}
