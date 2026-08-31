'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SafeUser } from '@/types/user';

interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  setUser: (user: SafeUser | null) => void;
  refreshUser: () => Promise<SafeUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = useCallback(async (): Promise<SafeUser | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return data.user;
      }

      // If access token is expired, try refresh token endpoint explicitly
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        return refreshData.user;
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<SafeUser | null> => {
    setLoading(true);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    setLoading(false);
    return currentUser;
  }, [fetchCurrentUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    fetchCurrentUser().then((currentUser) => {
      if (isMounted) {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchCurrentUser, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

