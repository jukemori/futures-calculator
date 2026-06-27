// The contract lookup table — the single source of truth for $/point.
// Carried over verbatim from the spreadsheet (DESIGN.md §2). Adding a new
// micro (MES, M2K, …) should be a one-line edit here, nothing else.

export type Contract = {
  symbol: string;
  dollarPerPoint: number;
  tickSize?: number; // a full 1.00 move is 1 point; tickSize is the smallest increment
  note?: string;
};

// `satisfies` validates every row against Contract while keeping the literal
// `symbol` values, so ContractSymbol below is a precise union, not just string.
export const CONTRACTS = [
  {
    symbol: 'MGC',
    dollarPerPoint: 10,
    tickSize: 0.1,
    note: '10 oz gold; $1 per 0.10 tick → $10/pt',
  },
  {
    symbol: 'GC',
    dollarPerPoint: 100,
    tickSize: 0.1,
    note: '100 oz gold; $10 per 0.10 tick → $100/pt',
  },
  { symbol: 'MNQ', dollarPerPoint: 2, tickSize: 0.25, note: '$2 × Nasdaq-100' },
  { symbol: 'NQ', dollarPerPoint: 20, tickSize: 0.25, note: '$20 × Nasdaq-100' },
  { symbol: 'SI', dollarPerPoint: 5000, tickSize: 0.005, note: '5,000 oz silver' },
  { symbol: 'SIL', dollarPerPoint: 1000, tickSize: 0.005, note: '1,000 oz silver' },
  { symbol: 'MC', dollarPerPoint: 10 },
  { symbol: 'MCL', dollarPerPoint: 100 },
] as const satisfies readonly Contract[];

export type ContractSymbol = (typeof CONTRACTS)[number]['symbol'];

const BY_SYMBOL = new Map(CONTRACTS.map((c) => [c.symbol, c]));

export function getContract(symbol: string): Contract | undefined {
  return BY_SYMBOL.get(symbol as ContractSymbol);
}

export const DEFAULT_CONTRACT: ContractSymbol = CONTRACTS[0].symbol; // MGC
