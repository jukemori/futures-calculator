// All math for the app lives here as pure functions — no React, no side effects.
// The one formula the whole product is built around (DESIGN.md §3.2):
//
//     b = (T·C − k·a) / (C − k)        // runner TP in R
//
// Forex mode generalizes it with the spread σ (DESIGN-FOREX.md §4.2); σ = 0 is
// exactly the futures formula, so one engine serves both modes.
//
// Everything else is honest outcome accounting and price conversion around it.

import { getContract } from './contracts';
import { getInstrument } from './instruments';

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

// ── Forex sizing (DESIGN-FOREX.md §3) ────────────────────────────────────────

export type FxSizingInput = {
  instrumentSymbol: string;
  riskYen: number;
  slPips: number;
  spreadPips: number; // blank → 0; the spread is paid on the way in
  usdJpy: number;
};

export type FxSizingResult = {
  valid: boolean;
  yenPerPipPerLot: number;
  riskPerLotYen: number; // (SL + spread) × ¥/pip/lot — the real loss per lot
  lots: number; // floored to the lot step
  exactLots: number;
  steps: number; // lots / lotStep — the integer C the exit engine works in
  yenPerPipPerStep: number;
  lotStep: number;
  spreadR: number; // σ = spread / SL
};

export function computeFxSizing(input: FxSizingInput): FxSizingResult {
  const inst = getInstrument(input.instrumentSymbol);
  const { riskYen, slPips, usdJpy } = input;
  const spreadPips = Number.isFinite(input.spreadPips) ? input.spreadPips : 0;
  const lotStep = inst?.lotStep ?? 1;
  const yenPerPipPerLot = inst && pos(usdJpy) ? inst.usdPerPoint * inst.pipSize * usdJpy : 0;
  const invalid: FxSizingResult = {
    valid: false,
    yenPerPipPerLot,
    riskPerLotYen: 0,
    lots: 0,
    exactLots: 0,
    steps: 0,
    yenPerPipPerStep: yenPerPipPerLot * lotStep,
    lotStep,
    spreadR: 0,
  };

  if (!inst || !pos(yenPerPipPerLot) || !pos(slPips) || !pos(riskYen) || spreadPips < 0) {
    return invalid;
  }

  const riskPerLotYen = (slPips + spreadPips) * yenPerPipPerLot;
  const exactLots = riskYen / riskPerLotYen;
  // Round away float noise before flooring (0.35 / 0.01 = 34.999…).
  const steps = Math.floor(Math.round((exactLots / lotStep) * 1e6) / 1e6);

  return {
    valid: true,
    yenPerPipPerLot,
    riskPerLotYen,
    lots: steps * lotStep,
    exactLots,
    steps,
    yenPerPipPerStep: yenPerPipPerLot * lotStep,
    lotStep,
    spreadR: spreadPips / slPips,
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
  spreadR?: number; // σ = spread / stop, paid once per leg (forex). Default 0 (futures).
};

export type ExitResult = {
  valid: boolean; // false → C ≤ 0, exit card disabled
  hasRunner: boolean; // false → k = C, no runner (b undefined)
  runnerLevelR: number; // b — NaN when there is no runner
  partialFraction: number; // p = k / C (derived, never chosen)
  blendedWinnerR: number; // == T when the runner hits
  blendedWinnerUsd: number; // total $ if the runner hits (net of spread)
  partialThenStallUsd: number; // partial fills then price reverses to stop (depends on BE)
  fullLossUsd: number; // −C·R$·(1 + σ) (original stop)
  spreadCostUsd: number; // C·σ·R$ — what the spread costs on the whole position
  runnerTravelPoints: number; // b × stopPoints — how far price must travel to the runner TP
  prices?: { stop: number; partial: number; runner: number };
  warnings: string[];
};

export type ExitParams = {
  dollarPerPoint: number; // money per stop unit per size unit (¥/pip/lot-step in forex)
  stopPoints: number; // stop distance in stop units (pts or pips)
  priceUnit?: number; // price per stop unit — pipSize in forex, 1 for futures
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeExit(input: ExitInput, params: ExitParams): ExitResult {
  const C = Math.max(0, Math.floor(input.totalContracts));
  const k = Math.min(C, Math.max(0, Math.floor(input.partialContracts))); // clamp to 0…C (§7)
  const { partialLevelR: a, targetRR: T, stopToBreakeven } = input;
  const { dollarPerPoint, stopPoints } = params;
  const priceUnit = params.priceUnit ?? 1;
  const sigma = input.spreadR !== undefined && input.spreadR > 0 ? input.spreadR : 0;

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
      spreadCostUsd: 0,
      runnerTravelPoints: 0,
      warnings: ['increase risk or tighten stop — not enough for one contract'],
    };
  }

  const runner = C - k;
  const partialFraction = k / C;
  const hasRunner = runner > 0;

  // Every leg pays the spread once (DESIGN-FOREX.md §4.1): loss −(1+σ), partial
  // a−σ, runner b−σ. Solve the net winner = T × net risk for b:
  //   b = (T·C·(1 + σ) + C·σ − k·a) / (C − k)
  // σ = 0 → b = (T·C − k·a) / (C − k). NaN when there's no runner (§7).
  const runnerLevelR = hasRunner ? (T * C * (1 + sigma) + C * sigma - k * a) / runner : NaN;

  // Net blended winner in R of net risk == T when the runner hits (by construction).
  const winnerLegsR = k * (a - sigma) + (hasRunner ? runner * (runnerLevelR - sigma) : 0);
  const blendedWinnerR = winnerLegsR / (C * (1 + sigma));
  const blendedWinnerUsd = winnerLegsR * riskPerContract;

  // Partial fills at a, then price reverses to the stop.
  //   BE on  → runner exits at break-even (still pays its spread): k·(a−σ)·R$ − runner·σ·R$
  //   BE off → runner takes the full original stop: k·(a−σ)·R$ − runner·(1+σ)·R$
  const partialLegUsd = k * (a - sigma) * riskPerContract;
  const partialThenStallUsd = stopToBreakeven
    ? partialLegUsd - runner * sigma * riskPerContract
    : partialLegUsd - runner * (1 + sigma) * riskPerContract;

  const fullLossUsd = -C * (1 + sigma) * riskPerContract;
  const spreadCostUsd = C * sigma * riskPerContract;

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
    const stopDist = stopPoints * priceUnit;
    prices = {
      stop: input.entryPrice - dir * stopDist,
      partial: input.entryPrice + dir * a * stopDist,
      runner: hasRunner ? input.entryPrice + dir * runnerLevelR * stopDist : NaN,
    };
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  if (k > 0 && a <= sigma) {
    warnings.push(`partial at ${r1(a)}R doesn't cover the spread — it closes at a net loss`);
  }
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
    spreadCostUsd,
    runnerTravelPoints,
    prices,
    warnings,
  };
}
