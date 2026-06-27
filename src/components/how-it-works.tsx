'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  onClose: () => void;
};

const STEPS = [
  {
    n: '1',
    title: 'Size your position',
    body: 'Enter your contract, the dollars you’re risking, and your stop distance. You get whole contracts — micros can’t be split.',
  },
  {
    n: '2',
    title: 'Plan the exit',
    body: 'Take some contracts off early at a partial to bank profit, and let the rest — the “runner” — ride for a bigger move.',
  },
  {
    n: '3',
    title: 'Get the runner target',
    body: 'We solve where the runner’s take-profit goes so the whole trade still hits your target reward-to-risk — plus what each outcome really pays.',
  },
];

const GLOSSARY = [
  [
    'R',
    'Your risk unit — one stop’s distance. +1R means you made what you risked; −1R means you lost it.',
  ],
  ['Partial', 'Contracts you close early to lock in profit before the move is done.'],
  ['Runner', 'The contracts you leave on after the partial, aiming for a larger target.'],
  [
    'Runner TP',
    'The take-profit price/level for those runner contracts — the number this app solves for.',
  ],
] as const;

/** Plain-language explainer for first-timers. Dismissible (persisted) and
 *  re-openable from the header, so it never clutters the dense pro layout. */
export function HowItWorks({ onClose }: Props) {
  return (
    <section
      aria-label="How this app works"
      className="relative rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-4 sm:px-5"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Dismiss explainer"
        className="absolute top-2 right-2 size-7 text-muted-foreground"
      >
        <X className="size-4" />
      </Button>

      <h2 className="pr-8 text-sm font-semibold">New here? Here’s what this tool does</h2>

      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {s.n}
            </span>
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-xs">
        {GLOSSARY.map(([term, def]) => (
          <div key={term} className="flex max-w-md gap-1.5">
            <dt className="shrink-0 font-mono font-semibold text-foreground">{term}</dt>
            <dd className="text-muted-foreground">{def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
