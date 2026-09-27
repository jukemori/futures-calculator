'use client';

import { useId } from 'react';
import type { ExitResult } from '@/lib/calc';
import { formatPct, formatPrice, formatR } from '@/lib/format';
import { PRESETS, type Preset } from '@/lib/presets';
import type { Direction } from '@/hooks/use-exit-inputs';
import type { ModePlan } from '@/hooks/use-exit-plan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { InfoHint } from './info-hint';
import { NumberField } from './number-field';
import { OutcomeRow } from './outcome-row';
import { StepTitle } from './step-title';
import { Stepper } from './stepper';

type Props = {
  /** The active mode's stage-① output and stage-② inputs (units, C, R, setters). */
  plan: ModePlan;
  partialContracts: number; // k, already clamped to 0…C
  result: ExitResult;
  onPreset: (p: Preset) => void;
};

export function ExitCard({ plan, partialContracts: k, result, onPreset }: Props) {
  const { context, symbol, units, netRiskPerStep, totalSteps: C, exitInputs: ex } = plan;

  const beId = useId();
  const disabled = !result.valid; // C ≤ 0
  const rDenom = C * netRiskPerStep; // C·R$ — denominator for per-row R display
  const { prices } = result;

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <StepTitle n={2}>Exit plan</StepTitle>
        {/* explicit link to Stage 1 — contract/risk/stop drive every number below */}
        <span className="font-mono text-xs text-muted-foreground/80">
          {context || `${symbol} · size a position →`}
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

        {/* total contracts — a shown value, not an input: it's driven entirely
            by your sizing in ① and updates live as risk/stop change (§5.2) */}
        <div className="rounded-lg bg-muted px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Total {units.sizeTitle.toLowerCase()}
            <InfoHint label={`Total ${units.sizeTitle.toLowerCase()}`}>
              How many {units.sizeTitle.toLowerCase()} the whole plan is built on. Set by your
              sizing in step ① — change risk or SL there and this updates.
            </InfoHint>
          </div>
          {C > 0 ? (
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-5xl font-bold tabular-nums">{units.size(C)}</span>
              <span className="text-sm text-muted-foreground">{units.sizeNoun(C)} · from ①</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground/80">size a position in ① →</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Take off @ (R)"
            value={ex.partialLevelStr}
            onChange={ex.setPartialLevel}
            suffix="R"
            placeholder="0.8"
            hint={
              <InfoHint label="Take off @ (R)">
                Where you take the partial profit, measured in R. 0.8R means closing at 80% of your
                stop distance in your favor.
              </InfoHint>
            }
          />
          <NumberField
            label="Target RR"
            value={ex.targetRRStr}
            onChange={ex.setTargetRR}
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

        <Stepper
          label={`${units.sizeTitle} off`}
          value={k}
          min={0}
          max={Math.max(0, C)}
          onChange={ex.setPartial}
          disabled={disabled}
          scale={units.stepScale}
          decimals={units.stepDecimals}
          derived={formatPct(result.partialFraction)}
          hint={
            <InfoHint label={`${units.sizeTitle} off`}>
              How many {units.sizeTitle.toLowerCase()} to close at the partial. The rest become your
              runner. The % is shown, not chosen — {units.hintSizeSplit}
            </InfoHint>
          }
        />

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
            checked={ex.stopToBreakeven}
            disabled={disabled}
            onCheckedChange={ex.setStopBE}
          />
        </div>

        {/* hero — the runner TP is why they opened the app (§5.2) */}
        <div className="rounded-lg bg-muted px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Runner TP
            <InfoHint label="Runner TP">
              Where to set the take-profit for your runner (in R) so the whole trade still hits your
              target RR after the partial. This is the number the app exists to find.
            </InfoHint>
          </div>
          {disabled ? (
            <p className="mt-1 text-sm text-muted-foreground/80">
              increase risk or tighten stop — nothing to plan
            </p>
          ) : result.hasRunner ? (
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-5xl font-bold text-brand tabular-nums">
                {formatR(result.runnerLevelR)}
              </span>
              {result.runnerTravelPoints > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {formatPrice(result.runnerTravelPoints)} {units.dist} travel
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 font-mono text-2xl">
              no runner — full exit at {formatR(Number(ex.partialLevelStr) || 0)}
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
                amount={result.blendedWinnerPnl}
                rDenominator={rDenom}
                format={units.money}
                tone="gain"
              />
            ) : null}
            <OutcomeRow
              label={ex.stopToBreakeven ? 'Partial + stall (BE)' : 'Partial + stall'}
              amount={result.partialThenStallPnl}
              rDenominator={rDenom}
              format={units.money}
              tone={result.partialThenStallPnl >= 0 ? 'neutral' : 'loss'}
            />
            <OutcomeRow
              label="Full stop"
              amount={result.fullLossPnl}
              rDenominator={rDenom}
              format={units.money}
              tone="loss"
            />
            {result.spreadCost > 0 ? (
              <p className="pt-1 pb-1 text-xs text-muted-foreground/80">
                Spread costs {units.money(result.spreadCost, { sign: false })} on this trade —
                already in every row above and in the runner TP.
              </p>
            ) : null}
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
            value={ex.entryStr}
            onChange={ex.setEntry}
            placeholder={units.entryPlaceholder}
          />
          <ToggleGroup
            type="single"
            value={ex.direction}
            onValueChange={(v) => v && ex.setDirection(v as Direction)}
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
            <span className="text-loss">Stop {units.price(prices.stop)}</span>
            <span className="text-warn">Partial {units.price(prices.partial)}</span>
            {result.hasRunner ? (
              <span className="text-gain">Runner {units.price(prices.runner)}</span>
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
