'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CreatePostModal } from '@/components/post/CreatePostModal';
import { PostCardData } from '@/components/post/PostCard';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const profileHref = user?.username ? `/u/${user.username}` : '/login';

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handlePostCreated = (post: PostCardData) => {
    // If on profile page or home page, can trigger soft refresh or route to profile
    if (pathname === '/') {
      window.location.reload();
    } else {
      router.push(`/u/${post.author.username}`);
    }
  };

  // Desktop Navigation Items
  const desktopNavItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Reels', href: '/reels', icon: Clapperboard },
    { label: 'Messages', href: '/messages', icon: MessageCircle },
    { label: 'Create', href: '#create', icon: PlusSquare, onClick: handleCreateClick },
    { label: 'Notifications', href: '/notifications', icon: Heart },
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
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col md:flex-row">
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
          <nav className="space-y-1">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : item.href !== '#create' && pathname.startsWith(item.href);

              if (item.onClick) {
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-[#121215] transition-all duration-150 text-left cursor-pointer"
                  >
                    <Icon className="w-5 h-5 text-zinc-400" />
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#18181b] text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-[#121215]'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-zinc-400')} />
                  <span>{item.label}</span>
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
                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
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
              className="w-full block py-2 text-center text-sm font-medium bg-white text-zinc-950 rounded-xl"
            >
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* Mobile Top Header */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 bg-[#09090b]/95 backdrop-blur-md border-b border-[#27272a] px-4 py-3 flex items-center justify-between z-30">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-xs text-white">
            L
          </div>
          <span className="font-bold tracking-tight text-white text-base">LioranSocial</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 text-zinc-400 hover:text-white">
            <Heart className="w-5 h-5" />
          </Link>
          <Link href="/messages" className="p-2 text-zinc-400 hover:text-white">
            <MessageCircle className="w-5 h-5" />
          </Link>
          <button
            onClick={() => logout()}
            className="p-2 text-zinc-400 hover:text-rose-400"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* Main Content Area */}
      {/* ========================================================================= */}
      <main className="flex-1 min-w-0 pb-16 md:pb-0 overflow-y-auto">
        {children}
      </main>

      {/* ========================================================================= */}
      {/* Mobile Bottom Navigation Bar */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#09090b]/95 backdrop-blur-md border-t border-[#27272a] px-2 py-2 flex items-center justify-around z-30">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : item.href !== '#create' && pathname.startsWith(item.href);

          if (item.onClick) {
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-white transition-colors"
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                isActive ? 'text-white bg-[#18181b]' : 'text-zinc-400 hover:text-white'
              )}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>

      {/* Global Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}
