'use client';

import { Pencil, RotateCcw } from 'lucide-react';
import type { FxSizingResult } from '@/lib/calc';
import type { UsdJpy } from '@/lib/fx-rate';
import { getInstrument, type InstrumentSymbol } from '@/lib/instruments';
import { formatLots, formatQuote, formatYen } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoHint } from './info-hint';
import { InstrumentSelect } from './instrument-select';
import { NumberField } from './number-field';

type Props = {
  instrumentSymbol: InstrumentSymbol;
  riskStr: string;
  stopStr: string;
  spreadStr: string;
  onInstrument: (s: InstrumentSymbol) => void;
  onRisk: (s: string) => void;
  onStop: (s: string) => void;
  onSpread: (s: string) => void;
  usdJpy: UsdJpy;
  result: FxSizingResult;
  isDirty: boolean;
  onClear: () => void;
};

const yenAbs = (n: number) => formatYen(n).replace('+', '');

const STATUS: Record<UsdJpy['status'], string> = {
  live: 'live',
  loading: 'loading…',
  stale: 'stale — last known rate',
  manual: 'manual',
};

/** Stage ① for Forex mode: risk ¥ + SL/spread in pips + live USD/JPY → lots
 *  (DESIGN-FOREX.md §3, §5.2). */
export function FxSizingCard({
  instrumentSymbol,
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
  const inst = getInstrument(instrumentSymbol);
  const pipSize = inst?.pipSize ?? 1;
  const slPips = Number.parseFloat(stopStr);
  const spreadPips = Number.parseFloat(spreadStr);
  const { valid, yenPerPipPerLot, riskPerLotYen, lots, exactLots, lotStep } = result;
  const leftover = exactLots - lots;
  const overMax = inst !== undefined && lots > inst.maxLotsPerOrder;
  // A price move in the instrument's own terms: gold in dollars, the index in points.
  const priceMove = (n: number) =>
    instrumentSymbol === 'XAUUSD'
      ? `$${formatQuote(n, inst?.priceDecimals ?? 2)}`
      : `${formatQuote(n, 0)} ${n === 1 ? 'pt' : 'pts'}`;

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary">
            1
          </span>
          Size
        </CardTitle>
        {isDirty ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="-my-1 cursor-pointer gap-1.5 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <InstrumentSelect value={instrumentSymbol} onChange={onInstrument} />
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
            placeholder={instrumentSymbol === 'XAUUSD' ? '500' : '100'}
          />
          <NumberField
            label="Spread"
            value={spreadStr}
            onChange={onSpread}
            suffix="pips"
            placeholder={String(inst?.spreadPips ?? 0)}
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
          1 pip = <span className="text-muted-foreground">{priceMove(pipSize)}</span> on{' '}
          {instrumentSymbol}
          {Number.isFinite(slPips) && slPips > 0 ? (
            <>
              {' '}
              · {slPips} pips ={' '}
              <span className="text-muted-foreground">{priceMove(slPips * pipSize)}</span>
            </>
          ) : null}
        </p>

        <UsdJpyRow usdJpy={usdJpy} />

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
              0 lots — below the {inst?.minLot} lot minimum. Increase risk or tighten SL.
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
            ⚠ {formatLots(lots, lotStep)} lots is over OANDA’s {inst?.maxLotsPerOrder}-lot limit per
            order — split it into several orders.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsdJpyRow({ usdJpy }: { usdJpy: UsdJpy }) {
  const { live, status, useManual } = usdJpy;
  const updated = live
    ? new Date(live.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (useManual) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <NumberField
          label="USD/JPY (manual)"
          value={usdJpy.manualStr}
          onChange={usdJpy.setManualStr}
          placeholder={live ? live.rate.toFixed(2) : '150.00'}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 text-xs"
          onClick={() => usdJpy.setUseManual(false)}
        >
          Use live
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        USD/JPY{' '}
        <span className="font-mono font-medium text-foreground tabular-nums">
          {Number.isFinite(usdJpy.rate) ? usdJpy.rate.toFixed(2) : '—'}
        </span>{' '}
        <span
          className={`text-xs ${status === 'stale' ? 'text-warn' : 'text-muted-foreground/80'}`}
        >
          · {STATUS[status]}
          {updated && status !== 'loading' ? ` ${updated}` : ''}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={() => {
          // Start the override from the current rate rather than a blank field.
          if (usdJpy.manualStr === '' && Number.isFinite(usdJpy.rate)) {
            usdJpy.setManualStr(usdJpy.rate.toFixed(2));
          }
          usdJpy.setUseManual(true);
        }}
        aria-label="Enter USD/JPY manually"
        title="Enter USD/JPY manually"
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
