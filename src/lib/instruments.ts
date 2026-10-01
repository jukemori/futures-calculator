// OANDA Japan CFD table for Forex mode (DESIGN-FOREX.md §2) — the forex
// counterpart of contracts.ts. Pip sizes are OANDA's own (US100 in the
// "1 pip = 1" group, XAUUSD in the "1 pip = 0.01" group). Spreads are variable
// at OANDA, so `spreadPoints` is only the pre-filled default; the input is editable.
// The spread is entered in MT5 points — the "Spread" figure in Market Watch → Details —
// so it can be copied straight off the terminal; sizing converts it to pips.

export type Instrument = {
  symbol: string;
  usdPerPoint: number; // USD per 1.00 price move per 1 lot
  pipSize: number; // price units per pip
  minLot: number;
  lotStep: number;
  maxLotsPerOrder: number;
  priceDecimals: number; // quote precision
  mt5Point: number; // price units per MT5 point (1 / 10^digits of the MT5 quote)
  spreadPoints: number; // default spread in MT5 points (standard course)
  /** How a price move reads for this instrument: gold in dollars, the index in points. */
  moveUnit: 'usd' | 'pt';
  slPlaceholder: string; // pips
  entryPlaceholder: string;
  note: string;
};

export const INSTRUMENTS = [
  {
    symbol: 'XAUUSD',
    usdPerPoint: 100,
    pipSize: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    maxLotsPerOrder: 20,
    priceDecimals: 2,
    mt5Point: 0.001, // MT5 quotes gold to 3 digits (4174.460) → 490 pts = $0.49
    spreadPoints: 500,
    moveUnit: 'usd',
    slPlaceholder: '500',
    entryPlaceholder: '2650.00',
    note: '100 oz gold; 1 pip = $0.01 → $1/pip/lot',
  },
  {
    symbol: 'NAS100',
    usdPerPoint: 1,
    pipSize: 1,
    minLot: 0.1,
    lotStep: 0.1,
    maxLotsPerOrder: 1000,
    priceDecimals: 1,
    mt5Point: 0.1,
    spreadPoints: 23,
    moveUnit: 'pt',
    slPlaceholder: '100',
    entryPlaceholder: '21480.0',
    note: 'OANDA US100; 1 lot = 1 × index → $1/pt',
  },
] as const satisfies readonly Instrument[];

/** A row of the table — like Instrument, but with the literal symbol. */
export type ListedInstrument = (typeof INSTRUMENTS)[number];
export type InstrumentSymbol = ListedInstrument['symbol'];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export function getInstrument(symbol: string): ListedInstrument | undefined {
  return BY_SYMBOL.get(symbol as InstrumentSymbol);
}

/** MT5 points → the instrument's pips (XAUUSD: 490 pts = 49 pips). */
export function pointsToPips(inst: Instrument, points: number): number {
  return (points * inst.mt5Point) / inst.pipSize;
}

export const DEFAULT_INSTRUMENT: InstrumentSymbol = INSTRUMENTS[0].symbol; // XAUUSD
