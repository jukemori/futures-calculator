import { CardTitle } from '@/components/ui/card';

type Props = {
  n: number;
  children: React.ReactNode;
};

/** Numbered stage heading — the ① / ② chips that tie the two cards together. */
export function StepTitle({ n, children }: Props) {
  return (
    <CardTitle className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
      <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary">
        {n}
      </span>
      {children}
    </CardTitle>
  );
}
