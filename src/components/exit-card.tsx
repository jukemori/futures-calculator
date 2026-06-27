'use client';

import { useId } from 'react';
import type { ExitResult } from '@/lib/calc';
import type { ContractSymbol } from '@/lib/contracts';
import { formatPct, formatPrice, formatR, formatUsd } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { InfoHint } from './info-hint';
import { NumberField } from './number-field';
import { OutcomeRow } from './outcome-row';
import { Stepper } from './stepper';

export type Preset = { label: string; a: number; fraction: number; t: number };

export const PRESETS = [
  { label: '50% @ 0.8R', a: 0.8, fraction: 0.5, t: 1 },
  { label: '60% @ 0.8R', a: 0.8, fraction: 0.6, t: 1 },
  { label: 'Runner only', a: 0.8, fraction: 0, t: 1 },
] as const satisfies readonly Preset[];

type Props = {
  contractSymbol: ContractSymbol;
  totalContracts: number; // effective C
  totalStr: string; // override input ('' → use sizing)
  usingSizedTotal: boolean;
  sizingContracts: number;
  partialContracts: number; // k
  partialLevelStr: string; // a
  targetRRStr: string; // T
  stopToBreakeven: boolean;
  entryStr: string;
  direction: 'long' | 'short';
  dollarPerPoint: number;
  riskPerContract: number; // R$
  result: ExitResult;
  onTotal: (s: string) => void;
  onPartial: (n: number) => void;
  onPartialLevel: (s: string) => void;
  onTargetRR: (s: string) => void;
  onStopToBreakeven: (b: boolean) => void;
  onEntry: (s: string) => void;
  onDirection: (d: 'long' | 'short') => void;
  onPreset: (p: Preset) => void;
};

export function ExitCard(props: Props) {
  const {
    contractSymbol,
    totalContracts: C,
    totalStr,
    usingSizedTotal,
    sizingContracts,
    partialContracts: k,
    partialLevelStr,
    targetRRStr,
    stopToBreakeven,
    entryStr,
    direction,
    dollarPerPoint,
    riskPerContract,
    result,
    onPartial,
    onPreset,
  } = props;

  const beId = useId();
  const disabled = !result.valid; // C ≤ 0
  const rDenom = C * riskPerContract; // C·R$ — denominator for per-row R display
  const { prices } = result;

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary">
            2
          </span>
          Exit plan
        </CardTitle>
        {/* explicit link to Stage 1 — contract/risk/stop drive every number below */}
        <span className="font-mono text-xs text-muted-foreground/80">
          {riskPerContract > 0
            ? `${contractSymbol} · $${dollarPerPoint}/pt · R ${formatUsd(riskPerContract).replace('+', '')}`
            : `${contractSymbol} · size a position →`}
        </span>
      </CardHeader>

      <CardContent className="grid gap-4">
        {/* presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onPreset(p)}
              className="h-7 rounded-full px-3 text-xs font-normal text-muted-foreground"
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={usingSizedTotal ? 'Total contracts · from ①' : 'Total contracts'}
            value={totalStr}
            onChange={props.onTotal}
            placeholder={String(sizingContracts)}
            inputMode="numeric"
            hint={
              <InfoHint label="Total contracts">
                How many contracts you’re trading. Pulled from your sizing in step ① — type a number
                here to override it.
              </InfoHint>
            }
          />
          <NumberField
            label="Take off @ (R)"
            value={partialLevelStr}
            onChange={props.onPartialLevel}
            suffix="R"
            placeholder="0.8"
            hint={
              <InfoHint label="Take off @ (R)">
                Where you take the partial profit, measured in R. 0.8R means closing at 80% of your
                stop distance in your favor.
              </InfoHint>
            }
          />
          <Stepper
            label="Contracts off"
            value={k}
            min={0}
            max={Math.max(0, C)}
            onChange={onPartial}
            disabled={disabled}
            derived={formatPct(result.partialFraction)}
            hint={
              <InfoHint label="Contracts off">
                How many contracts to close at the partial. The rest become your runner. The % is
                shown, not chosen — you can’t split a whole micro.
              </InfoHint>
            }
          />
          <NumberField
            label="Target RR"
            value={targetRRStr}
            onChange={props.onTargetRR}
            suffix="R"
            placeholder="1.0"
            hint={
              <InfoHint label="Target RR">
                Your goal reward-to-risk for the whole trade if the runner hits. 1.0R is a true 1:1
                — you make what you risked.
              </InfoHint>
            }
          />
        </div>

        {/* break-even toggle — flips the entire risk story (§3.4 / §5.2) */}
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <Label htmlFor={beId} className="text-sm font-normal text-muted-foreground">
            Stop → break-even after partial
            <InfoHint label="Stop → break-even after partial">
              Once the partial fills, move your stop to entry. Your worst case turns from a loss
              into the profit you already locked in.
            </InfoHint>
          </Label>
          <Switch
            id={beId}
            checked={stopToBreakeven}
            disabled={disabled}
            onCheckedChange={props.onStopToBreakeven}
          />
        </div>

        {/* hero — the runner TP is why they opened the app (§5.2) */}
        <div className="rounded-lg bg-muted px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Runner TP
            <InfoHint label="Runner TP">
              Where to set the take-profit for your runner contracts (in R) so the whole trade still
              hits your target RR after the partial. This is the number the app exists to find.
            </InfoHint>
          </div>
          {disabled ? (
            <p className="mt-1 text-sm text-muted-foreground/80">
              increase risk or tighten stop — no contracts to plan
            </p>
          ) : result.hasRunner ? (
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-5xl font-bold text-brand tabular-nums">
                {formatR(result.runnerLevelR)}
              </span>
              {result.runnerTravelPoints > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {formatPrice(result.runnerTravelPoints)} pts travel
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 font-mono text-2xl">
              no runner — full exit at {formatR(Number(partialLevelStr) || 0)}
            </div>
          )}
        </div>

        {/* honest breakdown — visible by default, not behind an expander (§5.2) */}
        {!disabled ? (
          <div className="rounded-lg border px-4 py-2">
            <div className="flex items-center gap-2 pt-1 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground/80 uppercase">
              What each outcome pays
              <InfoHint label="What each outcome pays">
                The honest picture — not just the win. “Partial + stall” is when your partial fills
                but price reverses to your stop before the runner hits.
              </InfoHint>
            </div>
            {result.hasRunner ? (
              <OutcomeRow
                label="If runner hits"
                usd={result.blendedWinnerUsd}
                rDenominator={rDenom}
                tone="gain"
              />
            ) : null}
            <OutcomeRow
              label={stopToBreakeven ? 'Partial + stall (BE)' : 'Partial + stall'}
              usd={result.partialThenStallUsd}
              rDenominator={rDenom}
              tone={result.partialThenStallUsd >= 0 ? 'neutral' : 'loss'}
            />
            <OutcomeRow
              label="Full stop"
              usd={result.fullLossUsd}
              rDenominator={rDenom}
              tone="loss"
            />
          </div>
        ) : null}

        {/* warnings — subtle caveats, not nags (§3.4) */}
        {result.warnings.length > 0 && !disabled ? (
          <ul className="grid gap-1">
            {result.warnings.map((w) => (
              <li key={w} className="text-xs text-warn">
                ⚠ {w}
              </li>
            ))}
          </ul>
        ) : null}

        {/* price levels — only when entry + direction are filled (§3.5) */}
        <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t pt-4">
          <NumberField
            label="Entry price (optional)"
            value={entryStr}
            onChange={props.onEntry}
            placeholder="4185.0"
          />
          <ToggleGroup
            type="single"
            value={direction}
            onValueChange={(v) => v && props.onDirection(v as 'long' | 'short')}
            variant="outline"
            className="h-10"
          >
            <ToggleGroupItem value="long" className="px-4 capitalize">
              long
            </ToggleGroupItem>
            <ToggleGroupItem value="short" className="px-4 capitalize">
              short
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {prices ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm tabular-nums">
            <span className="text-loss">Stop {formatPrice(prices.stop)}</span>
            <span className="text-warn">Partial {formatPrice(prices.partial)}</span>
            {result.hasRunner ? (
              <span className="text-gain">Runner {formatPrice(prices.runner)}</span>
            ) : null}
          </div>
        ) : (
          <p className="-mt-2 text-xs text-muted-foreground/80">
            Add an entry price to convert every R-level into a bracket order price.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
