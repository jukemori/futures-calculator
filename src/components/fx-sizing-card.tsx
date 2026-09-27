'use client';

import type { FxSizingResult } from '@/lib/calc';
import { formatLots, formatYen } from '@/lib/format';
import type { InstrumentSymbol, ListedInstrument } from '@/lib/instruments';
import { formatMove } from '@/lib/units';
import type { UsdJpy } from '@/hooks/use-usd-jpy';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { InfoHint } from './info-hint';
import { InstrumentSelect } from './instrument-select';
import { NumberField } from './number-field';
import { ResetButton } from './reset-button';
import { StepTitle } from './step-title';
import { UsdJpyField } from './usd-jpy-field';

type Props = {
  instrument: ListedInstrument;
  riskStr: string;
  stopStr: string;
  spreadStr: string;
  onInstrument: (s: InstrumentSymbol) => void;
  onRisk: (s: string) => void;
  onStop: (s: string) => void;
  onSpread: (s: string) => void;
  usdJpy: UsdJpy;
  result: FxSizingResult;
  /** Whether any input has been touched — gates the reset affordance. */
  isDirty: boolean;
  /** Reset this mode's inputs across both stages back to defaults. */
  onClear: () => void;
};

const yenAbs = (n: number) => formatYen(n, { sign: false });

/** Stage ① for Forex mode: risk ¥ + SL/spread in pips + live USD/JPY → lots
 *  (DESIGN-FOREX.md §3, §5.2). */
export function FxSizingCard({
  instrument: inst,
  riskStr,
  stopStr,
  spreadStr,
  onInstrument,
  onRisk,
  onStop,
  onSpread,
  usdJpy,
  result,
  isDirty,
  onClear,
}: Props) {
  const { symbol, pipSize } = inst;
  const slPips = Number.parseFloat(stopStr);
  const spreadPips = Number.parseFloat(spreadStr);
  const { valid, yenPerPipPerLot, riskPerLotYen, lots, exactLots, lotStep } = result;
  const leftover = exactLots - lots;
  const overMax = lots > inst.maxLotsPerOrder;

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <StepTitle n={1}>Size</StepTitle>
        {isDirty ? <ResetButton onClick={onClear} /> : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <InstrumentSelect value={symbol} onChange={onInstrument} />
          <NumberField
            label="Risk ¥"
            value={riskStr}
            onChange={onRisk}
            suffix="¥"
            placeholder="30000"
          />
          <NumberField
            label="SL from Entry"
            value={stopStr}
            onChange={onStop}
            suffix="pips"
            placeholder={inst.slPlaceholder}
          />
          <NumberField
            label="Spread"
            value={spreadStr}
            onChange={onSpread}
            suffix="pips"
            placeholder={String(inst.spreadPips)}
            hint={
              <InfoHint label="Spread">
                OANDA spreads float — read the current one off MT5. You pay it once per trade, so
                it’s added to your risk and to every outcome.
              </InfoHint>
            }
          />
        </div>

        {/* pip definition next to the SL input — the 50-vs-500 footgun (§2.1) */}
        <p className="text-xs text-muted-foreground/80">
          1 pip = <span className="text-muted-foreground">{formatMove(inst, pipSize)}</span> on{' '}
          {symbol}
          {Number.isFinite(slPips) && slPips > 0 ? (
            <>
              {' '}
              · {slPips} pips ={' '}
              <span className="text-muted-foreground">{formatMove(inst, slPips * pipSize)}</span>
            </>
          ) : null}
        </p>

        <UsdJpyField usdJpy={usdJpy} />

        <div className="rounded-lg bg-muted px-4 py-3">
          {valid && result.steps > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tabular-nums">
                  {formatLots(lots, lotStep)}
                </span>
                <span className="text-lg text-muted-foreground">lots</span>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>
                  {yenAbs(yenPerPipPerLot)}/pip · R{' '}
                  <span className="font-semibold text-foreground">{yenAbs(riskPerLotYen)}</span>
                </div>
                <div className="text-xs text-muted-foreground/80">
                  SL {slPips} + spread {Number.isFinite(spreadPips) ? spreadPips : 0} pips
                </div>
                {leftover > lotStep * 0.02 ? (
                  <div className="text-xs text-muted-foreground/80">
                    {exactLots.toFixed(4)} exact
                  </div>
                ) : null}
              </div>
            </div>
          ) : valid ? (
            <p className="text-sm text-muted-foreground">
              0 lots — below the {inst.minLot} lot minimum. Increase risk or tighten SL.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {Number.isFinite(usdJpy.rate)
                ? 'Enter an instrument, risk ¥ and your SL distance in pips to size your position.'
                : 'USD/JPY unavailable — enter it manually to size.'}
            </p>
          )}
        </div>

        {overMax ? (
          <p className="text-xs text-warn">
            ⚠ {formatLots(lots, lotStep)} lots is over OANDA’s {inst.maxLotsPerOrder}-lot limit per
            order — split it into several orders.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
