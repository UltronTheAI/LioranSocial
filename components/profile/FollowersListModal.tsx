'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { X, UserPlus, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export interface FollowerUser {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isFollowing?: boolean;
  isSelf?: boolean;
}

export interface FollowersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  mode: 'followers' | 'following';
  onRelationshipChanged?: () => void;
}

export function FollowersListModal({
  isOpen,
  onClose,
  username,
  mode,
  onRelationshipChanged,
}: FollowersListModalProps) {
  const [users, setUsers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingUsernames, setTogglingUsernames] = useState<Record<string, boolean>>({});
  const { user: currentUser } = useAuth();

  const fetchListData = useCallback(async () => {
    if (!isOpen || !username) return [];
    try {
      const res = await fetch(`/api/users/${username}/${mode}`);
      const data = await res.json();
      if (res.ok) {
        return (mode === 'followers' ? data.followers : data.following) || [];
      }
      return [];
    } catch (e) {
      console.error('Fetch follow list error:', e);
      return [];
    }
  }, [isOpen, username, mode]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && username) {
      fetchListData().then((result) => {
        if (isMounted) {
          setUsers(result);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, username, fetchListData]);

  const handleToggleFollow = async (targetUsername: string) => {
    if (!currentUser) return;
    setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: true }));

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
      )
    );

    try {
      const res = await fetch(`/api/users/${targetUsername}/follow`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.username === targetUsername ? { ...u, isFollowing: data.isFollowing } : u
          )
        );
        if (onRelationshipChanged) {
          onRelationshipChanged();
        }
      } else {
        // Rollback
        setUsers((prev) =>
          prev.map((u) =>
            u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
          )
        );
      }
    } catch {
      // Rollback
      setUsers((prev) =>
        prev.map((u) =>
          u.username === targetUsername ? { ...u, isFollowing: !u.isFollowing } : u
        )
      );
    } finally {
      setTogglingUsernames((prev) => ({ ...prev, [targetUsername]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <h3 className="text-base font-semibold text-white capitalize">{mode}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between animate-pulse py-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800" />
                    <div className="space-y-1.5">
                      <div className="w-24 h-3.5 bg-zinc-800 rounded" />
                      <div className="w-16 h-3 bg-zinc-800 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-zinc-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-white">No {mode} yet</p>
              <p className="text-xs text-zinc-500">
                {mode === 'followers'
                  ? `@${username} doesn't have any followers yet.`
                  : `@${username} is not following anyone yet.`}
              </p>
            </div>
          ) : (
            users.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-[#18181b] transition-colors"
              >
                <Link
                  href={`/u/${item.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-semibold text-sm text-white shrink-0">
                    {item.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.avatar}
                        alt={item.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      item.displayName?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate group-hover:underline">
                      {item.displayName}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">@{item.username}</p>
                  </div>
                </Link>

                {currentUser && !item.isSelf && (
                  <Button
                    size="sm"
                    variant={item.isFollowing ? 'secondary' : 'primary'}
                    isLoading={togglingUsernames[item.username]}
                    onClick={() => handleToggleFollow(item.username)}
                    className="ml-3 shrink-0 text-xs px-3 py-1.5 h-8"
                    leftIcon={
                      item.isFollowing ? (
                        <UserCheck className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {item.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
