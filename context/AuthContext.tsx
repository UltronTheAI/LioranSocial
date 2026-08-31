'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

  // In-flight single-flight promise deduplication
  const fetchPromiseRef = useRef<Promise<SafeUser | null>>(null);

  const fetchCurrentUser = useCallback(async (): Promise<SafeUser | null> => {
    // If a request is already in-flight, return the active promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    const promise = (async () => {
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

        // If access token is expired or unauthorized, attempt refresh token endpoint once
        if (res.status === 401) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            return refreshData.user;
          }
        }

        return null;
      } catch {
        return null;
      } finally {
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = promise;
    return promise;
  }, []);

  const refreshUser = useCallback(async (): Promise<SafeUser | null> => {
    setLoading(true);
    fetchPromiseRef.current = null; // Clear any cached promise
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
      fetchPromiseRef.current = null;
      router.push('/login');
    }
  }, [router]);

  // Resolve session on mount with single-flight promise deduplication
  useEffect(() => {
    fetchCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, [fetchCurrentUser]);

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
