'use client';

import { useId } from 'react';
import { CONTRACTS, type ContractSymbol } from '@/lib/contracts';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  value: ContractSymbol;
  onChange: (symbol: ContractSymbol) => void;
};

export function ContractSelect({ value, onChange }: Props) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        Contract
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as ContractSymbol)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTRACTS.map((c) => (
            <SelectItem key={c.symbol} value={c.symbol}>
              {c.symbol} · ${c.dollarPerPoint}/pt
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
