import { describe, expect, test } from 'vitest';
import { computeExit, computeSizing, type ExitInput } from './calc';

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
