// Small display helpers. Kept out of components so formatting is consistent
// and the calc layer stays free of presentation concerns.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

type MoneyOpts = { sign?: boolean };

/** Signed money: +¥1,110 / −¥1,110. `sign: false` drops the + for plain amounts. */
function formatMoney(fmt: Intl.NumberFormat, n: number, { sign = true }: MoneyOpts): string {
  if (!Number.isFinite(n)) return '—';
  const prefix = n < 0 ? '−' : n > 0 && sign ? '+' : '';
  // ja-JP renders the full-width ￥; normalize to the ¥ used everywhere else.
  return `${prefix}${fmt.format(Math.abs(n)).replace('￥', '¥')}`;
}

/** Whole-dollar currency with an explicit + on gains: +$1,110 / −$1,110. */
export function formatUsd(n: number, opts: MoneyOpts = {}): string {
  return formatMoney(usd, n, opts);
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

/** Whole-yen currency with an explicit + on gains: +¥19,800 / −¥29,925. */
export function formatYen(n: number, opts: MoneyOpts = {}): string {
  return formatMoney(yen, n, opts);
}

/** Decimal places implied by a step size: 0.01 → 2, 0.1 → 1, 1 → 0. */
export function stepDecimals(step: number): number {
  return Math.max(0, Math.round(-Math.log10(step)));
}

/** Lot size at the instrument's step precision: 0.35 / 3.2. */
export function formatLots(lots: number, lotStep: number): string {
  if (!Number.isFinite(lots)) return '—';
  return lots.toFixed(stepDecimals(lotStep));
}

/** Price level at a fixed quote precision: 2,654.00 / 21,480.5. */
export function formatQuote(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
