'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Derived percentage to show as output (you can't pick a % of whole micros). */
  derived?: string;
  disabled?: boolean;
  /** Optional info hint rendered next to the label (e.g. an <InfoHint />). */
  hint?: React.ReactNode;
};

/** Integer stepper for `k` — enforces whole contracts; the resulting % is shown
 *  as derived output, never chosen directly (DESIGN.md §3.3 / §5.2). */
export function Stepper({ label, value, min, max, onChange, derived, disabled, hint }: Props) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
        {hint}
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="decrease"
          className="size-10 text-xl"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          −
        </Button>
        <Input
          id={id}
          inputMode="numeric"
          value={disabled ? '—' : value}
          disabled={disabled}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isNaN(n) ? min : clamp(n));
          }}
          className="h-10 w-14 text-center text-lg"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="increase"
          className="size-10 text-xl"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </Button>
        {derived && !disabled ? (
          <span className="ml-1 text-sm text-muted-foreground">
            = <span className="font-medium text-foreground">{derived}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
