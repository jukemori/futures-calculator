import { describe, expect, test } from 'vitest';
import { computeExit, computeFxSizing, computeSizing, type ExitInput } from './calc';

const exit = (over: Partial<ExitInput>, dollarPerPoint = 10, stopPoints = 1) =>
  computeExit(
    {
      totalContracts: 6,
      partialContracts: 3,
      partialLevelR: 0.8,
      targetRR: 1,
      stopToBreakeven: false,
      ...over,
    },
    { dollarPerPoint, stopPoints },
  );

describe('computeExit — runner TP  b = (T − p·a)/(1 − p)', () => {
  // §3.3 whole-contract fixtures: [C, k, a, T, expectedB]
  test.each([
    { C: 4, k: 2, a: 0.8, T: 1, b: 1.2 },
    { C: 5, k: 3, a: 0.8, T: 1, b: 1.3 },
    { C: 6, k: 3, a: 0.8, T: 1, b: 1.2 },
    { C: 6, k: 4, a: 0.8, T: 1, b: 1.4 },
  ])('C=$C k=$k a=$a T=$T → b=$b', ({ C, k, a, T, b }) => {
    const res = exit({ totalContracts: C, partialContracts: k, partialLevelR: a, targetRR: T });
    expect(res.runnerLevelR).toBeCloseTo(b, 2);
  });

  // §3.2 fraction fixtures (derived p): [p, expectedB] at a=0.8, T=1
  test.each([
    { C: 5, k: 4, p: 0.8, b: 1.8 },
    { C: 3, k: 2, p: 0.667, b: 1.4 },
    { C: 5, k: 3, p: 0.6, b: 1.3 },
    { C: 4, k: 2, p: 0.5, b: 1.2 },
    { C: 10, k: 3, p: 0.3, b: 1.0857 },
  ])('p≈$p → b≈$b', ({ C, k, p, b }) => {
    const res = exit({ totalContracts: C, partialContracts: k });
    expect(res.partialFraction).toBeCloseTo(p, 2);
    expect(res.runnerLevelR).toBeCloseTo(b, 2);
  });

  test('k = C → no runner, no divide-by-zero', () => {
    const res = exit({ totalContracts: 5, partialContracts: 5 });
    expect(res.hasRunner).toBe(false);
    expect(Number.isFinite(res.runnerLevelR)).toBe(false);
    expect(res.warnings.join(' ')).toMatch(/no runner/i);
  });

  test('k = 0 → no partial, b degenerates to T (100% at target)', () => {
    const res = exit({ totalContracts: 5, partialContracts: 0, targetRR: 1 });
    expect(res.partialFraction).toBe(0);
    expect(res.runnerLevelR).toBeCloseTo(1, 5);
    expect(res.warnings).toHaveLength(0);
  });

  test('k clamped to 0…C when out of range', () => {
    expect(exit({ totalContracts: 4, partialContracts: 9 }).hasRunner).toBe(false); // → k=4=C
    expect(exit({ totalContracts: 4, partialContracts: -2 }).partialFraction).toBe(0); // → k=0
  });

  test('a ≥ T with a partial is flagged (runner TP at/below partial)', () => {
    const res = exit({ totalContracts: 6, partialContracts: 3, partialLevelR: 1, targetRR: 1 });
    expect(res.runnerLevelR).toBeCloseTo(1, 5); // b = a here
    expect(res.warnings.join(' ')).toMatch(/at or below the partial/i);
  });

  test('runner beyond 1.5R is flagged as a long extension', () => {
    const res = exit({ totalContracts: 5, partialContracts: 4, targetRR: 1 }); // b = 1.8R
    expect(res.warnings.join(' ')).toMatch(/long extension|lower hit rate/i);
  });
});

describe('computeExit — honest dollar outcomes (C=6, R$=185)', () => {
  // §5.1 worked example: 6 contracts, 3 off @ 0.8R, R$ = 185 (stop=1pt, $185/pt).
  const res = exit({ totalContracts: 6, partialContracts: 3, stopToBreakeven: true }, 185, 1);

  test('blended winner = +1.00R → +$1,110', () => {
    expect(res.blendedWinnerR).toBeCloseTo(1, 5);
    expect(res.blendedWinnerUsd).toBeCloseTo(1110, 2);
  });

  test('partial + stall (BE on) = +$444 (locked partial gain)', () => {
    expect(res.partialThenStallUsd).toBeCloseTo(444, 2);
  });

  test('full stop = −$1,110', () => {
    expect(res.fullLossUsd).toBeCloseTo(-1110, 2);
  });
});

describe('computeExit — partial-then-stall flips with break-even', () => {
  const params = { dollarPerPoint: 185, stopPoints: 1 };
  const base = { totalContracts: 6, partialContracts: 3, partialLevelR: 0.8, targetRR: 1 };

  test('BE off → stall is a net loss', () => {
    const res = computeExit({ ...base, stopToBreakeven: false }, params);
    // 3·0.8·185 − 3·185 = 444 − 555 = −111
    expect(res.partialThenStallUsd).toBeCloseTo(-111, 2);
  });

  test('BE on → stall is a locked gain', () => {
    const res = computeExit({ ...base, stopToBreakeven: true }, params);
    expect(res.partialThenStallUsd).toBeCloseTo(444, 2);
  });
});

describe('computeExit — price-level conversion (§3.5)', () => {
  test('long: stop below, targets above entry', () => {
    const res = exit(
      { totalContracts: 6, partialContracts: 3, entryPrice: 4185, direction: 'long' },
      10,
      18.5,
    );
    // b = 1.2R, stop = 18.5pts
    expect(res.prices?.stop).toBeCloseTo(4185 - 18.5, 4);
    expect(res.prices?.partial).toBeCloseTo(4185 + 0.8 * 18.5, 4);
    expect(res.prices?.runner).toBeCloseTo(4185 + 1.2 * 18.5, 4);
  });

  test('short: stop above, targets below entry', () => {
    const res = exit(
      { totalContracts: 6, partialContracts: 3, entryPrice: 4185, direction: 'short' },
      10,
      18.5,
    );
    expect(res.prices?.stop).toBeCloseTo(4185 + 18.5, 4);
    expect(res.prices?.partial).toBeCloseTo(4185 - 0.8 * 18.5, 4);
    expect(res.prices?.runner).toBeCloseTo(4185 - 1.2 * 18.5, 4);
  });

  test('no prices without entry + direction', () => {
    expect(exit({ totalContracts: 6, partialContracts: 3 }).prices).toBeUndefined();
  });
});

describe('computeExit — C = 0 disables the card', () => {
  test('invalid, with a helpful hint', () => {
    const res = exit({ totalContracts: 0, partialContracts: 0 });
    expect(res.valid).toBe(false);
    expect(res.warnings.join(' ')).toMatch(/increase risk or tighten stop/i);
  });
});

describe('computeSizing — port of the sheet', () => {
  test('floors to whole contracts and reports the remainder', () => {
    // MGC = $10/pt, stop 18.5pts → R$ = 185; risk $1200 → 6.49 → 6 contracts
    const res = computeSizing({ contractSymbol: 'MGC', riskDollars: 1200, stopPoints: 18.5 });
    expect(res.valid).toBe(true);
    expect(res.dollarPerPoint).toBe(10);
    expect(res.riskPerContract).toBeCloseTo(185, 5);
    expect(res.contracts).toBe(6);
    expect(res.exactContracts).toBeCloseTo(6.486, 2);
  });

  test.each([
    { riskDollars: 0, stopPoints: 18.5 },
    { riskDollars: 1200, stopPoints: 0 },
    { riskDollars: -5, stopPoints: 18.5 },
  ])('blank/≤0 input → invalid, not an error ($riskDollars/$stopPoints)', (over) => {
    const res = computeSizing({ contractSymbol: 'MGC', ...over });
    expect(res.valid).toBe(false);
    expect(res.contracts).toBe(0);
  });

  test('unknown contract symbol → invalid', () => {
    const res = computeSizing({ contractSymbol: 'ZZZ', riskDollars: 1200, stopPoints: 18.5 });
    expect(res.valid).toBe(false);
  });
});

describe('computeFxSizing — OANDA Japan, yen account (DESIGN-FOREX.md §3)', () => {
  test('XAUUSD §3.2 fixture: spread is inside the risk', () => {
    // SL 500 pips ($5.00) + spread 70 → 570 pips × $1/pip/lot × ¥150 = ¥85,500/lot
    const res = computeFxSizing({
      instrumentSymbol: 'XAUUSD',
      riskYen: 30000,
      slPips: 500,
      spreadPips: 70,
      usdJpy: 150,
    });
    expect(res.valid).toBe(true);
    expect(res.yenPerPipPerLot).toBeCloseTo(150, 5);
    expect(res.riskPerLotYen).toBeCloseTo(85500, 5);
    expect(res.exactLots).toBeCloseTo(0.3509, 3);
    expect(res.lots).toBeCloseTo(0.35, 10);
    expect(res.steps).toBe(35);
    expect(res.spreadR).toBeCloseTo(0.14, 10);
  });

  test('NAS100 floors to the 0.1 lot step', () => {
    // (100 + 2) pips × $1 × ¥150 = ¥15,300/lot; ¥50,000 → 3.27 → 3.2 lots
    const res = computeFxSizing({
      instrumentSymbol: 'NAS100',
      riskYen: 50000,
      slPips: 100,
      spreadPips: 2,
      usdJpy: 150,
    });
    expect(res.lots).toBeCloseTo(3.2, 10);
    expect(res.steps).toBe(32);
  });

  test('exact multiples are not lost to float noise', () => {
    // ¥85,500 × 0.35 = ¥29,925 → exactly 0.35 lots
    const res = computeFxSizing({
      instrumentSymbol: 'XAUUSD',
      riskYen: 29925,
      slPips: 500,
      spreadPips: 70,
      usdJpy: 150,
    });
    expect(res.steps).toBe(35);
  });

  test('blank spread counts as 0', () => {
    const res = computeFxSizing({
      instrumentSymbol: 'XAUUSD',
      riskYen: 30000,
      slPips: 500,
      spreadPips: NaN,
      usdJpy: 150,
    });
    expect(res.riskPerLotYen).toBeCloseTo(75000, 5);
    expect(res.spreadR).toBe(0);
  });

  test.each([
    { riskYen: 0, slPips: 500, spreadPips: 70, usdJpy: 150 },
    { riskYen: 30000, slPips: 0, spreadPips: 70, usdJpy: 150 },
    { riskYen: 30000, slPips: 500, spreadPips: -1, usdJpy: 150 },
    { riskYen: 30000, slPips: 500, spreadPips: 70, usdJpy: NaN },
  ])('blank/≤0 input → invalid ($riskYen/$slPips/$spreadPips/$usdJpy)', (over) => {
    const res = computeFxSizing({ instrumentSymbol: 'XAUUSD', ...over });
    expect(res.valid).toBe(false);
    expect(res.steps).toBe(0);
  });
});

describe('computeExit — spread-aware runner TP (DESIGN-FOREX.md §4.2)', () => {
  test('σ = 0 reproduces the futures formula', () => {
    const res = exit({ totalContracts: 6, partialContracts: 3, spreadR: 0 });
    expect(res.runnerLevelR).toBeCloseTo(1.2, 5);
    expect(res.spreadCostUsd).toBe(0);
  });

  test('§4.2 fixture: p = 0.5, a = 0.8, σ = 0.14 → b = 1.76R', () => {
    const res = exit({ totalContracts: 4, partialContracts: 2, spreadR: 0.14 });
    expect(res.runnerLevelR).toBeCloseTo(1.76, 5);
  });

  test('net winner == T × net risk (true 1:1 after spread)', () => {
    const res = exit({ totalContracts: 35, partialContracts: 17, spreadR: 0.14 }, 7.5, 500);
    const netRisk = -res.fullLossUsd;
    expect(res.blendedWinnerR).toBeCloseTo(1, 10);
    expect(res.blendedWinnerUsd).toBeCloseTo(netRisk, 6);
  });

  test('outcomes are net of spread', () => {
    // C=4, k=2, R$=100/step, σ=0.1
    const params = { dollarPerPoint: 1, stopPoints: 100 };
    const base = { totalContracts: 4, partialContracts: 2, partialLevelR: 0.8, targetRR: 1 };
    const off = computeExit({ ...base, stopToBreakeven: false, spreadR: 0.1 }, params);
    const be = computeExit({ ...base, stopToBreakeven: true, spreadR: 0.1 }, params);
    expect(off.fullLossUsd).toBeCloseTo(-440, 6); // 4 × 1.1 × 100
    expect(off.spreadCostUsd).toBeCloseTo(40, 6);
    expect(off.partialThenStallUsd).toBeCloseTo(2 * 0.7 * 100 - 2 * 1.1 * 100, 6); // −80
    expect(be.partialThenStallUsd).toBeCloseTo(2 * 0.7 * 100 - 2 * 0.1 * 100, 6); // +120
  });

  test('partial that does not cover the spread is flagged', () => {
    const res = exit({ totalContracts: 4, partialContracts: 2, partialLevelR: 0.1, spreadR: 0.2 });
    expect(res.warnings.join(' ')).toMatch(/doesn't cover the spread/i);
  });

  test('price levels use the pip size', () => {
    // XAUUSD long @ 2650, SL 500 pips × 0.01 = $5.00
    const res = computeExit(
      {
        totalContracts: 4,
        partialContracts: 2,
        partialLevelR: 0.8,
        targetRR: 1,
        stopToBreakeven: false,
        entryPrice: 2650,
        direction: 'long',
        spreadR: 0.14,
      },
      { dollarPerPoint: 1.5, stopPoints: 500, priceUnit: 0.01 },
    );
    expect(res.prices?.stop).toBeCloseTo(2645, 6);
    expect(res.prices?.partial).toBeCloseTo(2654, 6);
    expect(res.prices?.runner).toBeCloseTo(2650 + 1.76 * 5, 6);
    expect(res.runnerTravelPoints).toBeCloseTo(880, 6); // pips
  });
});
