'use client';

import { HelpCircle } from 'lucide-react';
import { useExitPlan } from '@/hooks/use-exit-plan';
import { useForexPlan } from '@/hooks/use-forex-plan';
import { useFuturesPlan } from '@/hooks/use-futures-plan';
import { usePersistentState } from '@/lib/storage';
import { ExitCard } from '@/components/exit-card';
import { FxSizingCard } from '@/components/fx-sizing-card';
import { HowItWorks } from '@/components/how-it-works';
import { ModeToggle, type Mode } from '@/components/mode-toggle';
import { SizingCard } from '@/components/sizing-card';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const SUBTITLE: Record<Mode, string> = {
  futures:
    'Size by risk, then solve the runner take-profit that holds your target RR after a partial.',
  forex:
    'Size OANDA CFDs by yen risk — spread included — then solve the runner take-profit that holds your target RR.',
};

export default function Home() {
  const [mode, setMode] = usePersistentState<Mode>('mode', 'futures');

  // Both modes stay mounted as state so switching back and forth loses nothing;
  // only the active one drives the exit plan (DESIGN-FOREX.md §5.1).
  const futures = useFuturesPlan();
  const forex = useForexPlan();
  const { plan } = mode === 'forex' ? forex : futures;
  const exit = useExitPlan(plan);

  // The "how it works" explainer is hidden by default and opened from the
  // header button; the open/closed choice persists across sessions.
  const [helpDismissed, setHelpDismissed] = usePersistentState('help', true);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 lg:h-dvh lg:overflow-hidden lg:py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {/* one string: split text nodes around the expression break hydration */}
            {`${mode === 'forex' ? 'Forex' : 'Futures'} Risk + Runner TP`}
          </h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{SUBTITLE[mode]}</p>
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
        {mode === 'forex' ? (
          <FxSizingCard {...forex.card} isDirty={plan.isDirty} onClear={plan.reset} />
        ) : (
          <SizingCard {...futures.card} isDirty={plan.isDirty} onClear={plan.reset} />
        )}

        <ExitCard
          plan={plan}
          partialContracts={exit.k}
          result={exit.result}
          onPreset={exit.applyPreset}
        />
      </div>
    </main>
  );
}
