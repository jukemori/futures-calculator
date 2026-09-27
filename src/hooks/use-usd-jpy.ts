'use client';

// Live USD/JPY with a persisted fallback (DESIGN-FOREX.md §4.6): the last good
// rate is kept, so a failed fetch shows it as stale instead of blanking the
// sizing. A manual override (also persisted) wins when switched on.

import { useEffect, useState } from 'react';
import { fetchUsdJpy } from '@/lib/fx-rate';
import { usePersistentState } from '@/lib/storage';

const REFRESH_MS = 60_000;

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

  // While the first fetch is in flight, sizing already uses the persisted rate
  // from the last visit; it's only called stale once a fetch has failed.
  const liveStatus = phase === 'ok' ? 'live' : phase === 'loading' ? 'loading' : 'stale';

  return {
    rate: useManual ? Number.parseFloat(manualStr) : (live?.rate ?? NaN),
    live,
    status: useManual ? 'manual' : liveStatus,
    manualStr,
    useManual,
    setManualStr,
    setUseManual,
  };
}
