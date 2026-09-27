import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a free-text numeric field, falling back when blank/invalid. */
export function numOr(s: string, fallback: number): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}
