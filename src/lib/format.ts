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

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

/** Whole-yen currency with an explicit + on gains: +¥19,800 / −¥29,925. */
export function formatYen(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${yen.format(Math.abs(n)).replace('￥', '¥')}`;
}

/** Lot size at the instrument's step precision: 0.35 / 3.2. */
export function formatLots(lots: number, lotStep: number): string {
  if (!Number.isFinite(lots)) return '—';
  const decimals = Math.max(0, Math.round(-Math.log10(lotStep)));
  return lots.toFixed(decimals);
}

/** Price level at a fixed quote precision: 2,654.00 / 21,480.5. */
export function formatQuote(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
