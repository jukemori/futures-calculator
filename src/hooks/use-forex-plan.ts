'use client';

import { computeFxSizing } from '@/lib/calc';
import { formatYen } from '@/lib/format';
import { DEFAULT_INSTRUMENT, getInstrument, INSTRUMENTS } from '@/lib/instruments';
import { usePersistentState } from '@/lib/storage';
import { forexUnits } from '@/lib/units';
import { useExitInputs } from './use-exit-inputs';
import type { ModePlan } from './use-exit-plan';
import { useUsdJpy } from './use-usd-jpy';

/** Forex mode (DESIGN-FOREX.md): inputs, yen sizing with spread, live USD/JPY,
 *  and the plan handed to stage ②. Inputs persist under the `fx.` prefix. */
export function useForexPlan() {
  const [instrumentSymbol, setInstrument] = usePersistentState('fx.instrument', DEFAULT_INSTRUMENT);
  const [riskStr, setRisk] = usePersistentState('fx.risk', '');
  const [stopStr, setStop] = usePersistentState('fx.stop', '');
  // Spread is remembered per instrument — the two differ by an order of magnitude.
  const [spreads, setSpreads] = usePersistentState<Record<string, string>>('fx.spread', {});
  const exitInputs = useExitInputs('fx.');
  const usdJpy = useUsdJpy();

  const inst = getInstrument(instrumentSymbol) ?? INSTRUMENTS[0];
  const spreadStr = spreads[instrumentSymbol] ?? String(inst.spreadPips);
  const slPips = Number.parseFloat(stopStr);

  const sizing = computeFxSizing({
    instrumentSymbol,
    riskYen: Number.parseFloat(riskStr),
    slPips,
    spreadPips: Number.parseFloat(spreadStr),
    usdJpy: usdJpy.rate,
  });

  const yen = (n: number) => formatYen(n, { sign: false });

  const plan: ModePlan = {
    symbol: instrumentSymbol,
    context:
      sizing.valid && sizing.steps > 0
        ? `${instrumentSymbol} · ${yen(sizing.yenPerPipPerLot)}/pip/lot · R ${yen(sizing.riskPerLotYen)}/lot`
        : '',
    units: forexUnits(inst),
    totalSteps: sizing.steps,
    netRiskPerStep: sizing.riskPerLotYen * sizing.lotStep,
    exitParams: {
      valuePerPoint: sizing.yenPerPipPerStep,
      stopPoints: slPips,
      priceUnit: inst.pipSize,
    },
    spreadR: sizing.spreadR,
    exitInputs,
    isDirty:
      riskStr !== '' ||
      stopStr !== '' ||
      exitInputs.entryStr !== '' ||
      exitInputs.partialContracts !== 0,
    // Reset clears only this mode (DESIGN-FOREX.md §6.2).
    reset: () => {
      setInstrument(DEFAULT_INSTRUMENT);
      setRisk('');
      setStop('');
      setSpreads({});
      exitInputs.reset();
    },
  };

  return {
    plan,
    card: {
      instrument: inst,
      riskStr,
      stopStr,
      spreadStr,
      onInstrument: setInstrument,
      onRisk: setRisk,
      onStop: setStop,
      onSpread: (s: string) => setSpreads({ ...spreads, [instrumentSymbol]: s }),
      usdJpy,
      result: sizing,
    },
  };
}
