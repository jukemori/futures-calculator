'use client';

import { useId } from 'react';
import { INSTRUMENTS, type InstrumentSymbol } from '@/lib/instruments';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  value: InstrumentSymbol;
  onChange: (symbol: InstrumentSymbol) => void;
};

export function InstrumentSelect({ value, onChange }: Props) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        Instrument
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as InstrumentSymbol)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INSTRUMENTS.map((i) => (
            <SelectItem key={i.symbol} value={i.symbol}>
              {i.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
