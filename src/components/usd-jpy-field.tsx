'use client';

import { Pencil } from 'lucide-react';
import type { UsdJpy } from '@/hooks/use-usd-jpy';
import { Button } from '@/components/ui/button';
import { NumberField } from './number-field';

const STATUS: Record<UsdJpy['status'], string> = {
  live: 'live',
  loading: 'loading…',
  stale: 'stale — last known rate',
  manual: 'manual',
};

/** Live USD/JPY readout with its freshness, or the manual-override input
 *  (DESIGN-FOREX.md §4.6). */
export function UsdJpyField({ usdJpy }: { usdJpy: UsdJpy }) {
  const { live, status, useManual } = usdJpy;
  const updated = live
    ? new Date(live.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (useManual) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <NumberField
          label="USD/JPY (manual)"
          value={usdJpy.manualStr}
          onChange={usdJpy.setManualStr}
          placeholder={live ? live.rate.toFixed(2) : '150.00'}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 text-xs"
          onClick={() => usdJpy.setUseManual(false)}
        >
          Use live
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        USD/JPY{' '}
        <span className="font-mono font-medium text-foreground tabular-nums">
          {Number.isFinite(usdJpy.rate) ? usdJpy.rate.toFixed(2) : '—'}
        </span>{' '}
        <span
          className={`text-xs ${status === 'stale' ? 'text-warn' : 'text-muted-foreground/80'}`}
        >
          · {STATUS[status]}
          {updated && status !== 'loading' ? ` ${updated}` : ''}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={() => {
          // Start the override from the current rate rather than a blank field.
          if (usdJpy.manualStr === '' && Number.isFinite(usdJpy.rate)) {
            usdJpy.setManualStr(usdJpy.rate.toFixed(2));
          }
          usdJpy.setUseManual(true);
        }}
        aria-label="Enter USD/JPY manually"
        title="Enter USD/JPY manually"
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
