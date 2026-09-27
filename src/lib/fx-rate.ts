// Live USD/JPY source for Forex mode (DESIGN-FOREX.md §4.6) — the one live
// number in the app. A plain client-side fetch, so static export still works.

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

/** First valid rate from SOURCES, in order. Rejects if every source fails. */
export async function fetchUsdJpy(signal: AbortSignal): Promise<number> {
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
