# Futures Risk + Runner TP Calculator

A single-screen tool for discretionary futures traders — with a **Forex mode** for OANDA Japan CFDs
(XAUUSD, NAS100) sized in yen. Size a position by risk, then solve the one question a sizing
spreadsheet never answers:
<img width="1262" height="862" alt="image" src="https://github.com/user-attachments/assets/eee18029-2a29-4109-aaa9-31d327e4562e" />

> Given a partial taken at `a`R, where does the **runner take-profit** go to hold a target blended RR?

The whole app is one formula —

```
b = (T·C − k·a) / (C − k)        // runner TP, in R
```

— wrapped in honest outcome math and whole-contract reality for micros (MGC, MNQ, MES, …).
Everything is client-side, instant, and ships as static files. No backend, no order routing, and
no market quotes — the only live number is the USD/JPY rate in Forex mode.

## What it does

1. **Size** — pick a contract, enter risk `$` and a stop in points → how many whole contracts to trade
   (a faithful port of the risk-sizing spreadsheet, including its blank/zero guards).
2. **Exit plan** — split those contracts into a partial + runner with an **integer stepper** (you can't
   take 50% of 5 micros — the % is shown as _derived_ output, never chosen). Pick a target blended RR
   and get the exact runner TP in **R** and, optionally, in **price** for placing brackets.
3. **Honest breakdown** — what each plan actually pays: runner-hits, partial-then-stall (with a
   break-even toggle that flips the whole risk story), and full-stop — each in R and dollars.

### Forex mode (OANDA Japan)

A **Futures | Forex** toggle in the header switches instrument sets. Forex mode runs the same two
stages for **XAUUSD** and **NAS100** (OANDA's US100) on a yen account:

- **Yen everywhere** — risk input, R per lot, spread cost and every outcome are in `¥`. Chart
  prices (entry / stop / partial / runner) stay in USD, since that's what MT5 quotes.
- **Pips, OANDA's definition** — XAUUSD 1 pip = `$0.01`, NAS100 1 pip = `1.0`. The hint under the
  SL input shows the conversion (`500 pips = $5.00`).
- **Lots, not contracts** — floored to OANDA's lot step (0.01 for XAUUSD, 0.1 for NAS100).
- **Spread included** — entered in pips (remembered per instrument). It's added to the risk, and
  the runner TP moves out so the trade is still a true 1:1 _after_ the spread:
  `b = (T·C·(1 + σ) + C·σ − k·a) / (C − k)`, where `σ = spread / SL`. At `σ = 0` it's the futures
  formula, so both modes share one engine.
- **Live USD/JPY** — fetched on load and every 60 s (Coinbase, falling back to open.er-api.com).
  The last good rate is kept if a fetch fails, and you can override it manually.

Each mode keeps its own saved inputs, so switching back and forth loses nothing; **Reset** clears
only the active mode. Spreads at OANDA float — check the live one in MT5 (Ask − Bid) and adjust the
default once.

New to the jargon? A **How it works** button in the header opens a plain-language explainer (the
two-step flow + a mini glossary of _R_, _partial_, _runner_, _runner TP_), and small **ⓘ hints**
sit beside each Exit-plan field with an at-a-glance definition. Both stay out of the way — the
explainer is hidden by default and the hints only appear on hover/focus/tap — so the dense layout
is unchanged for repeat users.

See [`DESIGN.md`](./DESIGN.md) for the full rationale, formulas, and worked examples, and
[`DESIGN-FOREX.md`](./DESIGN-FOREX.md) for the Forex mode (OANDA specs, spread math, yen sizing).

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
  components/   sizing-card, fx-sizing-card, exit-card, mode-toggle, stepper, number-field,
                how-it-works (onboarding explainer), info-hint (ⓘ tooltip), …
                + ui/ (shadcn primitives, incl. tooltip)
  lib/          calc.ts (all math), contracts.ts (futures table), instruments.ts (OANDA table),
                fx-rate.ts (live USD/JPY), format.ts, storage.ts
```
