'use client';

import { computeExit, computeFxSizing, computeSizing } from '@/lib/calc';
import { DEFAULT_CONTRACT } from '@/lib/contracts';
import { formatLots, formatQuote, formatUsd, formatYen } from '@/lib/format';
import { useUsdJpy } from '@/lib/fx-rate';
import { DEFAULT_INSTRUMENT, getInstrument } from '@/lib/instruments';
import { usePersistentState } from '@/lib/storage';
import { SizingCard } from '@/components/sizing-card';
import { FxSizingCard } from '@/components/fx-sizing-card';
import { ExitCard, FUTURES_UNITS, type ExitUnits, type Preset } from '@/components/exit-card';
import { HowItWorks } from '@/components/how-it-works';
import { ModeToggle, type Mode } from '@/components/mode-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

// Parse a free-text field, falling back to a default when blank/invalid.
const numOr = (s: string, fallback: number) => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

/** Exit-plan inputs. Each mode persists its own copy under a key prefix
 *  ('' for futures, 'fx.' for forex) so switching modes loses nothing. */
function useExitInputs(prefix: string) {
  const [partialContracts, setPartial] = usePersistentState(`${prefix}k`, 0);
  const [partialLevelStr, setPartialLevel] = usePersistentState(`${prefix}a`, '0.8');
  const [targetRRStr, setTargetRR] = usePersistentState(`${prefix}t`, '1.0');
  const [stopToBreakeven, setStopBE] = usePersistentState(`${prefix}be`, false);
  const [entryStr, setEntry] = usePersistentState(`${prefix}entry`, '');
  const [direction, setDirection] = usePersistentState<'long' | 'short'>(`${prefix}dir`, 'long');

  const reset = () => {
    setPartial(0);
    setPartialLevel('0.8');
    setTargetRR('1.0');
    setStopBE(false);
    setEntry('');
    setDirection('long');
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

export default function Home() {
  const [mode, setMode] = usePersistentState<Mode>('mode', 'futures');

  // All inputs persist so the trader reopens where they left off (§6.3).
  const [contractSymbol, setContract] = usePersistentState('contract', DEFAULT_CONTRACT);
  const [riskStr, setRisk] = usePersistentState('risk', '');
  const [stopStr, setStop] = usePersistentState('stop', '');
  const futExit = useExitInputs('');

  // Forex inputs (DESIGN-FOREX.md §6.2). Spread is remembered per instrument
  // since the two differ by an order of magnitude.
  const [instrumentSymbol, setInstrument] = usePersistentState('fx.instrument', DEFAULT_INSTRUMENT);
  const [fxRiskStr, setFxRisk] = usePersistentState('fx.risk', '');
  const [fxStopStr, setFxStop] = usePersistentState('fx.stop', '');
  const [spreads, setSpreads] = usePersistentState<Record<string, string>>('fx.spread', {});
  const fxExit = useExitInputs('fx.');
  const usdJpy = useUsdJpy();

  // The "how it works" explainer is hidden by default and opened from the
  // header button; the open/closed choice persists across sessions.
  const [helpDismissed, setHelpDismissed] = usePersistentState('help', true);

  const isForex = mode === 'forex';
  const ex = isForex ? fxExit : futExit;

  const inst = getInstrument(instrumentSymbol);
  const spreadStr = spreads[instrumentSymbol] ?? String(inst?.spreadPips ?? '');
  const setSpread = (s: string) => setSpreads({ ...spreads, [instrumentSymbol]: s });

  // Results are derived, never stored. React Compiler memoizes these pure
  // derivations automatically — no manual useMemo needed (DESIGN.md §6.2).
  const sizing = computeSizing({
    contractSymbol,
    riskDollars: Number.parseFloat(riskStr),
    stopPoints: Number.parseFloat(stopStr),
  });
  const fxSizing = computeFxSizing({
    instrumentSymbol,
    riskYen: Number.parseFloat(fxRiskStr),
    slPips: Number.parseFloat(fxStopStr),
    spreadPips: Number.parseFloat(spreadStr),
    usdJpy: usdJpy.rate,
  });

  // Total size is driven entirely by sizing (①) — whole contracts in futures,
  // whole lot steps in forex (DESIGN-FOREX.md §4.3).
  const effectiveTotal = isForex ? fxSizing.steps : sizing.contracts;

  // Keep k within 0…C for both display and calc.
  const k = Math.min(ex.partialContracts, Math.max(0, effectiveTotal));

  // The exit plan is a pure function of the sizing context (money per stop unit
  // per size step, stop distance, spread), so every stage-① edit flows straight
  // through to the runner TP and every outcome.
  const exit = computeExit(
    {
      totalContracts: effectiveTotal,
      partialContracts: k,
      partialLevelR: numOr(ex.partialLevelStr, 0.8),
      targetRR: numOr(ex.targetRRStr, 1),
      stopToBreakeven: ex.stopToBreakeven,
      entryPrice: ex.entryStr.trim() !== '' ? numOr(ex.entryStr, NaN) : undefined,
      direction: ex.direction,
      spreadR: isForex ? fxSizing.spreadR : 0,
    },
    isForex
      ? {
          dollarPerPoint: fxSizing.yenPerPipPerStep,
          stopPoints: Number.parseFloat(fxStopStr),
          priceUnit: inst?.pipSize ?? 1,
        }
      : { dollarPerPoint: sizing.dollarPerPoint, stopPoints: Number.parseFloat(stopStr) },
  );

  const priceDecimals = inst?.priceDecimals ?? 2;
  const fxUnits: ExitUnits = {
    money: formatYen,
    size: (n) => formatLots(n * fxSizing.lotStep, fxSizing.lotStep),
    sizeNoun: () => 'lots',
    sizeTitle: 'Lots',
    stepScale: fxSizing.lotStep,
    stepDecimals: Math.max(0, Math.round(-Math.log10(fxSizing.lotStep))),
    dist: 'pips',
    price: (n) => `$${formatQuote(n, priceDecimals)}`,
    entryPlaceholder: instrumentSymbol === 'XAUUSD' ? '2650.00' : '21480.0',
    hintSizeSplit: `lots only split in ${fxSizing.lotStep} steps.`,
  };

  const context = isForex
    ? fxSizing.valid && fxSizing.steps > 0
      ? `${instrumentSymbol} · ${formatYen(fxSizing.yenPerPipPerLot).replace('+', '')}/pip/lot · R ${formatYen(fxSizing.riskPerLotYen).replace('+', '')}/lot`
      : ''
    : sizing.riskPerContract > 0
      ? `${contractSymbol} · $${sizing.dollarPerPoint}/pt · R ${formatUsd(sizing.riskPerContract).replace('+', '')}`
      : '';

  // Net R per size step (includes the spread in forex) — the per-row R denominator.
  const netRiskPerStep = isForex
    ? fxSizing.riskPerLotYen * fxSizing.lotStep || 0
    : sizing.riskPerContract;

  const applyPreset = (p: Preset) => {
    ex.setPartialLevel(String(p.a));
    ex.setTargetRR(String(p.t));
    ex.setPartial(Math.min(effectiveTotal, Math.max(0, Math.round(p.fraction * effectiveTotal))));
  };

  const isDirty = isForex
    ? fxRiskStr !== '' ||
      fxStopStr !== '' ||
      fxExit.entryStr !== '' ||
      fxExit.partialContracts !== 0
    : riskStr !== '' || stopStr !== '' || futExit.entryStr !== '' || futExit.partialContracts !== 0;

  // Reset clears only the active mode (DESIGN-FOREX.md §6.2).
  const clearAll = () => {
    if (isForex) {
      setInstrument(DEFAULT_INSTRUMENT);
      setFxRisk('');
      setFxStop('');
      setSpreads({});
      fxExit.reset();
    } else {
      setContract(DEFAULT_CONTRACT);
      setRisk('');
      setStop('');
      futExit.reset();
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 lg:h-dvh lg:overflow-hidden lg:py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {`${isForex ? 'Forex' : 'Futures'} Risk + Runner\u00a0TP`}
          </h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {isForex
              ? 'Size OANDA CFDs by yen risk — spread included — then solve the runner take-profit that holds your target RR.'
              : 'Size by risk, then solve the runner take-profit that holds your target RR after a partial.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ModeToggle value={mode} onChange={setMode} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setHelpDismissed(false)}
            disabled={!helpDismissed}
            title="Show how this works"
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">How it works</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {!helpDismissed ? <HowItWorks mode={mode} onClose={() => setHelpDismissed(true)} /> : null}

      {/* Mobile: stacked & scrollable. Desktop: two columns sized to fit the
          viewport so the whole tool is visible at once (§5.1). */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        {isForex ? (
          <FxSizingCard
            instrumentSymbol={instrumentSymbol}
            riskStr={fxRiskStr}
            stopStr={fxStopStr}
            spreadStr={spreadStr}
            onInstrument={setInstrument}
            onRisk={setFxRisk}
            onStop={setFxStop}
            onSpread={setSpread}
            usdJpy={usdJpy}
            result={fxSizing}
            isDirty={isDirty}
            onClear={clearAll}
          />
        ) : (
          <SizingCard
            contractSymbol={contractSymbol}
            riskStr={riskStr}
            stopStr={stopStr}
            onContract={setContract}
            onRisk={setRisk}
            onStop={setStop}
            result={sizing}
            isDirty={isDirty}
            onClear={clearAll}
          />
        )}

        <ExitCard
          context={context}
          symbol={isForex ? instrumentSymbol : contractSymbol}
          units={isForex ? fxUnits : FUTURES_UNITS}
          netRiskPerStep={netRiskPerStep}
          totalContracts={effectiveTotal}
          partialContracts={k}
          partialLevelStr={ex.partialLevelStr}
          targetRRStr={ex.targetRRStr}
          stopToBreakeven={ex.stopToBreakeven}
          entryStr={ex.entryStr}
          direction={ex.direction}
          result={exit}
          onPartial={ex.setPartial}
          onPartialLevel={ex.setPartialLevel}
          onTargetRR={ex.setTargetRR}
          onStopToBreakeven={ex.setStopBE}
          onEntry={ex.setEntry}
          onDirection={ex.setDirection}
          onPreset={applyPreset}
        />
      </div>
    </main>
  );
}
