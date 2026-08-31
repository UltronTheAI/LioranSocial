'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Heart, Loader2, UserCheck } from 'lucide-react';

export interface LikedUserItem {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  emailVerified?: boolean;
  likedAt?: string | Date;
}

export interface LikesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  type: 'post' | 'reel';
  title?: string;
}

export function LikesListModal({
  isOpen,
  onClose,
  targetId,
  type,
  title = 'Likes',
}: LikesListModalProps) {
  const [likes, setLikes] = useState<LikedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !targetId) return;

    let isMounted = true;
    const endpoint = type === 'post' ? `/api/posts/${targetId}/likes` : `/api/reels/${targetId}/likes`;

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.error) {
          setError(data.error);
        } else {
          setLikes(data.likes || []);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError((err as Error)?.message || 'Failed to load likes');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetId, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <span className="text-xs text-zinc-500 font-semibold">({likes.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-1 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs text-zinc-400">Loading likes...</p>
            </div>
          ) : error ? (
            <div className="py-8 px-4 text-center space-y-2">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          ) : likes.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <Heart className="w-7 h-7 text-zinc-600 mx-auto stroke-1" />
              <p className="text-xs font-semibold text-zinc-400">No likes yet</p>
              <p className="text-[11px] text-zinc-500">When people like your {type}, they will appear here.</p>
            </div>
          ) : (
            likes.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-[#18181b] transition-colors group"
              >
                <Link
                  href={`/u/${user.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      user.displayName?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-white truncate group-hover:underline">
                        {user.displayName}
                      </p>
                      {user.emailVerified && (
                        <UserCheck className="w-3 h-3 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">@{user.username}</p>
                  </div>
                </Link>

                <Link
                  href={`/u/${user.username}`}
                  onClick={onClose}
                  className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                >
                  Profile
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

