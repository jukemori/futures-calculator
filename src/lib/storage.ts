'use client';

// Browser persistence via useSyncExternalStore (DESIGN.md §6.3). This avoids
// the hydration-mismatch trap of reading storage during render under static
// export: the server snapshot is always `defaults`, and the real value is read
// only on the client after hydration.
//
// Inputs are per tab, so two tabs can size different instruments: each tab
// reads its own sessionStorage copy, seeded once from localStorage. Every write
// also lands in localStorage, which is what a new tab starts from.

import { useSyncExternalStore } from 'react';

const KEY = 'futures-calculator:v1';

/** App-wide values, shared live across tabs. Everything else is per tab. */
const SHARED_FIELDS = new Set(['theme', 'help', 'fx.usdjpy.last']);

type Store = Record<string, unknown>;

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
function cachedReader(getRaw: () => string | null): () => Store {
  let cachedRaw: string | null = null;
  let cachedValue: Store = {};
  return () => {
    let raw: string | null = null;
    try {
      raw = getRaw();
    } catch {
      return cachedValue;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
      cachedValue = raw ? (JSON.parse(raw) as Store) : {};
    } catch {
      cachedValue = {};
    }
    return cachedValue;
  };
}

const readShared = cachedReader(() => window.localStorage.getItem(KEY));

const readTab = cachedReader(() => {
  const existing = window.sessionStorage.getItem(KEY);
  if (existing !== null) return existing;
  // Seed exactly once: the tab must not follow later writes from other tabs,
  // and '{}' pins that down even when there is nothing to seed from yet.
  const seed = window.localStorage.getItem(KEY) ?? '{}';
  window.sessionStorage.setItem(KEY, seed);
  return seed;
});

export function readField(field: string): Store {
  return SHARED_FIELDS.has(field) ? readShared() : readTab();
}

export function writeField(field: string, next: unknown): void {
  if (SHARED_FIELDS.has(field)) {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readShared(), [field]: next }));
    return;
  }
  const tab = { ...readTab(), [field]: next };
  window.sessionStorage.setItem(KEY, JSON.stringify(tab));
  // Save this tab's inputs as one set, so a new tab never gets a mix of two tabs.
  const shared = Object.entries(readShared()).filter(([key]) => SHARED_FIELDS.has(key));
  window.localStorage.setItem(KEY, JSON.stringify({ ...tab, ...Object.fromEntries(shared) }));
}

/**
 * Persisted state slot. Returns [value, setValue] like useState, but the value
 * survives reloads. Inputs stay independent per tab; SHARED_FIELDS sync across
 * tabs. SSR/first paint always sees `initial`.
 */
export function usePersistentState<T>(field: string, initial: T): [T, (next: T) => void] {
  // React Compiler memoizes these closures; getSnapshot stays correct because
  // the readers cache by the raw storage string (stable identity per value).
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const store = readField(field);
      return field in store ? (store[field] as T) : initial;
    },
    () => initial, // server snapshot → defaults, no storage on the server
  );

  const setValue = (next: T) => {
    try {
      writeField(field, next);
      // Notify this tab (the native 'storage' event only fires in *other* tabs).
      window.dispatchEvent(new Event(KEY));
    } catch {
      // Storage unavailable (private mode, artifacts) → in-memory only.
    }
  };

  return [value, setValue];
}
