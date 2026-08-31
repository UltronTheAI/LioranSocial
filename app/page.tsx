'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, ShieldCheck, User, Key } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Card */}
        <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {loading ? 'Welcome to LioranSocial' : `Welcome back, ${user?.displayName || 'Friend'}!`}
              </h1>
              <p className="text-xs text-zinc-400">
                {user ? `@${user.username} • Verified Account` : 'MVP Dark-Mode Social Foundation'}
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Your secure authentication and application foundation is active. All session tokens are cryptographically secured using short-lived JWTs and hashed refresh token rotation in HttpOnly SameSite cookies.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Argon2id Hashed</span>
              </div>
              <p className="text-xs text-zinc-400">
                Passwords and refresh tokens are protected with state-of-the-art cryptographic hashing.
              </p>
            </div>

            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                <Key className="w-4 h-4" />
                <span>HttpOnly Cookies</span>
              </div>
              <p className="text-xs text-zinc-400">
                Tokens are stored in secure browser cookies, protected from client-side script tampering.
              </p>
            </div>
          </div>
        </div>

        {/* Quick User Stats & Actions */}
        {user && (
          <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Account Overview</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#18181b] rounded-xl p-3 border border-[#27272a]">
                <p className="text-lg font-bold text-white">{user.postsCount || 0}</p>
                <p className="text-xs text-zinc-400">Posts</p>
              </div>
              <div className="bg-[#18181b] rounded-xl p-3 border border-[#27272a]">
                <p className="text-lg font-bold text-white">{user.followersCount || 0}</p>
                <p className="text-xs text-zinc-400">Followers</p>
              </div>
              <div className="bg-[#18181b] rounded-xl p-3 border border-[#27272a]">
                <p className="text-lg font-bold text-white">{user.followingCount || 0}</p>
                <p className="text-xs text-zinc-400">Following</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs rounded-xl transition-colors"
              >
                <User className="w-3.5 h-3.5" /> View Full Profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
