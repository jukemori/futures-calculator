'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardAction } from '@/components/ui/card';

/** Reset lives at the point of input, not in the app-chrome corner — and only
 *  appears once there's something to clear (§6.3). */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <CardAction>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="-my-1 cursor-pointer gap-1.5 text-xs text-muted-foreground"
      >
        <RotateCcw className="size-3.5" />
        Reset
      </Button>
    </CardAction>
  );
}
