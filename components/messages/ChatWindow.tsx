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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { PopulatedConversation } from '@/services/conversation.service';
import { IMessageMedia } from '@/models/Message';

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
  replyTo?: string;
  createdAt: string | Date;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ChatWindowProps {
  conversation: PopulatedConversation | null;
  onBack?: () => void;
}

function formatMessageTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Fetch initial messages for active conversation
  const fetchMessagesData = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?limit=30`);
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
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    });

    return () => {
      isMounted = false;
      leaveConversation(conversation._id);
    };
  }, [conversation, joinConversation, leaveConversation, fetchMessagesData]);

  // Realtime Socket Event Listeners
  useEffect(() => {
    if (!socket || !conversation) return;

    const handleNewMessage = (newMsg: ChatMessage) => {
      if (newMsg.conversationId === conversation._id) {
        setMessages((prev) => {
          // Deduplicate if already added optimistically
          const exists = prev.some((m) => m._id === newMsg._id);
          if (exists) {
            return prev.map((m) => (m._id === newMsg._id ? newMsg : m));
          }
          return [...prev, newMsg];
        });
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

    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, conversation, currentUser]);

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
    setInputText('');

    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop(conversation._id);
    }

    // Optimistic message
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
      createdAt: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await fetch(`/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: messageText }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...data.message, status: 'sent' } : m))
        );
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
        }),
      });
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
          Send private photos, videos, and messages to your friends and groups.
        </p>
      </div>
    );
  }

  const typingNames = Object.values(typingUsers);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] overflow-hidden">
      {/* ===================================================================== */}
      {/* Chat Header */}
      {/* ===================================================================== */}
      <div className="px-4 py-3.5 border-b border-[#27272a] flex items-center justify-between bg-[#0e0e11]">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
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
            <h3 className="text-xs font-bold text-white truncate">{conversation.title}</h3>
            <p className="text-[10px] text-zinc-400">
              {conversation.type === 'group'
                ? `${conversation.members.length} members`
                : 'Direct Message'}
            </p>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Message Thread */}
      {/* ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMore && (
          <div className="text-center pb-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-[11px] font-semibold text-zinc-400 hover:text-white bg-[#18181b] border border-[#27272a] px-3 py-1 rounded-full transition-colors"
            >
              {loadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center space-y-1">
            <p className="text-xs text-zinc-400">No messages yet.</p>
            <p className="text-[11px] text-zinc-600">Send a greeting to start the chat!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = currentUser && msg.sender?._id === currentUser._id;
            return (
              <div
                key={msg._id}
                className={`flex items-end gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}
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

                {/* Message Bubble */}
                <div
                  className={`max-w-[78%] sm:max-w-md rounded-2xl p-3 text-xs leading-relaxed space-y-1.5 ${
                    isSelf
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

                  {/* 1. Text Message */}
                  {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                  {/* 2. Image Attachment */}
                  {msg.type === 'image' && msg.media && (
                    <div className="rounded-xl overflow-hidden border border-zinc-700/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.media.secureUrl || msg.media.url}
                        alt="Attachment"
                        className="max-h-64 object-cover w-full cursor-pointer hover:opacity-95"
                      />
                    </div>
                  )}

                  {/* 3. Shared Post Card */}
                  {msg.type === 'post' && msg.sharedPost && (
                    <div className="bg-[#121215] border border-[#27272a] rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-zinc-400">
                          Post by @{msg.sharedPost.authorId?.username || 'user'}
                        </span>
                      </div>
                      {msg.sharedPost.images && msg.sharedPost.images[0] && (
                        <div className="aspect-square w-full rounded-lg overflow-hidden border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.sharedPost.images[0].secureUrl || msg.sharedPost.images[0].url}
                            alt="Shared Post"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {msg.sharedPost.caption && (
                        <p className="text-[11px] text-zinc-300 truncate">{msg.sharedPost.caption}</p>
                      )}
                    </div>
                  )}

                  {/* 4. Shared Reel Card */}
                  {msg.type === 'reel' && msg.sharedReel && (
                    <Link
                      href={`/reels#${msg.sharedReel._id}`}
                      className="block bg-[#121215] border border-[#27272a] rounded-xl p-2.5 space-y-2 hover:border-zinc-500 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-400">
                        <Play className="w-3 h-3 fill-rose-400" />
                        <span>Reel by @{msg.sharedReel.authorId?.username || 'user'}</span>
                      </div>
                      {msg.sharedReel.video?.thumbnail && (
                        <div className="aspect-[9/16] w-28 rounded-lg overflow-hidden border border-zinc-800 relative mx-auto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.sharedReel.video.thumbnail}
                            alt="Reel Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-5 h-5 fill-white text-white drop-shadow-md" />
                          </div>
                        </div>
                      )}
                    </Link>
                  )}

                  {/* 5. Story Reply / Reaction */}
                  {msg.type === 'story_reply' && (
                    <div className="bg-[#121215] border border-[#27272a] rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400">
                        <span>Replied to story</span>
                        {msg.storyReaction && <span className="text-base">{msg.storyReaction}</span>}
                      </div>
                      {msg.story?.media && (
                        <div className="w-16 h-20 rounded-lg overflow-hidden border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.story.media.secureUrl || msg.story.media.url}
                            alt="Story thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp & Status */}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-zinc-400 pt-0.5">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {msg.status === 'failed' && (
                      <span className="text-rose-400 flex items-center gap-0.5" title="Failed to send">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ===================================================================== */}
      {/* Ephemeral Typing Indicator */}
      {/* ===================================================================== */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-zinc-400 italic bg-[#0e0e11] border-t border-[#27272a]/40">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* ===================================================================== */}
      {/* Input Toolbar */}
      {/* ===================================================================== */}
      <div className="p-3 bg-[#0e0e11] border-t border-[#27272a]">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Image Picker */}
          <input
            type="file"
            id="chat-image-input"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleImageUpload}
            disabled={isUploadingImage}
          />
          <label
            htmlFor="chat-image-input"
            className={`p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#18181b] cursor-pointer transition-colors ${
              isUploadingImage ? 'opacity-50 pointer-events-none' : ''
            }`}
            title="Send image"
          >
            {isUploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </label>

          {/* Text Input */}
          <input
            type="text"
            placeholder="Write a message..."
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 bg-[#18181b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            maxLength={2000}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-white text-zinc-950 font-bold hover:bg-zinc-200 disabled:opacity-30 transition-all cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
