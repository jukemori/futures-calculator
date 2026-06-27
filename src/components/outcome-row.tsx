'use client';

import { formatR, formatUsd } from '@/lib/format';

type Tone = 'gain' | 'loss' | 'neutral';

const TONE: Record<Tone, string> = {
  gain: 'text-gain',
  loss: 'text-loss',
  neutral: 'text-warn',
};

type Props = {
  label: string;
  /** Outcome in dollars. R is derived from `rDenominator` (= C·R$). */
  usd: number;
  rDenominator: number;
  tone?: Tone;
};

/** One labeled gain/loss row: label … +0.4R  +$444, with semantic color. */
export function OutcomeRow({ label, usd, rDenominator, tone }: Props) {
  const r = rDenominator > 0 ? usd / rDenominator : NaN;
  const resolved: Tone = tone ?? (usd > 0 ? 'gain' : usd < 0 ? 'loss' : 'neutral');
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`flex items-baseline gap-3 font-mono ${TONE[resolved]}`}>
        <span className="text-sm tabular-nums">{formatR(r, { sign: true })}</span>
        <span className="w-24 text-right text-base font-medium tabular-nums">{formatUsd(usd)}</span>
      </span>
    </div>
  );
}
