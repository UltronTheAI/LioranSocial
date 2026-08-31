/**
 * Safe client-side localStorage caching utility with stale-while-revalidate support
 */

export function getStorageCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`[Cache] Error reading ${key} from localStorage:`, err);
    return null;
  }
}

export function setStorageCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Cache] Error saving ${key} to localStorage:`, err);
  }
}

export function removeStorageCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Cache] Error removing ${key} from localStorage:`, err);
  }
}

