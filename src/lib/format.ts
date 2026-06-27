// Small display helpers. Kept out of components so formatting is consistent
// and the calc layer stays free of presentation concerns.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Whole-dollar currency with an explicit + on gains: +$1,110 / −$1,110. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${usd.format(Math.abs(n))}`;
}

/** R-multiple, one decimal, signed: +1.0R / −1.0R. */
export function formatR(n: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(1)}R`;
}

/** Percent, no decimals: 50%. */
export function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

/** Price level, trimmed to at most 2 decimals: 4196.6. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
