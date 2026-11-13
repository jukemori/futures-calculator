'use client';

import type { SizingResult } from '@/lib/calc';
import type { ContractSymbol } from '@/lib/contracts';
import { formatUsd } from '@/lib/format';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ContractSelect } from './contract-select';
import { InfoHint } from './info-hint';
import { NumberField } from './number-field';
import { ResetButton } from './reset-button';
import { StepTitle } from './step-title';

type Props = {
  contractSymbol: ContractSymbol;
  riskStr: string;
  stopStr: string;
  /** Number of copy-trader accounts; blank = 1. */
  accountsStr: string;
  onContract: (s: ContractSymbol) => void;
  onRisk: (s: string) => void;
  onStop: (s: string) => void;
  onAccounts: (s: string) => void;
  result: SizingResult;
  /** Whether any input has been touched — gates the reset affordance. */
  isDirty: boolean;
  /** Reset this mode's inputs across both stages back to defaults. */
  onClear: () => void;
};

export function SizingCard({
  contractSymbol,
  riskStr,
  stopStr,
  accountsStr,
  onContract,
  onRisk,
  onStop,
  onAccounts,
  result,
  isDirty,
  onClear,
}: Props) {
  const { valid, dollarPerPoint, riskPerContract, contracts, exactContracts } = result;
  const leftover = exactContracts - contracts; // fractional contract you can't take
  const parsedAccounts = Number.parseInt(accountsStr, 10);
  const accounts = Number.isFinite(parsedAccounts) && parsedAccounts > 1 ? parsedAccounts : 1;

  return (
    <Card className="min-h-0 lg:overflow-y-auto">
      <CardHeader>
        <StepTitle n={1}>Size</StepTitle>
        {isDirty ? <ResetButton onClick={onClear} /> : null}
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
            label="SL from Entry"
            value={stopStr}
            onChange={onStop}
            suffix="pts"
            placeholder="18.5"
          />
          <NumberField
            label="Accounts"
            value={accountsStr}
            onChange={onAccounts}
            inputMode="numeric"
            placeholder="1"
            hint={
              <InfoHint label="Accounts">
                How many accounts your copy trader mirrors to (e.g. Apex accounts via Tradovate).
                Risk $ is per account; the total is what fills across all of them.
              </InfoHint>
            }
          />
        </div>

        {/* points-vs-ticks footgun, surfaced near the stop input, not at the bottom (§2) */}
        <p className="text-xs text-muted-foreground/80">
          Distance from entry to your stop-loss, in{' '}
          <span className="text-muted-foreground">points</span> (a full 1.00 move), not ticks.
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
                    {formatUsd(riskPerContract, { sign: false })}
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
              Enter a contract, risk $ and your SL distance from entry to size your position.
            </p>
          )}
          {valid && accounts > 1 ? (
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">
                × {accounts} accounts ·{' '}
                {formatUsd(contracts * riskPerContract * accounts, { sign: false })} total risk
              </span>
              <span>
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {contracts * accounts}
                </span>{' '}
                <span className="text-muted-foreground">total</span>
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
