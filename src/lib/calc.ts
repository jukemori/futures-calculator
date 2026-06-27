// All math for the app lives here as pure functions — no React, no side effects.
// The one formula the whole product is built around (DESIGN.md §3.2):
//
//     b = (T·C − k·a) / (C − k)        // runner TP in R
//
// Everything else is honest outcome accounting and price conversion around it.

import { getContract } from './contracts';

// ── Sizing (Stage 1, port of the spreadsheet) ───────────────────────────────

export type SizingInput = {
  contractSymbol: string;
  riskDollars: number;
  stopPoints: number;
};

export type SizingResult = {
  valid: boolean; // false → render "—" (mirrors the sheet's IFERROR), never an error
  dollarPerPoint: number;
  riskPerContract: number; // R$ = stopPoints × dollarPerPoint
  contracts: number; // floored — what you can actually trade
  exactContracts: number; // pre-floor → "leaving X on the table" hint
};

const pos = (n: number) => Number.isFinite(n) && n > 0;

export function computeSizing(input: SizingInput): SizingResult {
  const dollarPerPoint = getContract(input.contractSymbol)?.dollarPerPoint ?? 0;
  const { riskDollars, stopPoints } = input;

  // Guards mirror the sheet's IF/IFERROR: any blank/≤0 input → empty output.
  if (!pos(dollarPerPoint) || !pos(stopPoints) || !pos(riskDollars)) {
    return { valid: false, dollarPerPoint, riskPerContract: 0, contracts: 0, exactContracts: 0 };
  }

  const riskPerContract = stopPoints * dollarPerPoint;
  const exactContracts = riskDollars / riskPerContract;

  return {
    valid: true,
    dollarPerPoint,
    riskPerContract,
    contracts: Math.floor(exactContracts),
    exactContracts,
  };
}

// ── Exit plan (Stage 2, the new part) ────────────────────────────────────────

export type ExitInput = {
  totalContracts: number; // C — defaults to SizingResult.contracts, overridable
  partialContracts: number; // k — taken off at the partial
  partialLevelR: number; // a — partial exit level in R (default 0.8)
  targetRR: number; // T — target blended RR (default 1.0)
  stopToBreakeven: boolean; // moves the runner's stop to BE once the partial fills
  entryPrice?: number;
  direction?: 'long' | 'short';
};

export type ExitResult = {
  valid: boolean; // false → C ≤ 0, exit card disabled
  hasRunner: boolean; // false → k = C, no runner (b undefined)
  runnerLevelR: number; // b — NaN when there is no runner
  partialFraction: number; // p = k / C (derived, never chosen)
  blendedWinnerR: number; // == T when the runner hits
  blendedWinnerUsd: number; // total $ if the runner hits
  partialThenStallUsd: number; // partial fills then price reverses to stop (depends on BE)
  fullLossUsd: number; // −C·R$ (original stop)
  runnerTravelPoints: number; // b × stopPoints — how far price must travel to the runner TP
  prices?: { stop: number; partial: number; runner: number };
  warnings: string[];
};

export type ExitParams = {
  dollarPerPoint: number;
  stopPoints: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeExit(input: ExitInput, params: ExitParams): ExitResult {
  const C = Math.max(0, Math.floor(input.totalContracts));
  const k = Math.min(C, Math.max(0, Math.floor(input.partialContracts))); // clamp to 0…C (§7)
  const { partialLevelR: a, targetRR: T, stopToBreakeven } = input;
  const { dollarPerPoint, stopPoints } = params;

  const riskPerContract = pos(stopPoints) && pos(dollarPerPoint) ? stopPoints * dollarPerPoint : 0; // R$
  const warnings: string[] = [];

  if (C <= 0) {
    return {
      valid: false,
      hasRunner: false,
      runnerLevelR: NaN,
      partialFraction: 0,
      blendedWinnerR: 0,
      blendedWinnerUsd: 0,
      partialThenStallUsd: 0,
      fullLossUsd: 0,
      runnerTravelPoints: 0,
      warnings: ['increase risk or tighten stop — not enough for one contract'],
    };
  }

  const runner = C - k;
  const partialFraction = k / C;
  const hasRunner = runner > 0;

  // b = (T·C − k·a) / (C − k). NaN when there's no runner (avoid divide-by-zero, §7).
  const runnerLevelR = hasRunner ? (T * C - k * a) / runner : NaN;

  // Blended winner: average R per contract if the runner hits == T (by construction).
  const blendedWinnerR = hasRunner ? (k * a + runner * runnerLevelR) / C : a;
  const blendedWinnerUsd = (k * a + (hasRunner ? runner * runnerLevelR : 0)) * riskPerContract;

  // Partial fills at a, then price reverses to the stop.
  //   BE on  → runner exits at break-even: +k·a·R$ (can't lose once partial is in)
  //   BE off → runner takes the full original stop: k·a·R$ − runner·R$
  const partialThenStallUsd = stopToBreakeven
    ? k * a * riskPerContract
    : k * a * riskPerContract - runner * riskPerContract;

  const fullLossUsd = -C * riskPerContract;

  const runnerTravelPoints = hasRunner && pos(stopPoints) ? runnerLevelR * stopPoints : 0;

  // Price-level conversion (§3.5) — only when entry + direction are supplied.
  let prices: ExitResult['prices'];
  if (
    input.entryPrice !== undefined &&
    Number.isFinite(input.entryPrice) &&
    input.direction &&
    pos(stopPoints)
  ) {
    const dir = input.direction === 'long' ? 1 : -1;
    prices = {
      stop: input.entryPrice - dir * stopPoints,
      partial: input.entryPrice + dir * a * stopPoints,
      runner: hasRunner ? input.entryPrice + dir * runnerLevelR * stopPoints : NaN,
    };
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  if (!hasRunner) {
    warnings.push(`no runner — full position exits at ${r1(a)}R`);
  } else {
    // sign(b − a) = sign(T − a): a ≥ T with a partial puts the runner TP at/below the partial.
    if (k > 0 && a >= T) {
      warnings.push(
        `partial level (${r1(a)}R) ≥ target RR (${r1(T)}R) — runner TP lands at or below the partial`,
      );
    }
    if (runnerLevelR > 1.5) {
      warnings.push(
        `runner at ${r1(runnerLevelR)}R is a long extension — lower hit rate on breakouts`,
      );
    }
  }

  return {
    valid: true,
    hasRunner,
    runnerLevelR,
    partialFraction,
    blendedWinnerR,
    blendedWinnerUsd,
    partialThenStallUsd,
    fullLossUsd,
    runnerTravelPoints,
    prices,
    warnings,
  };
}
