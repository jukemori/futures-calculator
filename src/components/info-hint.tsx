'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
  /** Term being explained — used for the accessible label. */
  label: string;
  children: React.ReactNode;
};

/** Small info icon that reveals a plain-language definition on hover/focus/tap.
 *  Keeps the dense layout clean while putting jargon one tap away for first-timers. */
export function InfoHint({ label, children }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is "${label}"?`}
          className="inline-grid place-items-center rounded-full text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
