'use client';

import type { SizingResult } from '@/lib/calc';
import type { ContractSymbol } from '@/lib/contracts';
import { formatUsd } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContractSelect } from './contract-select';
import { NumberField } from './number-field';

type Props = {
  contractSymbol: ContractSymbol;
  riskStr: string;
  stopStr: string;
  onContract: (s: ContractSymbol) => void;
  onRisk: (s: string) => void;
  onStop: (s: string) => void;
  result: SizingResult;
};

export function SizingCard({
  contractSymbol,
  riskStr,
  stopStr,
  onContract,
  onRisk,
  onStop,
  result,
}: Props) {
  const { valid, dollarPerPoint, riskPerContract, contracts, exactContracts } = result;
  const leftover = exactContracts - contracts; // fractional contract you can't take

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary">
            1
          </span>
          Size
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <ContractSelect value={contractSymbol} onChange={onContract} />
          <NumberField
            label="Risk $"
            value={riskStr}
            onChange={onRisk}
            suffix="$"
            placeholder="1200"
          />
          <NumberField
            label="Stop Distance"
            value={stopStr}
            onChange={onStop}
            suffix="pts"
            placeholder="18.5"
          />
        </div>

        {/* points-vs-ticks footgun, surfaced near the stop input, not at the bottom (§2) */}
        <p className="text-xs text-muted-foreground/80">
          Stop is in <span className="text-muted-foreground">points</span> (a full 1.00 move), not
          ticks.
        </p>

        <div className="rounded-lg bg-muted px-4 py-3">
          {valid ? (
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tabular-nums">{contracts}</span>
                <span className="text-lg text-muted-foreground">contracts</span>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>
                  ${dollarPerPoint}/pt · R{' '}
                  <span className="font-semibold text-foreground">
                    {formatUsd(riskPerContract).replace('+', '')}
                  </span>
                </div>
                {leftover > 0.02 ? (
                  <div className="text-xs text-muted-foreground/80">
                    {exactContracts.toFixed(2)} exact — {leftover.toFixed(2)} on the table
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a contract, risk $ and stop distance to size your position.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
