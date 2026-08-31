'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { PopulatedConversation } from '@/services/conversation.service';
import { useSocket } from '@/context/SocketContext';

function MessagesContent() {
  const searchParams = useSearchParams();
  const { socket } = useSocket();

  const targetUserId = searchParams.get('user');
  const targetConvId = searchParams.get('c');

  const [conversations, setConversations] = useState<PopulatedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(targetConvId || null);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return data.conversations || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch conversations error:', e);
      return [];
    }
  }, []);

  // Live Socket listener to reorder and update conversations on incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (msg: {
      _id: string;
      conversationId: string;
      sender?: { _id?: string; username: string };
      type: string;
      text?: string;
      createdAt: Date;
    }) => {
      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c._id === msg.conversationId);
        if (convIndex !== -1) {
          const updatedConv: PopulatedConversation = {
            ...prev[convIndex],
            lastMessage: {
              _id: msg._id,
              senderId: msg.sender?._id || '',
              type: msg.type,
              text: msg.text,
              createdAt: msg.createdAt,
            },
            lastActivityAt: msg.createdAt,
          };
          const rest = prev.filter((c) => c._id !== msg.conversationId);
          return [updatedConv, ...rest];
        } else {
          // If a new conversation was created by someone else, re-fetch list
          fetchConversations().then((fresh) => {
            if (fresh && fresh.length > 0) {
              setConversations(fresh);
            }
          });
          return prev;
        }
      });
    };

    socket.on('message:new', handleIncomingMessage);
    return () => {
      socket.off('message:new', handleIncomingMessage);
    };
  }, [socket, fetchConversations]);

  // Handle direct user messaging via query parameter ?user=...
  const handleResolveUserParam = useCallback(
    async (userId: string) => {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dm', recipientUserId: userId }),
        });
        const data = await res.json();
        if (res.ok && data.conversation) {
          setConversations((prev) => {
            const exists = prev.some((c) => c._id === data.conversation._id);
            return exists ? prev : [data.conversation, ...prev];
          });
          setActiveConversationId(data.conversation._id);
        }
      } catch (e) {
        console.error('Resolve user DM error:', e);
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    fetchConversations().then((convs) => {
      if (isMounted) {
        setConversations(convs);
        setLoading(false);

        if (targetUserId) {
          handleResolveUserParam(targetUserId);
        } else if (targetConvId) {
          setActiveConversationId(targetConvId);
        } else if (convs.length > 0 && window.innerWidth >= 768) {
          // Default to first conversation on desktop
          setActiveConversationId(convs[0]._id);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchConversations, targetUserId, targetConvId, handleResolveUserParam]);

  const handleConversationCreated = (newConv: PopulatedConversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c._id === newConv._id);
      return exists ? prev : [newConv, ...prev];
    });
    setActiveConversationId(newConv._id);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c._id !== conversationId));
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
      }
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  };

  const handleBulkDeleteConversations = async (conversationIds: string[]) => {
    try {
      const res = await fetch('/api/conversations/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.filter((c) => !conversationIds.includes(c._id))
        );
        if (activeConversationId && conversationIds.includes(activeConversationId)) {
          setActiveConversationId(null);
        }
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
    }
  };

  const activeConversation = conversations.find((c) => c._id === activeConversationId) || null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-screen flex overflow-hidden">
      {/* Left Column: Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 h-full shrink-0 ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onConversationCreated={handleConversationCreated}
          onDeleteConversation={handleDeleteConversation}
          onBulkDeleteConversations={handleBulkDeleteConversations}
          loading={loading}
        />
      </div>

      {/* Right Column: Chat Window */}
      <div
        className={`flex-1 h-full ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatWindow
          conversation={activeConversation}
          onBack={() => setActiveConversationId(null)}
        />
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-[calc(100vh-4rem)] md:h-screen flex items-center justify-center bg-[#09090b]">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        }
      >
        <MessagesContent />
      </Suspense>
    </AppShell>
  );
}
