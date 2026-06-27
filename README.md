# Futures Risk + Runner TP Calculator

A single-screen tool for discretionary futures traders. Size a position by dollar risk, then solve
the one question a sizing spreadsheet never answers:
<img width="1262" height="862" alt="image" src="https://github.com/user-attachments/assets/eee18029-2a29-4109-aaa9-31d327e4562e" />


> Given a partial taken at `a`R, where does the **runner take-profit** go to hold a target blended RR?

The whole app is one formula —

```
b = (T·C − k·a) / (C − k)        // runner TP, in R
```

— wrapped in honest outcome math and whole-contract reality for micros (MGC, MNQ, MES, …).
Everything is client-side, instant, and ships as static files. No backend, no quotes, no order routing.

## What it does

1. **Size** — pick a contract, enter risk `$` and a stop in points → how many whole contracts to trade
   (a faithful port of the risk-sizing spreadsheet, including its blank/zero guards).
2. **Exit plan** — split those contracts into a partial + runner with an **integer stepper** (you can't
   take 50% of 5 micros — the % is shown as _derived_ output, never chosen). Pick a target blended RR
   and get the exact runner TP in **R** and, optionally, in **price** for placing brackets.
3. **Honest breakdown** — what each plan actually pays: runner-hits, partial-then-stall (with a
   break-even toggle that flips the whole risk story), and full-stop — each in R and dollars.

See [`DESIGN.md`](./DESIGN.md) for the full rationale, formulas, and worked examples.

## Tech stack

- **Next.js 16** (App Router, static export via `output: 'export'`) + **React 19**
- **React Compiler** for auto-memoization (no hand-written `useMemo`/`useCallback`)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) — light/dark themed via CSS variables
- **TypeScript**, **Vitest** for the table-driven calc tests
- **pnpm** as the package manager

All math lives in `src/lib/calc.ts` as pure functions, so the verified tables in the design doc
_are_ the test suite.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Dev server (Turbopack) at http://localhost:3000 |
| `pnpm build`        | Production build → static `out/`                |
| `pnpm start`        | Serve a production build                        |
| `pnpm test`         | Run the Vitest suite once                       |
| `pnpm test:watch`   | Vitest in watch mode                            |
| `pnpm lint`         | ESLint                                          |
| `pnpm format`       | Format the codebase with Prettier               |
| `pnpm format:check` | Check formatting without writing                |

## Deploy

`pnpm build` emits a fully static `out/` directory (HTML/CSS/JS) — host it on any static host
(Vercel, Netlify, GitHub Pages, S3, …). There are no API routes or server runtime.

## Project structure

```
src/
  app/          layout, globals.css (theme tokens), page.tsx (composition + state)
  components/   sizing-card, exit-card, stepper, number-field, … + ui/ (shadcn primitives)
  lib/          calc.ts (all math), contracts.ts (lookup table), format.ts, storage.ts
```
