'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Search,
  Clapperboard,
  MessageCircle,
  PlusSquare,
  Heart,
  User as UserIcon,
  LogOut,
  Image as ImageIcon,
  CircleDashed,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { CreateReelModal } from '@/components/reel/CreateReelModal';
import { CreateStoryModal } from '@/components/story/CreateStoryModal';
import { PostCardData } from '@/components/post/PostCard';
import { LiveNotificationToast } from '@/components/notifications/LiveNotificationToast';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Create Modal Options state
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);

  // Unread badge counters
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Fetch initial unread counts
  useEffect(() => {
    if (!user) return;

    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data?.unreadCount) {
          setUnreadNotifCount(data.unreadCount);
        }
      })
      .catch(() => {});

    const handleNotifInc = () => setUnreadNotifCount((prev) => prev + 1);
    const handleMsgInc = () => setUnreadMsgCount((prev) => prev + 1);

    window.addEventListener('notifications:unread_increment', handleNotifInc);
    window.addEventListener('messages:unread_increment', handleMsgInc);

    return () => {
      window.removeEventListener('notifications:unread_increment', handleNotifInc);
      window.removeEventListener('messages:unread_increment', handleMsgInc);
    };
  }, [user]);

  const effectiveUnreadNotifCount = pathname.startsWith('/notifications') ? 0 : unreadNotifCount;
  const effectiveUnreadMsgCount = pathname.startsWith('/messages') ? 0 : unreadMsgCount;
  const isReelsPage = pathname.startsWith('/reels') || pathname.startsWith('/r/');

  const profileHref = user?.username ? `/u/${user.username}` : '/login';

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    setShowCreateMenu(!showCreateMenu);
  };

  const handlePostCreated = (post: PostCardData) => {
    if (pathname === '/') {
      window.location.reload();
    } else {
      router.push(`/u/${post.author.username}`);
    }
  };

  const handleReelCreated = () => {
    if (pathname === '/reels') {
      window.location.reload();
    } else {
      router.push('/reels');
    }
  };

  const handleStoryCreated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('story:refresh'));
    }
    if (pathname === '/') {
      window.location.reload();
    } else {
      router.push('/');
    }
  };

  // Desktop Navigation Items
  const desktopNavItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Reels', href: '/reels', icon: Clapperboard },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      badge: effectiveUnreadMsgCount > 0 ? effectiveUnreadMsgCount : null,
    },
    { label: 'Create', href: '#create', icon: PlusSquare, onClick: handleCreateClick },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: Heart,
      badge: effectiveUnreadNotifCount > 0 ? effectiveUnreadNotifCount : null,
    },
    { label: 'Profile', href: profileHref, icon: UserIcon },
  ];

  // Mobile Bottom Navigation Items
  const mobileNavItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Create', href: '#create', icon: PlusSquare, onClick: handleCreateClick },
    { label: 'Reels', href: '/reels', icon: Clapperboard },
    { label: 'Profile', href: profileHref, icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col md:flex-row overflow-x-hidden">
      {/* Global Live Notification Toaster */}
      <LiveNotificationToast />

      {/* ========================================================================= */}
      {/* Desktop Sidebar (Left) */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 h-screen sticky top-0 border-r border-[#27272a] bg-[#09090b] px-4 py-6 z-30">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 px-3 py-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-950 border border-zinc-700/60 flex items-center justify-center shadow-md">
              <span className="text-base font-bold text-white font-mono">L</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-zinc-200 transition-colors">
              LioranSocial
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1 relative">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : item.href !== '#create' && pathname.startsWith(item.href);

              if (item.onClick) {
                return (
                  <div key={item.label} className="relative">
                    <button
                      onClick={item.onClick}
                      className={cn(
                        'w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left cursor-pointer',
                        showCreateMenu
                          ? 'bg-[#18181b] text-white font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-[#121215]'
                      )}
                    >
                      <Icon className="w-5 h-5 text-zinc-400" />
                      <span>{item.label}</span>
                    </button>

                    {/* Create Dropdown Popover */}
                    {showCreateMenu && (
                      <div className="absolute left-full top-0 ml-2 w-48 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 space-y-1">
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreatePostOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-[#27272a]/60 text-left transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                          <span>Photo Post</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreateReelOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-[#27272a]/60 text-left transition-colors cursor-pointer"
                        >
                          <Clapperboard className="w-4 h-4 text-rose-400" />
                          <span>Video Reel</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreateStoryOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-[#27272a]/60 text-left transition-colors cursor-pointer"
                        >
                          <CircleDashed className="w-4 h-4 text-amber-400" />
                          <span>24h Story</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#18181b] text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-[#121215]'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative">
                      <Icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-zinc-400')} />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#09090b]" />
                      )}
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout Footer */}
        <div className="border-t border-[#27272a] pt-4 space-y-3">
          {user ? (
            <div className="flex items-center justify-between px-2 py-1">
              <Link href={`/u/${user.username}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-900 border border-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate group-hover:underline">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">@{user.username}</p>
                </div>
              </Link>
              <button
                onClick={() => logout()}
                title="Sign out"
                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-3 px-2 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-zinc-800" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-zinc-800 rounded w-24" />
                <div className="h-3 bg-zinc-800 rounded w-16" />
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full block py-2 text-center text-sm font-medium bg-white text-zinc-950 rounded-xl cursor-pointer"
            >
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* Mobile Top Header (Hidden on Reels for edge-to-edge full screen) */}
      {/* ========================================================================= */}
      {!isReelsPage && (
        <header className="md:hidden sticky top-0 bg-[#09090b]/95 backdrop-blur-md border-b border-[#27272a] px-4 py-3 flex items-center justify-between z-30">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-xs text-white">
              L
            </div>
            <span className="font-bold tracking-tight text-white text-base">LioranSocial</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="p-2 text-zinc-400 hover:text-white relative">
              <Heart className="w-5 h-5" />
              {effectiveUnreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#09090b]" />
              )}
            </Link>
            <Link href="/messages" className="p-2 text-zinc-400 hover:text-white relative">
              <MessageCircle className="w-5 h-5" />
              {effectiveUnreadMsgCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#09090b]" />
              )}
            </Link>
            <button
              onClick={() => logout()}
              className="p-2 text-zinc-400 hover:text-rose-400 cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* Main Content Area */}
      {/* ========================================================================= */}
      <main
        className={cn(
          'flex-1 min-w-0 overflow-y-auto',
          pathname.startsWith('/messages') ? 'pb-0' : isReelsPage ? 'pb-14 md:pb-0' : 'pb-16 md:pb-0'
        )}
      >
        {children}
      </main>

      {/* ========================================================================= */}
      {/* Mobile Bottom Navigation Bar */}
      {/* ========================================================================= */}
      {!pathname.startsWith('/messages') && (
        <nav
          className={cn(
            'md:hidden fixed bottom-0 left-0 right-0 h-14 px-2 py-2 flex items-center justify-around z-30 transition-colors',
            isReelsPage
              ? 'bg-black border-t border-[#27272a]'
              : 'bg-[#09090b]/95 backdrop-blur-md border-t border-[#27272a]'
          )}
        >
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : item.href !== '#create' && pathname.startsWith(item.href);

            if (item.onClick) {
              return (
                <div key={item.label} className="relative">
                  <button
                    onClick={item.onClick}
                    className="p-2.5 rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer drop-shadow-md"
                    aria-label={item.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>

                  {/* Mobile Create Popup */}
                  {showCreateMenu && (
                    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
                      <div className="w-full max-w-xs bg-[#18181b] border border-[#27272a] rounded-3xl p-3 shadow-2xl space-y-1 mb-16 animate-in slide-in-from-bottom duration-150">
                        <div className="px-3 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Create
                        </div>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreatePostOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-xs font-medium text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                          <span>Photo Post</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreateReelOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-xs font-medium text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
                        >
                          <Clapperboard className="w-4 h-4 text-rose-400" />
                          <span>Video Reel</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setIsCreateStoryOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-xs font-medium text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
                        >
                          <CircleDashed className="w-4 h-4 text-amber-400" />
                          <span>24h Story</span>
                        </button>
                        <button
                          onClick={() => setShowCreateMenu(false)}
                          className="w-full py-2.5 text-center text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'p-2.5 rounded-xl transition-colors',
                  isActive
                    ? isReelsPage
                      ? 'text-white'
                      : 'text-white bg-[#18181b]'
                    : isReelsPage
                    ? 'text-zinc-300 hover:text-white drop-shadow-md'
                    : 'text-zinc-400 hover:text-white'
                )}
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      )}

      {/* Global Creation Modals */}
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />

      <CreateReelModal
        isOpen={isCreateReelOpen}
        onClose={() => setIsCreateReelOpen(false)}
        onReelCreated={handleReelCreated}
      />

      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onStoryCreated={handleStoryCreated}
      />
    </div>
  );
}
