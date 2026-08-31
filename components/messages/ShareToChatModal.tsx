'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Check, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PopulatedConversation } from '@/services/conversation.service';

export interface ShareToChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'post' | 'reel';
  contentId: string;
}

export function ShareToChatModal({
  isOpen,
  onClose,
  contentType,
  contentId,
}: ShareToChatModalProps) {
  const [conversations, setConversations] = useState<PopulatedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

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

  const toggleSelectConversation = (convId: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const handleShare = async () => {
    if (selectedConvIds.length === 0 || isSharing) return;

    setIsSharing(true);
    try {
      const res = await fetch('/api/conversations/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          targetConversationIds: selectedConvIds,
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

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-white">
            Share {contentType === 'post' ? 'Post' : 'Reel'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3.5 border-b border-[#27272a]">
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-64">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-10">No conversations found.</p>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConvIds.includes(conv._id);
              return (
                <div
                  key={conv._id}
                  onClick={() => toggleSelectConversation(conv._id)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181b] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {conv.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={conv.avatar} alt={conv.title} className="w-full h-full object-cover" />
                      ) : (
                        conv.title.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{conv.title}</p>
                      <p className="text-[10px] text-zinc-400 capitalize">{conv.type}</p>
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
            })
          )}
        </div>

        {/* Optional Comment & Send Footer */}
        <div className="p-4 border-t border-[#27272a] bg-[#0e0e11] space-y-3">
          <input
            type="text"
            placeholder="Write a message (optional)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            maxLength={500}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {selectedConvIds.length} recipient{selectedConvIds.length === 1 ? '' : 's'}
            </span>

            {successToast ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Check className="w-4 h-4" /> Sent!
              </div>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={selectedConvIds.length === 0 || isSharing}
                isLoading={isSharing}
                onClick={handleShare}
                rightIcon={<Send className="w-3.5 h-3.5" />}
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
