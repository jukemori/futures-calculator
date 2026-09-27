'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type Mode = 'futures' | 'forex';

type Props = {
  value: Mode;
  onChange: (mode: Mode) => void;
};

/** Futures | Forex switch. Each mode keeps its own persisted inputs, so
 *  flipping back and forth loses nothing (DESIGN-FOREX.md §5.1). */
export function ModeToggle({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as Mode)}
      variant="outline"
      size="sm"
      aria-label="Market"
      className="h-9"
    >
      <ToggleGroupItem value="futures" className="h-9 px-3 text-xs">
        Futures
      </ToggleGroupItem>
      <ToggleGroupItem value="forex" className="h-9 px-3 text-xs">
        Forex
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
