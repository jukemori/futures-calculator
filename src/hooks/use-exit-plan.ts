'use client';

import { computeExit, type ExitParams } from '@/lib/calc';
import type { ExitUnits } from '@/lib/units';
import { numOr } from '@/lib/utils';
import type { Preset } from '@/lib/presets';
import type { ExitInputs } from './use-exit-inputs';

/** Everything stage ② needs from a mode's stage ① — the seam that lets one
 *  exit engine and one ExitCard serve both futures and forex. */
export type ModePlan = {
  symbol: string;
  /** Stage-① context line for the exit card header; empty until sized. */
  context: string;
  units: ExitUnits;
  totalSteps: number; // C — whole contracts or whole lot steps
  /** R in money per size step, net of spread — denominator for per-row R. */
  netRiskPerStep: number;
  exitParams: ExitParams;
  spreadR: number;
  exitInputs: ExitInputs;
  isDirty: boolean;
  reset: () => void;
};

/** Derives the exit plan from a mode's sizing. Results are never stored; the
 *  React Compiler memoizes this pure derivation (DESIGN.md §6.2). */
export function useExitPlan(plan: ModePlan) {
  const ex = plan.exitInputs;
  const C = plan.totalSteps;

  // Keep k within 0…C for both display and calc.
  const k = Math.min(ex.partialContracts, Math.max(0, C));

  const result = computeExit(
    {
      totalContracts: C,
      partialContracts: k,
      partialLevelR: numOr(ex.partialLevelStr, 0.8),
      targetRR: numOr(ex.targetRRStr, 1),
      stopToBreakeven: ex.stopToBreakeven,
      entryPrice: ex.entryStr.trim() !== '' ? numOr(ex.entryStr, NaN) : undefined,
      direction: ex.direction,
      spreadR: plan.spreadR,
    },
    plan.exitParams,
  );

  const applyPreset = (p: Preset) => {
    ex.setPartialLevel(String(p.a));
    ex.setTargetRR(String(p.t));
    ex.setPartial(Math.min(C, Math.max(0, Math.round(p.fraction * C))));
  };

  return { k, result, applyPreset };
}
