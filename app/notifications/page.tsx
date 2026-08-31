'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

export default function NotificationsPage() {
  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
          <Heart className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Notifications</h2>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Activity on your profile, new followers, likes, and comments will show up here.
        </p>
      </div>
    </AppShell>
  );
}

