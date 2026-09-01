'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  UserPlus,
  MessageCircle,
  Clapperboard,
  CheckCheck,
  AtSign,
  Reply,
  CircleDashed,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { NotificationType } from '@/models/Notification';

interface NotificationItem {
  _id: string;
  type: NotificationType;
  sender: {
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  post?: {
    _id: string;
    images?: Array<{ url: string; secureUrl: string }>;
  };
  reel?: {
    _id: string;
    video?: { url: string; secureUrl: string; thumbnail?: string };
  };
  commentText?: string;
  isRead: boolean;
  createdAt: string | Date;
}

function formatNotificationTime(dateInput: string | Date): string {
  const now = new Date();
  const date = new Date(dateInput);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return `${Math.floor(diffInSeconds / 604800)}w`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        return data.notifications || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch notifications error:', e);
      return [];
    }
  }, []);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch('/api/notifications', { method: 'PATCH' });
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchNotifications().then((notifs) => {
      if (isMounted) {
        setNotifications(notifs);
        setLoading(false);
      }
    });

    const handleWindowFocus = () => {
      fetchNotifications().then((notifs) => {
        if (isMounted && notifs.length > 0) {
          setNotifications(notifs);
        }
      });
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [fetchNotifications]);

  // Realtime notification socket listener
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = (newNotif: NotificationItem) => {
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === newNotif._id);
        if (exists) return prev;
        return [newNotif, ...prev];
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayedNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6 pb-24 md:pb-8 select-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#27272a] pb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
            <p className="text-xs text-zinc-400">Activity, mentions, and interactions</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Filter Tabs */}
            <div className="flex items-center bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  filter === 'all'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filter === 'unread'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#121215] border border-[#27272a]/40 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-zinc-800 rounded w-40 sm:w-56" />
                    <div className="h-2.5 bg-zinc-800/60 rounded w-16" />
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && displayedNotifications.length === 0 && (
          <div className="py-16 sm:py-20 text-center space-y-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500 shadow-xl">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto px-4">
              When people follow you, like your posts, reply to your comments, or mention you, they will appear here.
            </p>
          </div>
        )}

        {/* Notification Items List */}
        {!loading && displayedNotifications.length > 0 && (
          <div className="space-y-2">
            {displayedNotifications.map((notif) => {
              const sender = notif.sender;
              return (
                <div
                  key={notif._id}
                  className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border transition-colors ${
                    !notif.isRead
                      ? 'bg-[#18181b]/90 border-zinc-700/80 shadow-sm'
                      : 'bg-[#121215] border-[#27272a]/60 hover:bg-[#18181b]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    {/* Avatar with badge */}
                    <div className="relative shrink-0">
                      <Link href={`/u/${sender?.username}`}>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
                          {sender?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sender.avatar}
                              alt={sender.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            sender?.displayName?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                      </Link>

                      {/* Icon badge */}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black border border-[#27272a] flex items-center justify-center">
                        {notif.type === 'follow' && (
                          <UserPlus className="w-2.5 h-2.5 text-blue-400" />
                        )}
                        {(notif.type === 'like_post' || notif.type === 'like_reel' || notif.type === 'like_comment' || notif.type === 'like_story') && (
                          <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                        )}
                        {(notif.type === 'comment_post' || notif.type === 'comment_reel') && (
                          <MessageCircle className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
                        )}
                        {(notif.type === 'reply_comment' || notif.type === 'reply_story') && (
                          <Reply className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        {(notif.type === 'mention_post' || notif.type === 'mention_reel' || notif.type === 'mention_comment') && (
                          <AtSign className="w-2.5 h-2.5 text-blue-400" />
                        )}
                        {notif.type === 'new_story' && (
                          <CircleDashed className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        {notif.type === 'message' && (
                          <MessageCircle className="w-2.5 h-2.5 text-purple-400" />
                        )}
                      </div>
                    </div>

                    {/* Text description */}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="text-zinc-200 leading-snug break-words">
                        <Link
                          href={`/u/${sender?.username}`}
                          className="font-bold text-white hover:underline mr-1"
                        >
                          {sender?.displayName || sender?.username}
                        </Link>
                        {notif.type === 'follow' && 'started following you.'}
                        {notif.type === 'like_post' && 'liked your photo.'}
                        {notif.type === 'like_reel' && 'liked your reel.'}
                        {notif.type === 'like_story' && 'liked your story.'}
                        {notif.type === 'new_story' && 'added a new story.'}
                        {notif.type === 'reply_story' && (
                          <span>
                            replied to your story: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'like_comment' && (
                          <span>
                            liked your comment: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'reply_comment' && (
                          <span>
                            replied to your comment: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'mention_post' && (
                          <span>
                            mentioned you in a post: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'mention_reel' && (
                          <span>
                            mentioned you in a reel: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'mention_comment' && (
                          <span>
                            mentioned you in a comment: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'comment_post' && (
                          <span>
                            commented: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'comment_reel' && (
                          <span>
                            commented on reel: <span className="text-zinc-400 italic break-all">&ldquo;{notif.commentText}&rdquo;</span>
                          </span>
                        )}
                        {notif.type === 'message' && 'sent you a message.'}
                      </p>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        {formatNotificationTime(notif.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail / Action on Right */}
                  <div className="shrink-0 flex items-center gap-2">
                    {notif.post?.images && notif.post.images[0] && (
                      <Link href={`/u/${user?.username}`} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-[#27272a] block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={notif.post.images[0].secureUrl || notif.post.images[0].url}
                          alt="Post preview"
                          className="w-full h-full object-cover"
                        />
                      </Link>
                    )}

                    {notif.reel?.video && (
                      <Link href={`/reels#${notif.reel._id}`} className="w-7 h-9 sm:w-8 sm:h-10 rounded-lg overflow-hidden border border-[#27272a] relative block">
                        {notif.reel.video.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={notif.reel.video.thumbnail}
                            alt="Reel preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <Clapperboard className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                        )}
                      </Link>
                    )}

                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Unread" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
