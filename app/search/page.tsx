'use client';

import React, { useState } from 'react';
import { Search as SearchIcon, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/Input';

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-xl font-bold text-white">Search</h1>
        <Input
          placeholder="Search accounts, tags, or topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<SearchIcon className="w-4 h-4" />}
        />

        <div className="py-16 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-[#27272a] flex items-center justify-center mx-auto text-zinc-500">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Explore the Community</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Search for people to follow and view their profile. Full search indexing will arrive in the exploration module.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

