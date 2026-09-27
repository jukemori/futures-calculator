// One-tap exit presets for the trader's real habits (DESIGN.md §5.2). Each sets
// a (partial level), T (target RR) and k (as a fraction of C) in one tap.

export type Preset = { label: string; a: number; fraction: number; t: number };

export const PRESETS = [
  { label: '50% @ 0.8R', a: 0.8, fraction: 0.5, t: 1 },
  { label: '80% @ 0.8R', a: 0.8, fraction: 0.8, t: 1 },
  { label: 'Runner only', a: 0.8, fraction: 0, t: 1 },
] as const satisfies readonly Preset[];
