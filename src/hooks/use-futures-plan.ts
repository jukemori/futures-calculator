'use client';

import { computeSizing } from '@/lib/calc';
import { DEFAULT_CONTRACT } from '@/lib/contracts';
import { formatUsd } from '@/lib/format';
import { usePersistentState } from '@/lib/storage';
import { FUTURES_UNITS } from '@/lib/units';
import { useExitInputs } from './use-exit-inputs';
import type { ModePlan } from './use-exit-plan';

/** Futures mode: inputs, stage-① sizing, and the plan handed to stage ②. */
export function useFuturesPlan() {
  // All inputs persist so the trader reopens where they left off (§6.3).
  const [contractSymbol, setContract] = usePersistentState('contract', DEFAULT_CONTRACT);
  const [riskStr, setRisk] = usePersistentState('risk', '');
  const [stopStr, setStop] = usePersistentState('stop', '');
  const exitInputs = useExitInputs('');

  const stopPoints = Number.parseFloat(stopStr);
  const sizing = computeSizing({
    contractSymbol,
    riskDollars: Number.parseFloat(riskStr),
    stopPoints,
  });

  const plan: ModePlan = {
    symbol: contractSymbol,
    context:
      sizing.riskPerContract > 0
        ? `${contractSymbol} · $${sizing.dollarPerPoint}/pt · R ${formatUsd(sizing.riskPerContract, { sign: false })}`
        : '',
    units: FUTURES_UNITS,
    totalSteps: sizing.contracts,
    netRiskPerStep: sizing.riskPerContract,
    exitParams: { valuePerPoint: sizing.dollarPerPoint, stopPoints },
    spreadR: 0,
    exitInputs,
    isDirty:
      riskStr !== '' ||
      stopStr !== '' ||
      exitInputs.entryStr !== '' ||
      exitInputs.partialContracts !== 0,
    reset: () => {
      setContract(DEFAULT_CONTRACT);
      setRisk('');
      setStop('');
      exitInputs.reset();
    },
  };

  return {
    plan,
    card: {
      contractSymbol,
      riskStr,
      stopStr,
      onContract: setContract,
      onRisk: setRisk,
      onStop: setStop,
      result: sizing,
    },
  };
}
