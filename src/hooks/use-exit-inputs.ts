'use client';

import { usePersistentState } from '@/lib/storage';

export type Direction = 'long' | 'short';

const DEFAULTS = { k: 0, a: '0.8', t: '1.0', be: false, entry: '', dir: 'long' as Direction };

/** Exit-plan inputs (stage ②). Each mode persists its own copy under a key
 *  prefix ('' for futures, 'fx.' for forex) so switching modes loses nothing. */
export function useExitInputs(prefix: string) {
  const [partialContracts, setPartial] = usePersistentState(`${prefix}k`, DEFAULTS.k);
  const [partialLevelStr, setPartialLevel] = usePersistentState(`${prefix}a`, DEFAULTS.a);
  const [targetRRStr, setTargetRR] = usePersistentState(`${prefix}t`, DEFAULTS.t);
  const [stopToBreakeven, setStopBE] = usePersistentState(`${prefix}be`, DEFAULTS.be);
  const [entryStr, setEntry] = usePersistentState(`${prefix}entry`, DEFAULTS.entry);
  const [direction, setDirection] = usePersistentState<Direction>(`${prefix}dir`, DEFAULTS.dir);

  const reset = () => {
    setPartial(DEFAULTS.k);
    setPartialLevel(DEFAULTS.a);
    setTargetRR(DEFAULTS.t);
    setStopBE(DEFAULTS.be);
    setEntry(DEFAULTS.entry);
    setDirection(DEFAULTS.dir);
  };

  return {
    partialContracts,
    partialLevelStr,
    targetRRStr,
    stopToBreakeven,
    entryStr,
    direction,
    setPartial,
    setPartialLevel,
    setTargetRR,
    setStopBE,
    setEntry,
    setDirection,
    reset,
  };
}

export type ExitInputs = ReturnType<typeof useExitInputs>;
