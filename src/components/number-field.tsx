'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  step?: string;
};

/** Labeled free-text numeric input (shadcn Input + Label). Stored as a string
 *  so the field can be blank (→ calc renders "—"); the calc layer parses/guards. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  inputMode = 'decimal',
  step,
}: Props) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode={inputMode}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? 'h-10 pr-9' : 'h-10'}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
