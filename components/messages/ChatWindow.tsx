'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Send,
  Image as ImageIcon,
  Play,
  Loader2,
  Users,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  CheckCheck,
  Reply,
  Smile,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { PopulatedConversation } from '@/services/conversation.service';
import { IMessageMedia } from '@/models/Message';

export interface ChatMessageReaction {
  userId: string;
  username?: string;
  emoji: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  sender: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
  type: 'text' | 'image' | 'post' | 'reel' | 'story_reply';
  text?: string;
  media?: IMessageMedia;
  sharedPost?: {
    _id: string;
    images?: Array<{ url: string; secureUrl: string }>;
    caption?: string;
    authorId?: { username: string; displayName: string; avatar?: string };
  };
  sharedReel?: {
    _id: string;
    video?: { url: string; secureUrl: string; thumbnail?: string };
    caption?: string;
    authorId?: { username: string; displayName: string; avatar?: string };
  };
  story?: {
    _id: string;
    media?: { url: string; secureUrl: string };
    mediaType?: 'image' | 'video';
  };
  storyReaction?: string;
  replyTo?: {
    _id: string;
    type: string;
    text?: string;
    sender?: { username: string; displayName: string };
  };
  reactions?: ChatMessageReaction[];
  readBy?: Array<{ userId: string; readAt: string | Date }>;
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string | Date;
  editedAt?: string | Date;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ChatWindowProps {
  conversation: PopulatedConversation | null;
  onBack?: () => void;
}

const QUICK_REACTION_EMOJIS = ['❤️', '😂', '🔥', '😮', '😢', '👍'];

function formatMessageTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function canEditMessage(msg: ChatMessage, currentUserId?: string): boolean {
  if (!currentUserId || msg.sender?._id !== currentUserId) return false;
  if (msg.isDeleted || msg.type !== 'text') return false;
  const msgTime = new Date(msg.createdAt).getTime();
  return Date.now() - msgTime <= 15 * 60 * 1000;
}

function canDeleteForEveryone(msg: ChatMessage, currentUserId?: string): boolean {
  if (!currentUserId || msg.sender?._id !== currentUserId) return false;
  if (msg.isDeleted) return false;
  const msgTime = new Date(msg.createdAt).getTime();
  return Date.now() - msgTime <= 15 * 60 * 1000;
}

export function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { user: currentUser } = useAuth();
  const { socket, joinConversation, leaveConversation, sendTypingStart, sendTypingStop } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> username
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Replying state
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Message menu / reaction popover state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const markAsRead = useCallback(async (convId: string) => {
    try {
      await fetch(`/api/conversations/${convId}/read`, { method: 'POST' });
    } catch (e) {
      console.error('Mark read error:', e);
    }
  }, []);

  // Fetch initial messages for active conversation
  const fetchMessagesData = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?limit=35`);
      const data = await res.json();
      if (res.ok) {
        return {
          messages: data.messages || [],
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
        };
      }
      return { messages: [], nextCursor: null, hasMore: false };
    } catch (e) {
      console.error('Fetch messages error:', e);
      return { messages: [], nextCursor: null, hasMore: false };
    }
  }, []);

  useEffect(() => {
    if (!conversation) return;

    let isMounted = true;

    // Join Socket room
    joinConversation(conversation._id);

    fetchMessagesData(conversation._id).then((res) => {
      if (isMounted) {
        setMessages(res.messages);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setLoading(false);
        markAsRead(conversation._id);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    });

    return () => {
      isMounted = false;
      leaveConversation(conversation._id);
    };
  }, [conversation, joinConversation, leaveConversation, fetchMessagesData, markAsRead]);

  // Realtime Socket Event Listeners
  useEffect(() => {
    if (!socket || !conversation) return;

    const handleNewMessage = (newMsg: ChatMessage) => {
      if (newMsg.conversationId === conversation._id) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === newMsg._id);
          if (exists) {
            return prev.map((m) => (m._id === newMsg._id ? newMsg : m));
          }

          // Reconcile pending optimistic message
          if (currentUser && newMsg.sender?._id === currentUser._id) {
            const optimisticIndex = prev.findIndex(
              (m) => m.status === 'sending' || m._id.startsWith('temp_')
            );
            if (optimisticIndex !== -1) {
              const next = [...prev];
              next[optimisticIndex] = { ...newMsg, status: 'sent' };
              return next;
            }
          }

          return [...prev, newMsg];
        });
        markAsRead(conversation._id);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    const handleTypingStart = (data: { conversationId: string; userId: string; username: string }) => {
      if (data.conversationId === conversation._id && data.userId !== currentUser?._id) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: data.username }));
      }
    };

    const handleTypingStop = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversation._id) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    };

    const handleMessageRead = (data: { conversationId: string; userId: string; readAt: string }) => {
      if (data.conversationId === conversation._id && data.userId !== currentUser?._id) {
        setMessages((prev) =>
          prev.map((m) => {
            const alreadyRead = m.readBy?.some((r) => r.userId === data.userId);
            if (!alreadyRead) {
              const nextReadBy = [...(m.readBy || []), { userId: data.userId, readAt: data.readAt }];
              return { ...m, readBy: nextReadBy };
            }
            return m;
          })
        );
      }
    };

    const handleMessageEdit = (data: { conversationId: string; messageId: string; text: string; editedAt: string }) => {
      if (data.conversationId === conversation._id) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, text: data.text, editedAt: data.editedAt, isEdited: true }
              : m
          )
        );
      }
    };

    const handleMessageDelete = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId === conversation._id) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? {
                  ...m,
                  text: 'This message was deleted',
                  isDeleted: true,
                  media: undefined,
                  sharedPost: undefined,
                  sharedReel: undefined,
                  story: undefined,
                  reactions: [],
                }
              : m
          )
        );
      }
    };

    const handleMessageDeleteForMe = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId === conversation._id) {
        setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
      }
    };

    const handleMessageReact = (data: { conversationId: string; messageId: string; reactions: ChatMessageReaction[] }) => {
      if (data.conversationId === conversation._id) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:read', handleMessageRead);
    socket.on('message:edit', handleMessageEdit);
    socket.on('message:delete', handleMessageDelete);
    socket.on('message:delete_for_me', handleMessageDeleteForMe);
    socket.on('message:react', handleMessageReact);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:read', handleMessageRead);
      socket.off('message:edit', handleMessageEdit);
      socket.off('message:delete', handleMessageDelete);
      socket.off('message:delete_for_me', handleMessageDeleteForMe);
      socket.off('message:react', handleMessageReact);
    };
  }, [socket, conversation, currentUser, markAsRead]);

  // Load older messages via cursor
  const loadOlderMessages = async () => {
    if (!conversation || !nextCursor || loadingOlder || !hasMore) return;

    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversation._id}/messages?cursor=${nextCursor}&limit=25`
      );
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...data.messages, ...prev]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (e) {
      console.error('Load older messages error:', e);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Handle Input Typing & Throttled Typing Indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!conversation) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart(conversation._id);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStop(conversation._id);
    }, 2000);
  };

  // Send Text Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversation || !currentUser) return;

    const messageText = inputText.trim();
    const replyTarget = replyingToMessage;
    setInputText('');
    setReplyingToMessage(null);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop(conversation._id);
    }

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      conversationId: conversation._id,
      sender: {
        _id: currentUser._id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
      },
      type: 'text',
      text: messageText,
      replyTo: replyTarget
        ? {
            _id: replyTarget._id,
            type: replyTarget.type,
            text: replyTarget.text,
            sender: {
              username: replyTarget.sender?.username || '',
              displayName: replyTarget.sender?.displayName || '',
            },
          }
        : undefined,
      reactions: [],
      createdAt: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await fetch(`/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          text: messageText,
          replyTo: replyTarget?._id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => {
          const alreadyHasReal = prev.some((m) => m._id === data.message._id);
          if (alreadyHasReal) {
            return prev.filter((m) => m._id !== tempId);
          }
          return prev.map((m) => (m._id === tempId ? { ...data.message, status: 'sent' } : m));
        });
      } else {
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...m, status: 'failed' } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // React to Message
  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!conversation || !currentUser) return;
    setActiveReactionPickerMessageId(null);
    setActiveMenuMessageId(null);

    // Optimistic toggle
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const idx = reactions.findIndex((r) => r.userId === currentUser._id);
        if (idx > -1) {
          if (reactions[idx].emoji === emoji) {
            reactions.splice(idx, 1);
          } else {
            reactions[idx].emoji = emoji;
          }
        } else {
          reactions.push({
            userId: currentUser._id,
            username: currentUser.username,
            emoji,
          });
        }
        return { ...m, reactions };
      })
    );

    try {
      await fetch(`/api/conversations/${conversation._id}/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch (err) {
      console.error('React error:', err);
    }
  };

  // Save Message Edit
  const handleSaveEdit = async (messageId: string) => {
    if (!conversation || !editMessageText.trim() || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/conversations/${conversation._id}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editMessageText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, text: data.text, editedAt: data.editedAt, isEdited: true } : m
          )
        );
        setEditingMessageId(null);
        setEditMessageText('');
      }
    } catch (e) {
      console.error('Save message edit error:', e);
    } finally {
      setIsSavingEdit(false);
      setActiveMenuMessageId(null);
    }
  };

  // Delete Message for Everyone
  const handleDeleteForEveryone = async (messageId: string) => {
    if (!conversation || !confirm('Delete this message for everyone in the chat?')) return;

    try {
      const res = await fetch(`/api/conversations/${conversation._id}/messages/${messageId}?for=everyone`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  text: 'This message was deleted',
                  isDeleted: true,
                  media: undefined,
                  sharedPost: undefined,
                  sharedReel: undefined,
                  story: undefined,
                  reactions: [],
                }
              : m
          )
        );
      }
    } catch (e) {
      console.error('Delete for everyone error:', e);
    } finally {
      setActiveMenuMessageId(null);
    }
  };

  // Delete Message for Me (Works for own & other's messages)
  const handleDeleteForMe = async (messageId: string) => {
    if (!conversation || !confirm('Delete this message for you? It will be removed from your view only.')) return;

    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    setActiveMenuMessageId(null);

    try {
      await fetch(`/api/conversations/${conversation._id}/messages/${messageId}?for=me`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Delete for me error:', e);
    }
  };

  // Image upload in chat
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !conversation || !currentUser) return;

    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file exceeds 10MB limit.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'lioransocial/messages');

      const uploadRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      await fetch(`/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          media: {
            url: uploadData.media.url,
            secureUrl: uploadData.media.secureUrl,
            publicId: uploadData.media.publicId,
            width: uploadData.media.width,
            height: uploadData.media.height,
          },
          replyTo: replyingToMessage?._id,
        }),
      });

      setReplyingToMessage(null);
    } catch (err) {
      console.error('Send image error:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#09090b]">
        <div className="w-14 h-14 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center text-zinc-500 mb-3 shadow-xl">
          <Send className="w-7 h-7 -rotate-12 ml-1" />
        </div>
        <h3 className="text-base font-bold text-white">Your Messages</h3>
        <p className="text-xs text-zinc-400 max-w-xs mt-1">
          Send private photos, videos, and messages with real-time replies, emoji reactions, and seen receipts.
        </p>
      </div>
    );
  }

  const typingNames = Object.values(typingUsers);
  const otherUser = conversation.members.find((m) => m._id !== currentUser?._id);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] overflow-hidden select-none">
      {/* ===================================================================== */}
      {/* Chat Header */}
      {/* ===================================================================== */}
      <div className="h-14 px-3 sm:px-4 border-b border-[#27272a] flex items-center justify-between bg-[#0e0e11] shrink-0 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
            {conversation.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conversation.avatar} alt={conversation.title} className="w-full h-full object-cover" />
            ) : conversation.type === 'group' ? (
              <Users className="w-4 h-4 text-zinc-400" />
            ) : (
              conversation.title.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">{conversation.title}</h3>
            <p className="text-[10px] text-zinc-400">
              {conversation.type === 'group'
                ? `${conversation.members.length} members`
                : 'Direct Message'}
            </p>
          </div>
        </div>

        {otherUser && (
          <Link
            href={`/u/${otherUser.username}`}
            className="text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors"
          >
            Profile
          </Link>
        )}
      </div>

      {/* ===================================================================== */}
      {/* Message Thread */}
      {/* ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* Instagram-Style Conversation Profile Banner */}
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 border-b border-[#27272a]/50 mb-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xl text-white shadow-xl">
            {conversation.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conversation.avatar} alt={conversation.title} className="w-full h-full object-cover" />
            ) : conversation.type === 'group' ? (
              <Users className="w-7 h-7 text-zinc-400" />
            ) : (
              conversation.title.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{conversation.title}</h4>
            <p className="text-xs text-zinc-400">
              {conversation.type === 'group'
                ? `${conversation.members.length} members`
                : otherUser ? `@${otherUser.username} • LioranSocial` : 'LioranSocial'}
            </p>
          </div>
          {otherUser && (
            <Link
              href={`/u/${otherUser.username}`}
              className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              View Profile
            </Link>
          )}
        </div>

        {hasMore && (
          <div className="text-center pb-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-[11px] font-semibold text-zinc-400 hover:text-white bg-[#18181b] border border-[#27272a] px-3 py-1 rounded-full transition-colors cursor-pointer"
            >
              {loadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-xs text-zinc-400">No messages yet.</p>
            <p className="text-[11px] text-zinc-600">Send a greeting or share a post/reel to start chatting!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = currentUser && msg.sender?._id === currentUser._id;
            const canEdit = canEditMessage(msg, currentUser?._id);
            const canDeleteAll = canDeleteForEveryone(msg, currentUser?._id);
            const isEditing = editingMessageId === msg._id;
            const isSeenByOther =
              isSelf &&
              (msg.readBy || []).some((r) => r.userId !== currentUser._id);

            // Group reactions by emoji
            const reactionCounts: Record<string, number> = {};
            (msg.reactions || []).forEach((r) => {
              reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
            });

            return (
              <div
                key={`${msg._id}_${index}`}
                className={`flex items-end gap-2 group relative ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                {/* Sender Avatar in Group Chats for other users */}
                {!isSelf && conversation.type === 'group' && (
                  <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-[9px] text-white shrink-0 mb-1">
                    {msg.sender?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.sender.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      msg.sender?.displayName?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                )}

                {/* Left Hover Actions for Self Messages */}
                {isSelf && !msg.isDeleted && !isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                    {/* Emoji Reaction Picker Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionPickerMessageId(
                            activeReactionPickerMessageId === msg._id ? null : msg._id
                          )
                        }
                        className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        title="React"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Emoji Quick Picker Bar */}
                      {activeReactionPickerMessageId === msg._id && (
                        <div className="absolute right-0 bottom-full mb-1 flex items-center gap-1 bg-[#18181b] border border-[#27272a] rounded-full p-1 shadow-2xl z-30 animate-in fade-in zoom-in-95">
                          {QUICK_REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReactToMessage(msg._id, emoji)}
                              className="p-1 text-base hover:scale-125 transition-transform cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reply Button */}
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(msg)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Options Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuMessageId(activeMenuMessageId === msg._id ? null : msg._id)
                        }
                        className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        title="More"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuMessageId === msg._id && (
                        <div className="absolute right-0 bottom-full mb-1 w-36 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageId(msg._id);
                                setEditMessageText(msg.text || '');
                                setActiveMenuMessageId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-blue-400" />
                              Edit
                            </button>
                          )}
                          {canDeleteAll && (
                            <button
                              type="button"
                              onClick={() => handleDeleteForEveryone(msg._id)}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete for everyone
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteForMe(msg._id)}
                            className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete for me
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Bubble Column */}
                <div className="relative flex flex-col">
                  <div
                    className={`max-w-[80%] sm:max-w-md rounded-2xl p-3 text-xs leading-relaxed space-y-1.5 relative ${
                      msg.isDeleted
                        ? 'bg-zinc-900/60 text-zinc-500 italic border border-dashed border-zinc-800'
                        : isSelf
                        ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700/60'
                        : 'bg-[#18181b] text-zinc-100 rounded-bl-none border border-[#27272a]'
                    }`}
                  >
                    {/* Sender Name for group chats */}
                    {!isSelf && conversation.type === 'group' && (
                      <p className="text-[10px] font-bold text-zinc-400 mb-0.5">
                        {msg.sender?.displayName || msg.sender?.username}
                      </p>
                    )}

                    {/* Quoted Reply Target Preview */}
                    {msg.replyTo && (
                      <div className="bg-black/30 border-l-2 border-indigo-400 rounded-r-md px-2.5 py-1 mb-1 text-[11px] space-y-0.5">
                        <p className="font-bold text-indigo-300 text-[10px]">
                          {msg.replyTo.sender?.displayName || msg.replyTo.sender?.username || 'User'}
                        </p>
                        <p className="truncate text-zinc-300 line-clamp-1">
                          {msg.replyTo.text || 'Attachment'}
                        </p>
                      </div>
                    )}

                    {/* Inline Edit Form */}
                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={editMessageText}
                          onChange={(e) => setEditMessageText(e.target.value)}
                          className="w-full bg-[#121215] border border-zinc-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white"
                          maxLength={2000}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditMessageText('');
                            }}
                            className="px-2 py-1 text-[10px] text-zinc-400 hover:text-white rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg._id)}
                            disabled={!editMessageText.trim() || isSavingEdit}
                            className="px-2.5 py-1 text-[10px] font-bold bg-white text-zinc-950 rounded hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Photo Message */}
                        {msg.type === 'image' && msg.media && (
                          <div className="rounded-xl overflow-hidden max-w-xs border border-zinc-700/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.media.secureUrl || msg.media.url}
                              alt="Photo"
                              className="w-full h-auto object-cover max-h-60"
                            />
                          </div>
                        )}

                        {/* Shared Post Card */}
                        {msg.type === 'post' && msg.sharedPost && (
                          <div className="bg-[#121215] border border-[#27272a] rounded-xl overflow-hidden max-w-xs space-y-2">
                            {msg.sharedPost.authorId && (
                              <div className="flex items-center gap-2 p-2 pb-0">
                                <div className="w-5 h-5 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-[9px] text-white">
                                  {msg.sharedPost.authorId.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={msg.sharedPost.authorId.avatar} alt="Author" className="w-full h-full object-cover" />
                                  ) : (
                                    msg.sharedPost.authorId.username.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <span className="text-[11px] font-bold text-white truncate">
                                  @{msg.sharedPost.authorId.username}
                                </span>
                              </div>
                            )}
                            {msg.sharedPost.images && msg.sharedPost.images[0] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={msg.sharedPost.images[0].secureUrl || msg.sharedPost.images[0].url}
                                alt="Post"
                                className="w-full aspect-square object-cover"
                              />
                            )}
                            {msg.sharedPost.caption && (
                              <p className="px-2 pb-2 text-[11px] text-zinc-300 line-clamp-2">
                                {msg.sharedPost.caption}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Shared Reel Card */}
                        {msg.type === 'reel' && msg.sharedReel && (
                          <div className="bg-[#121215] border border-[#27272a] rounded-xl overflow-hidden max-w-xs space-y-2 relative">
                            {msg.sharedReel.authorId && (
                              <div className="flex items-center gap-2 p-2 pb-0">
                                <Play className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                                <span className="text-[11px] font-bold text-white truncate">
                                  Reel by @{msg.sharedReel.authorId.username}
                                </span>
                              </div>
                            )}
                            {msg.sharedReel.video && (
                              <div className="relative aspect-[9/16] max-h-56 w-full bg-black flex items-center justify-center">
                                <video
                                  src={msg.sharedReel.video.secureUrl || msg.sharedReel.video.url}
                                  className="w-full h-full object-cover"
                                  controls
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Story Reply Preview */}
                        {msg.type === 'story_reply' && (
                          <div className="bg-black/40 border border-zinc-700/60 rounded-xl p-2 flex items-center gap-2.5 max-w-xs">
                            {msg.story?.media && (
                              <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-700">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.story.media.secureUrl || msg.story.media.url}
                                  alt="Story"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[10px] text-amber-400 font-semibold">Replied to story</p>
                              {msg.storyReaction && (
                                <p className="text-base">{msg.storyReaction}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Text Message */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                      </>
                    )}

                    {/* Metadata Footer: Timestamp, Edited badge, Seen checkmarks */}
                    <div className="flex items-center justify-end gap-1.5 text-[9px] text-zinc-400 pt-0.5">
                      {msg.isEdited && <span>(edited)</span>}
                      <span>{formatMessageTime(msg.createdAt)}</span>

                      {isSelf && (
                        <span>
                          {msg.status === 'sending' ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : msg.status === 'failed' ? (
                            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                          ) : isSeenByOther ? (
                            <span title="Seen">
                              <CheckCheck className="w-3 h-3 text-blue-400" />
                            </span>
                          ) : (
                            <span title="Sent">
                              <Check className="w-3 h-3 text-zinc-400" />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges Pill */}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div
                      className={`flex items-center gap-1 -mt-2 z-10 ${
                        isSelf ? 'justify-end pr-2' : 'justify-start pl-2'
                      }`}
                    >
                      <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] shadow-md text-[11px]">
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                          <span key={emoji} className="flex items-center gap-0.5">
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-[9px] text-zinc-400 font-bold">{count}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Hover Actions for Other Users' Messages */}
                {!isSelf && !msg.isDeleted && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                    {/* Emoji Reaction Picker Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionPickerMessageId(
                            activeReactionPickerMessageId === msg._id ? null : msg._id
                          )
                        }
                        className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        title="React"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Emoji Quick Picker Bar */}
                      {activeReactionPickerMessageId === msg._id && (
                        <div className="absolute left-0 bottom-full mb-1 flex items-center gap-1 bg-[#18181b] border border-[#27272a] rounded-full p-1 shadow-2xl z-30 animate-in fade-in zoom-in-95">
                          {QUICK_REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReactToMessage(msg._id, emoji)}
                              className="p-1 text-base hover:scale-125 transition-transform cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reply Button */}
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(msg)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete for Me Action Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuMessageId(activeMenuMessageId === msg._id ? null : msg._id)
                        }
                        className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        title="More"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuMessageId === msg._id && (
                        <div className="absolute left-0 bottom-full mb-1 w-32 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => handleDeleteForMe(msg._id)}
                            className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            Delete for me
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1.5 bg-[#0e0e11] border-t border-[#27272a] flex items-center gap-2 text-xs text-zinc-400 animate-in fade-in">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]" />
          </div>
          <span>
            {typingNames.length === 1
              ? `${typingNames[0]} is typing...`
              : `${typingNames.slice(0, 2).join(', ')} are typing...`}
          </span>
        </div>
      )}

      {/* Replying Banner */}
      {replyingToMessage && (
        <div className="px-4 py-2 bg-[#121215] border-t border-[#27272a] flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-indigo-300">
                Replying to {replyingToMessage.sender?.displayName || replyingToMessage.sender?.username}
              </p>
              <p className="text-zinc-400 truncate">
                {replyingToMessage.text || (replyingToMessage.type === 'image' ? '📷 Photo' : 'Attachment')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Message Input Footer */}
      {/* ===================================================================== */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 sm:p-4 border-t border-[#27272a] bg-[#0e0e11] flex items-center gap-2"
      >
        {/* Photo Upload Attachment Button */}
        <label className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#18181b] cursor-pointer transition-colors shrink-0">
          {isUploadingImage ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
            disabled={isUploadingImage}
            className="hidden"
          />
        </label>

        {/* Text Input */}
        <input
          type="text"
          placeholder={replyingToMessage ? "Type your reply..." : "Write a message..."}
          value={inputText}
          onChange={handleInputChange}
          className="flex-1 bg-[#18181b] border border-[#27272a] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          maxLength={2000}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-2xl bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-zinc-950 transition-all cursor-pointer shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
