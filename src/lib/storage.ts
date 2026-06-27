'use client';

// localStorage-backed persistence via useSyncExternalStore (DESIGN.md §6.3).
// This avoids the hydration-mismatch trap of reading localStorage during
// render under static export: the server snapshot is always `defaults`, and
// the real value is read only on the client after hydration.

import { useSyncExternalStore } from 'react';

const KEY = 'futures-calculator:v1';

function subscribe(onChange: () => void): () => void {
  // Cross-tab updates. Same-tab writes notify via the manual event below.
  window.addEventListener('storage', onChange);
  window.addEventListener(KEY, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(KEY, onChange);
  };
}

// Cache the parsed snapshot so getSnapshot is referentially stable between
// writes — useSyncExternalStore requires this to avoid infinite re-renders.
let cachedRaw: string | null = null;
let cachedValue: Record<string, unknown> = {};

function readAll(): Record<string, unknown> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cachedValue;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    cachedValue = {};
  }
  return cachedValue;
}

/**
 * Persisted state slot. Returns [value, setValue] like useState, but the value
 * survives reloads and syncs across tabs. SSR/first paint always sees `initial`.
 */
export function usePersistentState<T>(field: string, initial: T): [T, (next: T) => void] {
  // React Compiler memoizes these closures; getSnapshot stays correct because
  // readAll() caches by the raw localStorage string (stable identity per value).
  const value = useSyncExternalStore(
    subscribe,
    () => (field in readAll() ? (readAll()[field] as T) : initial),
    () => initial, // server snapshot → defaults, no localStorage on the server
  );

  const setValue = (next: T) => {
    try {
      const all = { ...readAll(), [field]: next };
      window.localStorage.setItem(KEY, JSON.stringify(all));
      // Notify this tab (the native 'storage' event only fires in *other* tabs).
      window.dispatchEvent(new Event(KEY));
    } catch {
      // localStorage unavailable (private mode, artifacts) → in-memory only.
    }
  };

  return [value, setValue];
}
