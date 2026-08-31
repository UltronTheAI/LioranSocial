'use client';

import React from 'react';
import { Clapperboard } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

export default function ReelsPage() {
  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
          <Clapperboard className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Reels Coming Soon</h2>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Short-form video streaming and discovery infrastructure will be implemented in subsequent phases.
        </p>
      </div>
    </AppShell>
  );
}

