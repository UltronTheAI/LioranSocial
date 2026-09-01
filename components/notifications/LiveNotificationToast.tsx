'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Heart,
  MessageCircle,
  UserPlus,
  CircleDashed,
  AtSign,
  Reply,
  X,
} from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';

export interface LiveNotificationToastItem {
  id: string;
  type: string;
  sender: {
    _id?: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  text: string;
  link: string;
  createdAt: Date;
}

export function LiveNotificationToast() {
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [toasts, setToasts] = useState<LiveNotificationToastItem[]>([]);

  const addToast = useCallback((toast: LiveNotificationToastItem) => {
    setToasts((prev) => [toast, ...prev.slice(0, 2)]); // Keep at most 3 active toasts

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (!socket || !currentUser) return;

    // 1. Live General Notifications (Likes, Comments, Follows, Mentions, Stories)
    const handleNewNotification = (notif: {
      _id: string;
      type: string;
      sender: { _id?: string; username: string; displayName: string; avatar?: string };
      postId?: { _id?: string } | string;
      reelId?: { _id?: string } | string;
      storyId?: { _id?: string } | string;
      commentText?: string;
    }) => {
      if (!notif?.sender || notif.sender.username === currentUser.username) return;

      let desc = 'interacted with you';
      let link = '/notifications';

      const senderName = notif.sender.displayName || notif.sender.username;

      switch (notif.type) {
        case 'like_post':
          desc = `${senderName} liked your photo`;
          link = '/notifications';
          break;
        case 'like_reel':
          desc = `${senderName} liked your reel`;
          link = notif.reelId ? `/reels#${typeof notif.reelId === 'object' ? notif.reelId._id : notif.reelId}` : '/reels';
          break;
        case 'like_story':
          desc = `${senderName} liked your story`;
          link = '/';
          break;
        case 'reply_story':
          desc = `${senderName} replied to your story: "${notif.commentText || ''}"`;
          link = notif.sender._id ? `/messages?user=${notif.sender._id}` : '/messages';
          break;
        case 'comment_post':
          desc = `${senderName} commented on your post`;
          link = '/notifications';
          break;
        case 'comment_reel':
          desc = `${senderName} commented on your reel`;
          link = notif.reelId ? `/reels#${typeof notif.reelId === 'object' ? notif.reelId._id : notif.reelId}` : '/reels';
          break;
        case 'follow':
          desc = `${senderName} started following you`;
          link = `/u/${notif.sender.username}`;
          break;
        case 'new_story':
          desc = `${senderName} added a new story`;
          link = '/';
          // Dispatch live story refresh event so circles bar updates immediately
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('story:refresh'));
          }
          break;
        case 'mention_post':
        case 'mention_reel':
        case 'mention_comment':
          desc = `${senderName} mentioned you: "${notif.commentText || ''}"`;
          link = '/notifications';
          break;
        default:
          desc = `${senderName} sent a notification`;
          link = '/notifications';
      }

      // Also dispatch custom event for header badges
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications:unread_increment'));
      }

      addToast({
        id: notif._id || `notif_${Date.now()}_${Math.random()}`,
        type: notif.type,
        sender: notif.sender,
        text: desc,
        link,
        createdAt: new Date(),
      });
    };

    // 2. Live Story Broadcast from Followed Users
    const handleStoryNew = (data: {
      authorId: string;
      username: string;
      displayName?: string;
      avatar?: string;
    }) => {
      if (data.username === currentUser.username) return;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('story:refresh'));
      }
    };

    // 3. Live Message Notifications (When not viewing messages page)
    const handleNewMessage = (msg: {
      _id: string;
      conversationId: string;
      sender?: { _id?: string; username: string; displayName: string; avatar?: string };
      type: string;
      text?: string;
    }) => {
      // Don't toast own messages
      if (msg.sender?._id === currentUser._id || msg.sender?.username === currentUser.username) return;

      // Also dispatch message unread increment event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('messages:unread_increment'));
      }

      // If user is already on /messages page, ChatWindow handles it
      if (pathname.startsWith('/messages')) return;

      const senderName = msg.sender?.displayName || msg.sender?.username || 'Someone';
      const msgPreview = msg.text ? (msg.text.length > 40 ? `${msg.text.slice(0, 40)}...` : msg.text) : 'sent an attachment';

      addToast({
        id: `msg_${msg._id || Date.now()}`,
        type: 'message',
        sender: msg.sender || { username: 'user', displayName: senderName },
        text: `${senderName}: ${msgPreview}`,
        link: '/messages',
        createdAt: new Date(),
      });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('story:new', handleStoryNew);
    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('story:new', handleStoryNew);
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, currentUser, pathname, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-80 pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-[#18181b]/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl rounded-2xl p-3 flex items-center gap-3 animate-in slide-in-from-top-3 duration-250 hover:border-zinc-500 transition-all group"
        >
          {/* Sender Avatar + Type Badge */}
          <Link
            href={toast.link}
            onClick={() => removeToast(toast.id)}
            className="relative shrink-0"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
              {toast.sender?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toast.sender.avatar}
                  alt={toast.sender.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                toast.sender?.displayName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black border border-zinc-700 flex items-center justify-center">
              {toast.type.startsWith('like') && (
                <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
              )}
              {toast.type.startsWith('comment') && (
                <MessageCircle className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
              )}
              {toast.type === 'message' && (
                <MessageCircle className="w-2.5 h-2.5 fill-purple-400 text-purple-400" />
              )}
              {toast.type === 'follow' && (
                <UserPlus className="w-2.5 h-2.5 text-blue-400" />
              )}
              {toast.type === 'new_story' && (
                <CircleDashed className="w-2.5 h-2.5 text-amber-400" />
              )}
              {toast.type.startsWith('mention') && (
                <AtSign className="w-2.5 h-2.5 text-blue-400" />
              )}
              {(toast.type === 'reply_comment' || toast.type === 'reply_story') && (
                <Reply className="w-2.5 h-2.5 text-amber-400" />
              )}
            </div>
          </Link>

          {/* Message Text */}
          <div
            onClick={() => {
              removeToast(toast.id);
              router.push(toast.link);
            }}
            className="flex-1 min-w-0 cursor-pointer"
          >
            <p className="text-xs font-medium text-zinc-100 leading-snug line-clamp-2">
              {toast.text}
            </p>
            <span className="text-[10px] text-zinc-500">Just now</span>
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeToast(toast.id);
            }}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

