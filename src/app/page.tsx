'use client';

import { computeExit, computeSizing } from '@/lib/calc';
import { DEFAULT_CONTRACT } from '@/lib/contracts';
import { usePersistentState } from '@/lib/storage';
import { SizingCard } from '@/components/sizing-card';
import { ExitCard, type Preset } from '@/components/exit-card';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

// Parse a free-text field, falling back to a default when blank/invalid.
const numOr = (s: string, fallback: number) => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

export default function Home() {
  // All inputs persist so the trader reopens where they left off (§6.3).
  const [contractSymbol, setContract] = usePersistentState('contract', DEFAULT_CONTRACT);
  const [riskStr, setRisk] = usePersistentState('risk', '');
  const [stopStr, setStop] = usePersistentState('stop', '');
  const [totalStr, setTotal] = usePersistentState('total', ''); // '' → use sizing
  const [partialContracts, setPartial] = usePersistentState('k', 0);
  const [partialLevelStr, setPartialLevel] = usePersistentState('a', '0.8');
  const [targetRRStr, setTargetRR] = usePersistentState('t', '1.0');
  const [stopToBreakeven, setStopBE] = usePersistentState('be', false);
  const [entryStr, setEntry] = usePersistentState('entry', '');
  const [direction, setDirection] = usePersistentState<'long' | 'short'>('dir', 'long');

  // Results are derived, never stored. React Compiler memoizes these pure
  // derivations automatically — no manual useMemo needed (DESIGN.md §6.2).
  const sizing = computeSizing({
    contractSymbol,
    riskDollars: Number.parseFloat(riskStr),
    stopPoints: Number.parseFloat(stopStr),
  });

  // Effective total contracts: explicit override, else the sized count.
  const usingSizedTotal = totalStr.trim() === '';
  const effectiveTotal = usingSizedTotal
    ? sizing.contracts
    : Math.max(0, Math.floor(numOr(totalStr, 0)));

  // Keep k within 0…C for both display and calc.
  const k = Math.min(partialContracts, Math.max(0, effectiveTotal));

  // The exit plan is a pure function of the sizing context (contract → $/pt → R$,
  // stop, and contract count), so selecting a contract or editing risk/stop flows
  // straight through to the runner TP and every dollar outcome.
  const exit = computeExit(
    {
      totalContracts: effectiveTotal,
      partialContracts: k,
      partialLevelR: numOr(partialLevelStr, 0.8),
      targetRR: numOr(targetRRStr, 1),
      stopToBreakeven,
      entryPrice: entryStr.trim() !== '' ? numOr(entryStr, NaN) : undefined,
      direction,
    },
    { dollarPerPoint: sizing.dollarPerPoint, stopPoints: Number.parseFloat(stopStr) },
  );

  const applyPreset = (p: Preset) => {
    setPartialLevel(String(p.a));
    setTargetRR(String(p.t));
    setPartial(Math.min(effectiveTotal, Math.max(0, Math.round(p.fraction * effectiveTotal))));
  };

  const isDirty =
    riskStr !== '' ||
    stopStr !== '' ||
    totalStr !== '' ||
    entryStr !== '' ||
    partialContracts !== 0;

  const clearAll = () => {
    setContract(DEFAULT_CONTRACT);
    setRisk('');
    setStop('');
    setTotal('');
    setPartial(0);
    setPartialLevel('0.8');
    setTargetRR('1.0');
    setStopBE(false);
    setEntry('');
    setDirection('long');
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 lg:h-dvh lg:overflow-hidden lg:py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Futures Risk + Runner&nbsp;TP
          </h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Size by risk, then solve the runner take-profit that holds your target RR after a
            partial.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={clearAll}
            disabled={!isDirty}
          >
            Clear
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile: stacked & scrollable. Desktop: two columns sized to fit the
          viewport so the whole tool is visible at once (§5.1). */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <SizingCard
          contractSymbol={contractSymbol}
          riskStr={riskStr}
          stopStr={stopStr}
          onContract={setContract}
          onRisk={setRisk}
          onStop={setStop}
          result={sizing}
        />

        <ExitCard
          contractSymbol={contractSymbol}
          totalContracts={effectiveTotal}
          totalStr={totalStr}
          usingSizedTotal={usingSizedTotal}
          sizingContracts={sizing.contracts}
          partialContracts={k}
          partialLevelStr={partialLevelStr}
          targetRRStr={targetRRStr}
          stopToBreakeven={stopToBreakeven}
          entryStr={entryStr}
          direction={direction}
          dollarPerPoint={sizing.dollarPerPoint}
          riskPerContract={sizing.riskPerContract}
          result={exit}
          onTotal={setTotal}
          onPartial={setPartial}
          onPartialLevel={setPartialLevel}
          onTargetRR={setTargetRR}
          onStopToBreakeven={setStopBE}
          onEntry={setEntry}
          onDirection={setDirection}
          onPreset={applyPreset}
        />
      </div>
    </main>
  );
}
