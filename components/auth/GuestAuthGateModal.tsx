'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X, ShieldCheck, Heart, MessageCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface GuestAuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  author?: {
    username: string;
    displayName: string;
    avatar?: string;
    emailVerified?: boolean;
  };
}

export function GuestAuthGateModal({
  isOpen,
  onClose,
  title = 'Join LioranSocial',
  subtitle,
  author,
}: GuestAuthGateModalProps) {
  const pathname = usePathname();
  const callbackUrl = encodeURIComponent(pathname || '/');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#121215] border border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon / Author Avatar Badge */}
        <div className="flex justify-center">
          {author ? (
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-indigo-500/50 p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl">
                <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-[#121215] overflow-hidden flex items-center justify-center font-bold text-xl text-white">
                  {author.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={author.avatar}
                      alt={author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    author.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white text-zinc-950 p-1.5 rounded-full shadow-lg">
                <Sparkles className="w-3.5 h-3.5 fill-indigo-600 text-indigo-600" />
              </div>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-xl">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-white">
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
            </div>
          )}
        </div>

        {/* Headline & Description */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {title}
          </h2>
          {author ? (
            <p className="text-sm text-zinc-300">
              Log in or sign up to see more photos, reels, and stories from{' '}
              <span className="font-semibold text-white inline-flex items-center gap-1">
                {author.displayName}
                {author.emailVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
                )}
              </span>
              .
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              {subtitle || 'Create an account or log in to like, comment, follow creators, and watch unlimited reels.'}
            </p>
          )}
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-3 gap-2 py-1 text-xs text-zinc-300 font-medium">
          <div className="flex flex-col items-center gap-1 bg-[#18181b] border border-[#27272a] rounded-xl p-2.5">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Like & React</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-[#18181b] border border-[#27272a] rounded-xl p-2.5">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span>Chat & Reply</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-[#18181b] border border-[#27272a] rounded-xl p-2.5">
            <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span>Watch Reels</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <Link href={`/login?callbackUrl=${callbackUrl}`} className="block w-full">
            <Button variant="primary" size="lg" className="w-full font-bold shadow-lg shadow-white/10">
              Log In
            </Button>
          </Link>

          <Link href={`/register?callbackUrl=${callbackUrl}`} className="block w-full">
            <Button variant="secondary" size="lg" className="w-full font-bold">
              Create New Account
            </Button>
          </Link>

          <button
            onClick={onClose}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 pt-2 transition-colors cursor-pointer"
          >
            Continue viewing as guest
          </button>
        </div>
      </div>
    </div>
  );
}

