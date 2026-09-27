'use client';

// Live USD/JPY for Forex mode (DESIGN-FOREX.md §4.6) — the one live number in
// the app. A plain client-side fetch, so static export still works. The last
// good rate is persisted, so a failed fetch falls back to it (marked stale)
// instead of blanking the sizing.

import { useEffect, useState } from 'react';
import { usePersistentState } from './storage';

const REFRESH_MS = 60_000;

// Free, no-key, CORS-enabled. Coinbase updates ~every minute; er-api daily.
const SOURCES: { url: string; pick: (json: unknown) => number }[] = [
  {
    url: 'https://api.coinbase.com/v2/exchange-rates?currency=USD',
    pick: (j) => Number((j as { data: { rates: { JPY: string } } }).data.rates.JPY),
  },
  {
    url: 'https://open.er-api.com/v6/latest/USD',
    pick: (j) => Number((j as { rates: { JPY: number } }).rates.JPY),
  },
];

async function fetchUsdJpy(signal: AbortSignal): Promise<number> {
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal, cache: 'no-store' });
      if (!res.ok) continue;
      const rate = s.pick(await res.json());
      if (Number.isFinite(rate) && rate > 0) return rate;
    } catch (e) {
      if (signal.aborted) throw e;
    }
  }
  throw new Error('USD/JPY unavailable');
}

export type UsdJpy = {
  rate: number; // the rate sizing uses — manual override if set, else live/last
  live: { rate: number; at: number } | null; // last good live fetch
  status: 'live' | 'stale' | 'loading' | 'manual';
  manualStr: string;
  useManual: boolean;
  setManualStr: (s: string) => void;
  setUseManual: (b: boolean) => void;
};

export function useUsdJpy(): UsdJpy {
  const [live, setLive] = usePersistentState<{ rate: number; at: number } | null>(
    'fx.usdjpy.last',
    null,
  );
  const [manualStr, setManualStr] = usePersistentState('fx.usdjpy.manual', '');
  const [useManual, setUseManual] = usePersistentState('fx.usdjpy.useManual', false);
  const [phase, setPhase] = useState<'loading' | 'ok' | 'failed'>('loading');

  useEffect(() => {
    const ctrl = new AbortController();
    const load = () => {
      fetchUsdJpy(ctrl.signal).then(
        (rate) => {
          setLive({ rate, at: Date.now() });
          setPhase('ok');
        },
        () => {
          if (!ctrl.signal.aborted) setPhase('failed');
        },
      );
    };
    // Always fetch on mount; after that, refresh only while the tab is visible.
    const refresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    const id = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
    // setLive is recreated each render; the subscription only needs to mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manual = Number.parseFloat(manualStr);
  if (useManual) {
    return {
      rate: manual,
      live,
      status: 'manual',
      manualStr,
      useManual,
      setManualStr,
      setUseManual,
    };
  }

  // While the first fetch is in flight, sizing already uses the persisted rate
  // from the last visit; it's only called stale once a fetch has failed.
  return {
    rate: live?.rate ?? NaN,
    live,
    status: phase === 'ok' ? 'live' : phase === 'loading' ? 'loading' : 'stale',
    manualStr,
    useManual,
    setManualStr,
    setUseManual,
  };
}
