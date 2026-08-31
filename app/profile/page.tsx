'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Grid, Bookmark, ShieldCheck, Mail, Calendar } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-800" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-zinc-800 rounded w-48" />
              <div className="h-4 bg-zinc-800 rounded w-32" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-zinc-400">You must be logged in to view your profile.</p>
          <Link href="/login">
            <Button variant="primary">Sign In</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-[#121215] border border-[#27272a] rounded-2xl p-6 sm:p-8">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-900 border-2 border-zinc-700 flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden shadow-lg">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              user.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>

          {/* User Info & Stats */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                {user.displayName}
              </h1>
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-400 font-mono">@{user.username}</p>

            {user.bio ? (
              <p className="text-sm text-zinc-300 leading-relaxed">{user.bio}</p>
            ) : (
              <p className="text-xs text-zinc-500 italic">No bio written yet.</p>
            )}

            <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                {user.email}
              </span>
              {joinDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  Joined {joinDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{user.postsCount || 0}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Posts</p>
          </div>
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{user.followersCount || 0}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Followers</p>
          </div>
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{user.followingCount || 0}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Following</p>
          </div>
        </div>

        {/* Tabbed Content Navigation Placeholder */}
        <div className="border-t border-[#27272a] pt-4">
          <div className="flex justify-center gap-8 text-xs font-semibold uppercase tracking-wider">
            <button className="flex items-center gap-2 pb-2 border-b-2 border-white text-white">
              <Grid className="w-4 h-4" /> Posts
            </button>
            <button className="flex items-center gap-2 pb-2 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Bookmark className="w-4 h-4" /> Saved
            </button>
          </div>

          {/* Empty State */}
          <div className="py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
              <Grid className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">No Posts Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Posts, stories, and media uploads will be available in the next module.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
