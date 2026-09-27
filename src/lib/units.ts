// Display units for the exit plan — what C/k count and what outcomes pay in.
// Futures: whole contracts, $, points. Forex: lot steps, ¥, pips
// (DESIGN-FOREX.md §5.3). The calc layer is unit-agnostic; only this changes.

import { formatLots, formatPrice, formatQuote, formatUsd, formatYen, stepDecimals } from './format';
import type { Instrument } from './instruments';

export type ExitUnits = {
  money: (n: number, opts?: { sign?: boolean }) => string;
  /** C and k are integer size steps; this renders a step count for display. */
  size: (steps: number) => string;
  sizeNoun: (steps: number) => string; // 'contract' / 'contracts' / 'lots'
  sizeTitle: string; // 'Contracts' / 'Lots'
  stepScale: number; // size units per step (1, or the lot step)
  stepDecimals: number;
  dist: string; // 'pts' / 'pips'
  price: (n: number) => string;
  entryPlaceholder: string;
  hintSizeSplit: string; // why the % is derived, not chosen
};

export const FUTURES_UNITS: ExitUnits = {
  money: formatUsd,
  size: (n) => String(n),
  sizeNoun: (n) => (n === 1 ? 'contract' : 'contracts'),
  sizeTitle: 'Contracts',
  stepScale: 1,
  stepDecimals: 0,
  dist: 'pts',
  price: formatPrice,
  entryPlaceholder: '4185.0',
  hintSizeSplit: 'you can’t split a whole micro.',
};

export function forexUnits(inst: Instrument): ExitUnits {
  const { lotStep, priceDecimals } = inst;
  return {
    money: formatYen,
    size: (n) => formatLots(n * lotStep, lotStep),
    sizeNoun: () => 'lots',
    sizeTitle: 'Lots',
    stepScale: lotStep,
    stepDecimals: stepDecimals(lotStep),
    dist: 'pips',
    price: (n) => `$${formatQuote(n, priceDecimals)}`,
    entryPlaceholder: inst.entryPlaceholder,
    hintSizeSplit: `lots only split in ${lotStep} steps.`,
  };
}

/** A price move in the instrument's own terms: "$5.00" for gold, "100 pts" for the index. */
export function formatMove(inst: Instrument, n: number): string {
  return inst.moveUnit === 'usd'
    ? `$${formatQuote(n, inst.priceDecimals)}`
    : `${formatQuote(n, 0)} ${n === 1 ? 'pt' : 'pts'}`;
}
