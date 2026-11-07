import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const KEY = 'futures-calculator:v1';
let localStorage: MemoryStorage;

/** A browser tab: its own sessionStorage and module cache, the shared localStorage. */
async function openTab() {
  vi.resetModules();
  const sessionStorage = new MemoryStorage();
  const storage = await import('./storage');
  const inTab = <T>(fn: () => T) => {
    vi.stubGlobal('window', { localStorage, sessionStorage });
    return fn();
  };
  const get = (field: string) => inTab(() => storage.readField(field)[field]);
  const set = (field: string, value: unknown) => inTab(() => storage.writeField(field, value));
  get('risk'); // the real page reads its inputs on load, which seeds the tab
  return { get, set };
}

beforeEach(() => {
  localStorage = new MemoryStorage();
});

describe('tab isolation', () => {
  it('keeps inputs independent between open tabs', async () => {
    const a = await openTab();
    const b = await openTab();
    a.set('fx.instrument', 'XAUUSD');
    b.set('fx.instrument', 'EURUSD');
    expect(a.get('fx.instrument')).toBe('XAUUSD');
    expect(b.get('fx.instrument')).toBe('EURUSD');
  });

  it('does not pick up inputs saved after the tab was seeded', async () => {
    const a = await openTab();
    const b = await openTab();
    a.set('contract', 'MNQ');
    expect(b.get('contract')).toBeUndefined();
  });

  it('starts a new tab from the most recently edited tab, as one set', async () => {
    const a = await openTab();
    const b = await openTab();
    a.set('risk', '100');
    a.set('stop', '20');
    b.set('risk', '500');
    const c = await openTab();
    expect(c.get('risk')).toBe('500');
    expect(c.get('stop')).toBeUndefined(); // not a's stop mixed into b's risk
  });

  it('shares app-wide values live across tabs', async () => {
    const a = await openTab();
    const b = await openTab();
    a.set('theme', 'dark');
    expect(b.get('theme')).toBe('dark');
  });

  it('keeps shared values when a tab saves its inputs', async () => {
    const a = await openTab();
    const b = await openTab();
    a.set('theme', 'dark');
    b.set('risk', '100');
    expect(JSON.parse(localStorage.getItem(KEY)!).theme).toBe('dark');
  });
});
