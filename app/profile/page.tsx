'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';

export default function ProfileRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user?.username) {
        router.replace(`/u/${user.username}`);
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-pulse space-y-3">
        <div className="w-16 h-16 rounded-full bg-zinc-800 mx-auto" />
        <div className="h-4 bg-zinc-800 rounded w-36 mx-auto" />
      </div>
    </AppShell>
  );
}
