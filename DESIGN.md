---
title: Futures Risk + Partial/Runner TP Calculator
status: Implemented — Phases 1–4 built (calc, exit engine, price levels, presets + localStorage)
type: Pure frontend (static SPA, no backend)
audience: Discretionary futures traders sizing micro contracts (MGC, MNQ, MES, MGC/GC, …)
owner: jukemori
stack: Next.js 16.2 · React 19.2 · React Compiler 1.0 · Tailwind v4 · shadcn/ui (Radix) · TypeScript 5 · Vitest 4.1 · Turbopack · pnpm
last_updated: 2026-06-27
---

# Futures Risk + Partial/Runner TP Calculator

> **TL;DR** — Port the risk-sizing spreadsheet into a single-screen web tool, then extend it
> with the one thing the sheet never answered: **given a partial taken at `a`R, where does the
> runner TP go to hold a target blended RR?** The whole app is one formula —
> `b = (T − p·a) / (1 − p)` — wrapped in honest outcome math and whole-contract reality for micros.
> Everything is client-side, instant, and deployable as static files.

---

## 0. Quick facts

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **One formula** | `b = (T − p·a) / (1 − p)` — runner TP in R                                                      |
| **Stages**      | ① Sizing (port of sheet) → ② Exit plan (the new part)                                           |
| **Runtime**     | 100% client-side. No server, no API routes, no live quotes.                                     |
| **Deploy**      | `output: 'export'` → static `out/` → Vercel / Netlify / GitHub Pages                            |
| **State**       | `useState` for ~10 inputs; **all** results derived during render (React Compiler auto-memoizes) |
| **Math home**   | `lib/calc.ts` — pure functions, zero React, table-tested                                        |
| **Non-goals**   | order routing, broker integration, live quotes, server persistence                              |

---

## 1. Goal

Take the existing spreadsheet (risk $ → whole contracts) and extend it into a single-screen tool
that also answers the question we kept circling: _given a partial taken at some R level, where does
the runner TP go to hold a target RR_ — with the whole-contract reality of micros baked in.

Two stages, one screen:

1. **Sizing** — risk $ + stop → how many contracts (this is your current sheet).
2. **Exit plan** — split those contracts into a partial + runner, pick a target blended RR, get the
   exact runner TP (in R _and_ in price), plus the honest "what this actually pays" breakdown.

**Non-goals:** order routing, broker integration, live quotes, persistence to a server. Everything
is local + instant.

---

## 2. Stage 1 — Sizing engine (port of the spreadsheet)

Exact logic from the workbook, no behavior change:

```text
dollarPerPoint  = lookup[contract]            // VLOOKUP equivalent
riskPerContract = stopPoints * dollarPerPoint
contracts       = floor(riskDollars / riskPerContract)
```

**Guards** (mirror the sheet's `IF`/`IFERROR`): any of `stopPoints`, `dollarPerPoint`,
`riskDollars` being blank or ≤ 0 → output is empty / `—`, **not** an error.

### Contract lookup table (source of truth — carry over verbatim)

| Contract | $/point | tickSize | $/tick | Note                                |
| -------- | ------- | -------- | ------ | ----------------------------------- |
| MGC      | 10      | 0.10     | 1      | 10 oz; $1 per 0.10 tick → $10/pt    |
| GC       | 100     | 0.10     | 10     | 100 oz; $10 per 0.10 tick → $100/pt |
| MNQ      | 2       | 0.25     | 0.50   | $2 × Nasdaq-100                     |
| NQ       | 20      | 0.25     | 5      | $20 × Nasdaq-100                    |
| SI       | 5000    | 0.005    | 25     | 5,000 oz                            |
| SIL      | 1000    | 0.005    | 5      | 1,000 oz                            |
| MC       | 10      | —        | —      |                                     |
| MCL      | 100     | —        | —      |                                     |

> **Why `tickSize` / `$tick` now, even if unused:** the "points vs ticks" footnote on your sheet is
> a real footgun. Adding the columns up front means a future **tick-mode toggle** is a UI change,
> not a data migration. Keep this in one `lib/contracts.ts` constant so adding MES / M2K later is a
> one-line edit.

> ⚠️ **Surface this near the stop input, not at the bottom:** points = a full `1.00` move. For metals
> a 1-pt move = `$1/oz × contract size`. If the user thinks in _ticks_, the output is wrong.

---

## 3. Stage 2 — Partial / Runner TP engine (the new part)

### 3.1 Definitions

| Symbol | Meaning                                                                |
| ------ | ---------------------------------------------------------------------- |
| `1R`   | the stop distance, by definition. `R$ = stopPoints × dollarPerPoint`   |
| `C`    | total contracts (from Stage 1, or user override)                       |
| `k`    | contracts taken off at the partial. Runner = `C − k`                   |
| `a`    | partial exit level in R (your case: `0.8`)                             |
| `b`    | runner TP level in R (**the unknown we solve for**)                    |
| `T`    | target blended RR (profit:risk). Default `1.0` for true 1:1            |
| `p`    | partial fraction = `k / C` (derived, never chosen directly — see §3.3) |

### 3.2 The core identity

A full winner pays, in R-multiples of total risk:

```text
winnerR = (k·a + (C − k)·b) / C
```

A full loss (stopped on the original stop) costs `1R`. Set `winnerR = T` and solve for the runner level:

```text
b = (T·C − k·a) / (C − k)          // contract form
b = (T − p·a) / (1 − p)            // fraction form
```

**This is the one formula the whole app is built around. Everything else is presentation.**

**Sanity checks** (`T = 1`, `a = 0.8`) — these become test fixtures (see §9):

| p (off at 0.8R) | b (runner TP) |
| --------------- | ------------- |
| 80%             | 1.8R          |
| 67%             | 1.4R          |
| 60%             | 1.3R          |
| 50%             | 1.2R          |
| 30%             | 1.09R         |

### 3.3 Whole-contract reality (the micro catch)

You can't take a literal 50% of 5 contracts. So `p` is **derived** from whole `k`, not chosen
directly. The UI lets the user pick `k` as an integer stepper (`0…C`), displays the resulting real
`p`, and recomputes `b`. Worked rows to reproduce (test fixtures):

| Total C | k off @0.8R | Runner | real p | b for T=1 |
| ------- | ----------- | ------ | ------ | --------- |
| 4       | 2           | 2      | 50%    | 1.2R      |
| 5       | 3           | 2      | 60%    | 1.3R      |
| 6       | 3           | 3      | 50%    | 1.2R      |
| 6       | 4           | 2      | 67%    | 1.4R      |

### 3.4 Honesty outputs (the differentiating feature)

Most calculators stop at "runner TP = 1.8R 🎉". The value here is showing what that _costs_. For the
current plan, compute and display:

- **Blended winner** — in R and in $ (equals `T` if the runner hits).
- **Partial-then-stall** — partial fills at `a`, then price reverses to stop:
  - _Original stop held:_ `k·a·R$ − (C−k)·R$` → usually negative or small.
  - _Stop → break-even after partial:_ `+k·a·R$` → can't lose.
  - This toggle changes the **entire risk profile** and must be a first-class switch, not a footnote.
- **Full loss** — `−C·R$` (original stop), or only realized in the BE case if price never reached the partial.
- **Travel required** — runner TP in price points = `b × stopPoints`. Flag when `b` is "far"
  (e.g. `> 1.5R`): on T1/T2 breakouts those extensions hit far less often, so a true-1:1 can be
  mostly theoretical. A subtle hit-rate caveat near the result — **not** a nag.

### 3.5 Price-level conversion (make it actionable)

If the user enters an **entry price** and **direction** (long/short), convert every R-level to a real
order price so they can place brackets directly:

```text
stopPrice    = entry ∓ stopPoints
partialPrice = entry ± a × stopPoints
runnerPrice  = entry ± b × stopPoints
   (long: + for targets / − for stop; short: reversed)
```

This is the step that turns a math toy into something used live.

---

## 4. Data model (TypeScript)

```ts
// lib/contracts.ts
export type Contract = {
  symbol: string;
  dollarPerPoint: number;
  tickSize?: number;
  note?: string;
};

// lib/calc.ts
export type SizingInput = {
  contractSymbol: string;
  riskDollars: number;
  stopPoints: number;
};

export type SizingResult = {
  dollarPerPoint: number;
  riskPerContract: number; // R$
  contracts: number; // floored
  exactContracts: number; // pre-floor → "you're leaving X on the table" hint
};

export type ExitInput = {
  totalContracts: number; // defaults to SizingResult.contracts, overridable
  partialContracts: number; // k
  partialLevelR: number; // a, default 0.8
  targetRR: number; // T, default 1.0
  stopToBreakeven: boolean;
  entryPrice?: number;
  direction?: 'long' | 'short';
};

export type ExitResult = {
  runnerLevelR: number; // b
  partialFraction: number; // p
  blendedWinnerR: number; // == T when consistent
  blendedWinnerUsd: number;
  partialThenStallUsd: number; // depends on stopToBreakeven
  fullLossUsd: number;
  runnerTravelPoints: number;
  prices?: { stop: number; partial: number; runner: number };
  warnings: string[]; // e.g. "runner > 1.5R, lower hit rate on breakouts"
};
```

All calc lives in pure functions: `computeSizing(input)` and `computeExit(input, dollarPerPoint)`.
No React, no side effects, trivially unit-testable. The §3.2 formula lives here **once**.

---

## 5. UI / UX

### 5.1 Layout — responsive: stacked on mobile, fit-on-screen on desktop

Two breakpoints, one component tree:

- **Mobile (`< lg`)** — single column, the two cards stacked and page-scrollable. Thumb-first.
- **Desktop (`≥ lg`)** — the cards sit **side by side** in a two-column grid sized to the viewport
  (`lg:h-dvh lg:overflow-hidden`), so the whole tool is visible at once with no page scroll. A card
  that can't fit a very short laptop scrolls _internally_ (`lg:overflow-y-auto`) rather than pushing
  the page. Sizing takes the narrower left column (`minmax(320px,380px)`), the taller exit plan the rest.

A compact header spans the top on both: title + formula on the left, **Clear** and the **theme
toggle** on the right.

```text
DESKTOP (≥ lg) — everything on one screen
┌── Futures Risk + Runner TP ───────────────── [Clear] [◐] ──┐
│ ┌─ ① SIZE ───────────────┐ ┌─ ② EXIT PLAN ── MGC·$10/pt·R$185 ┐ │
│ │ Contract  Risk $       │ │ [50%@0.8R][60%@0.8R][Runner only] │ │
│ │ Stop (pts)             │ │ Total·from① [6]   Take off [0.8]R │ │
│ │ ── 6 contracts ──      │ │ [− 3 +] = 50%     Target [1.0]R   │ │
│ │   $10/pt · R $185      │ │ Stop→BE [ off ]                   │ │
│ └────────────────────────┘ │ Runner TP  1.2R   22.2 pts travel │ │
│                            │ If runner hits  +1.0R  +$1,110    │ │
│                            │ Partial+stall   +0.4R  +$444      │ │
│                            │ Full stop       −1.0R  −$1,110    │ │
│                            └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

MOBILE (< lg) — the same two cards, stacked
```

┌─────────────────────────────────────────┐
│ ① SIZE │
│ Contract [MGC ▾] Risk $ [____] │
│ Stop (pts) [____] │
│ ───────────────────────────────────── │
│ → 6 contracts ($/pt 10 · R $185) │ ← big, glanceable result
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ② EXIT PLAN │
│ Total cons [6] (from sizing) │
│ Take off @ [0.8]R → [− 3 +] contracts │ ← integer stepper
│ Target RR [1.0] Stop→BE [ off ] │
│ ───────────────────────────────────── │
│ Runner TP → 1.2R │ ← the answer, largest element
│ Real partial: 50% │
│ │
│ If runner hits: +1.00R (+$1,110) │
│ Partial + stall: +0.40R (+$444) │
│ Full stop: −1.00R (−$1,110) │
└─────────────────────────────────────────┘

````

Optional third row, shown only when `entryPrice` is filled:

```text
  Entry [4185.0]  Long ▾   →   Stop 4166.5 · Partial 4196.6 · Runner 4207.2
````

### 5.2 Interaction principles (trader-specific)

- **Everything live.** No submit button. Every keystroke / stepper recomputes during render
  (React Compiler auto-memoizes — §6.2). Traders bounce between fields while reading the chart.
- **Exit plan tracks Stage 1 automatically.** The exit card is a pure function of the sizing context:
  selecting a contract (→ $/pt → R$), or editing risk/stop (→ contract count), flows straight through
  to the runner TP and every dollar outcome. The link is made visible — the exit header echoes
  `MGC · $10/pt · R $185`, and the total-contracts field is labelled **"from ①"** while it follows
  the sized count (override it to decouple).
- **Clear button.** One tap resets every input to defaults (contract → MGC, risk/stop/entry blank,
  partial `k → 0`, `a → 0.8`, `T → 1.0`, BE off). Disabled when there's nothing to clear. The theme
  choice is intentionally _not_ reset.
- **Integer stepper for `k`, not a % slider.** You can't take 50% of 5 micros — the slider lies.
  The stepper enforces whole contracts; the resulting % is _shown_ as derived output. **This is the
  single most important UX decision** and the thing every generic calculator gets wrong.
- **The runner TP is the hero number.** Biggest type on the screen — it's why they opened the app.
- **Honest breakdown is visible by default**, not behind a "details" expander. The whole point: 80%/1.8R
  is technically 1:1 but rarely fills; hiding the stall outcome reproduces the exact illusion you were
  escaping.
- **Break-even toggle is prominent.** It flips the entire risk story (stall goes from a loss to a
  locked gain). Two visibly different result states.
- **Responsive, not just mobile.** Thumb-reachable steppers and large tap targets on a phone; on a
  laptop the whole tool fits one screen (§5.1) so you never scroll while sizing next to a chart.
- **Presets.** One-tap chips for your real habits: `50% @ 0.8R`, `60% @ 0.8R`, `Runner only`. Each sets
  `a`, `k`, `T` in one tap.
- **Onboarding without clutter.** The tool is dense on purpose, but the jargon (R, partial, runner,
  runner TP) is opaque to a first-timer. Two opt-in layers carry the mental model without taxing the
  daily user:
  - **"How it works" explainer** (`HowItWorks`) — a dismissible panel with the two-step flow in plain
    English plus a mini glossary. **Hidden by default**, opened from a header **How it works** button;
    the open/closed choice persists (`help` key, §6.3) so it never reappears uninvited.
  - **Inline ⓘ hints** (`InfoHint`, a shadcn `Tooltip`) beside the jargon-bearing labels — _Take off @
    (R)_, _Contracts off_, _Target RR_, the _Runner TP_ hero, _Stop → break-even_, and the outcome
    breakdown. Definitions are one hover/focus/tap away and add zero permanent height. `NumberField` and
    `Stepper` take an optional `hint` slot rendered next to the label.
  - Empty/disabled states read as guidance, not errors: the unsized result panel says
    _"Enter a contract, risk \$ and stop distance to size your position."_ rather than a bare `—`.

### 5.3 Visual direction & component system

- **Built on [shadcn/ui](https://ui.shadcn.com).** Every control is a real shadcn primitive —
  `Card`, `Input`, `Label`, `Select`, `Switch`, `ToggleGroup`, `Button` — copied into
  `src/components/ui/` (Radix-primitive base, `radix-nova` style) and composed by the app's own
  `SizingCard` / `ExitCard` / `NumberField` / `Stepper`. We get accessible focus management, keyboard
  nav, and the outlined-input styling for free, and own the source so it stays customizable.
  - `lib/utils.ts` `cn()` (clsx + tailwind-merge) merges classes; variants come from
    `class-variance-authority` inside each primitive.
- **Light theme default**, dark via a one-tap toggle (a shadcn `Button` icon). shadcn's CSS-variable
  token system carries the theme: `--background/--card/--primary/--muted/--border/--input/--ring` etc.
  in `:root`, overridden under `.dark`. The choice **persists** (§6.3); a tiny inline script in
  `layout.tsx` applies it **before first paint** to avoid a flash under static export.
- **Custom palette (re-skinned shadcn tokens).** Indigo brand · Slate neutrals · Emerald / Red / Amber
  semantics, as Tailwind v4 **oklch** values. App-specific tokens `--gain / --loss / --warn / --brand`
  are layered on top of the shadcn set for the outcome rows and the hero number. Every text/background
  pair is verified ≥ 4.5:1 (≥ 3:1 for the large hero & solid buttons) — the hero clears ~5.7:1 light /
  ~4.9:1 dark.
- **Outlined inputs, not filled.** shadcn `Input`/`SelectTrigger` are transparent + 1px `--input`
  border + a `--ring` focus ring — the modern convention (and what Material recommends when many
  fields sit together). The earlier heavy gray fill is gone; the border + focus ring carry the
  affordance. Secondary buttons (Clear, theme, presets, side) use the `outline`/`ghost` variants —
  clean at rest, a `muted` wash on hover.
- **Gray (`muted`) is reserved for _output_.** The two result panels (sized contracts, hero runner-TP)
  sit on `bg-muted`; inputs are clean. That input-clean / output-tinted split is the hierarchy.
- **Consistent sizing.** 40px control height across inputs/steppers/selects/toggles, shadcn radii
  (`--radius: 0.65rem`), section numbers as small `primary/10` chips, sentence-case field labels
  (uppercase reserved for the ①/② section headers).
- **Tabular figures everywhere** — `font-variant-numeric: tabular-nums` so digits don't jitter on update.
- **Refined, not marketing-y** — information-dense like a trading terminal but with the clean control
  styling of a modern product UI. shadcn `Card` provides the subtle ring + radius; the indigo hero is
  the one loud element.

---

## 6. Tech stack & architecture (verified, 2026-06)

Versions below are pinned from the scaffolded `package.json` — not aspirational.

| Layer           | Choice               | Version                         | Why                                                                                     |
| --------------- | -------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router) | **16.2.9**                      | Static export, file routing, batteries included                                         |
| UI runtime      | React + React-DOM    | **19.2.4**                      | Latest stable; render-time derivation + `useId` (see §6.2)                              |
| Memoization     | React Compiler       | **1.0** (`reactCompiler: true`) | Auto-memoization; replaces hand-written `useMemo`/`useCallback`                         |
| Styling         | Tailwind CSS         | **v4** (`@tailwindcss/postcss`) | CSS-first config, `@theme` tokens, no `tailwind.config.js` needed                       |
| Components      | shadcn/ui (Radix)    | `radix-nova`                    | Accessible primitives copied into `components/ui/`; `cn()` + `class-variance-authority` |
| Language        | TypeScript           | **5.x**                         | Pure-function calc is trivially typed                                                   |
| Lint            | ESLint               | **9** (`eslint-config-next`)    | Flat config                                                                             |
| Bundler         | Turbopack            | (Next 16 default)               | Fast dev/build                                                                          |
| Tests           | Vitest               | **4.1**                         | Vite-native, `test.each` table tests (see §9)                                           |
| Package manager | pnpm                 | **10.30**                       | Fast, disk-efficient; `packageManager` field pins the version                           |

### 6.1 Static export

It's pure frontend, so it ships as static files — no Node server at runtime.

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // → static `out/` of HTML/CSS/JS; deploy anywhere
};

export default nextConfig;
```

`'use client'` components are **fully supported** under static export in the App Router — the entire
interactive calculator renders client-side from the static bundle. There are **no** API routes; the
calc never leaves the browser.

### 6.2 State & hooks (React 19 + React Compiler)

The whole app state is ~10 fields — plain `useState`, no Redux/Zustand.

- **Derive, never store.** `SizingResult` and `ExitResult` are computed straight from the input state
  during render. Computed values are _never_ held in `useState`.

  ```tsx
  const sizing = computeSizing(sizingInput);
  const exit = computeExit(exitInput, { dollarPerPoint: sizing.dollarPerPoint, stopPoints });
  ```

- **No manual `useMemo`/`useCallback`.** With the **React Compiler** enabled (`reactCompiler: true`,
  stable in Next 16 / React Compiler 1.0), memoization is automatic and analysis-driven — the
  compiler memoizes these pure derivations as precisely as hand-written `useMemo`, and in places
  `useMemo` can't reach (e.g. after an early return). Per the official React guidance, **new code
  should rely on the compiler** and reach for `useMemo`/`useCallback` only as a deliberate escape
  hatch (e.g. to stabilize an effect dependency). This app needs no such escape hatch.
  - Verify it's actually transforming: the production bundle contains `react-compiler-runtime`
    (`useMemoCache` / `_c(n)` call sites) — grep the `.next/static/chunks` to confirm.

- **`useId` for a11y.** Pair every input with its `<label htmlFor>` using `useId()` so steppers and
  fields stay accessible and SSR/CSR-stable under static export.
- **No effects for derivation.** No `useEffect` to "sync" results — derivation is render-time and pure.

### 6.3 Persistence

Everything worth remembering between sessions persists: all ~10 inputs, the theme choice, **and** the
"how it works" panel's dismissed state (`help`) — the trader reopens exactly where they left off, and
the explainer never reappears once dismissed.

- One `usePersistentState(field, default)` hook backs every value, stored under a single JSON key
  (`futures-calculator:v1`).
- Implemented with **`useSyncExternalStore`** (subscribe to `storage` + a same-tab event, `getSnapshot`
  from `localStorage` with a cached parse for referential stability, `getServerSnapshot` → defaults).
  This avoids the hydration-mismatch trap of reading `localStorage` during render in an exported app.
- **Theme has a second read path:** the no-flash inline script (§5.3) reads the same key before paint;
  the hook then keeps `<html>.dark` in sync. Default is light, so SSR and first paint always agree.
- **Clear** resets the input fields to defaults but deliberately leaves the persisted theme alone.
- **Claude.ai artifacts can't use `localStorage`.** Writes are wrapped in `try/catch`, so there it
  silently degrades to in-memory state — no other code changes.

### 6.4 Suggested structure

```text
src/
  app/
    layout.tsx            // fonts, tabular-nums base, no-flash theme script
    globals.css           // shadcn token system, re-skinned (indigo/slate/emerald oklch)
    page.tsx              // composition + state + clear; wires cards together
  components/
    ui/                   // shadcn primitives (copied in): button, input, label,
                          //   select, card, switch, toggle-group, badge, tooltip
    SizingCard.tsx        // composes ui/* into Stage 1
    ExitCard.tsx          // presets, stepper, BE switch, hero, breakdown, prices
    OutcomeRow.tsx        // one labeled gain/loss row, semantic color
    ContractSelect.tsx    // wraps ui/select
    Stepper.tsx           // ui/button + ui/input integer stepper for k (optional hint slot)
    NumberField.tsx       // ui/label + ui/input (optional hint slot)
    HowItWorks.tsx        // dismissible first-timer explainer (flow + glossary), header-toggled
    InfoHint.tsx          // ⓘ icon + ui/tooltip — inline definition for a jargon label
    ThemeToggle.tsx       // light/dark, persisted
  lib/
    calc.ts               // computeSizing, computeExit — ALL math here
    contracts.ts          // the lookup table (source of truth) + ContractSymbol
    format.ts             // $/R/%/price display helpers
    storage.ts            // useSyncExternalStore-backed localStorage hook
    utils.ts              // shadcn cn() — clsx + tailwind-merge
    calc.test.ts          // Vitest table tests against §3.2 / §3.3
```

---

## 7. Validation & edge cases

| Case                                      | Behavior                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `C = 0` (risk too small for one contract) | Both cards render; Exit card disabled with hint **"increase risk or tighten stop"** — never a blank/error                       |
| `k = C` (no runner, `1 − p = 0`)          | Detect before dividing by zero → **"no runner — full position exits at {a}R"**                                                  |
| `k = 0` (no partial)                      | `b = T`; degenerates to "100% at target" — the highest-EV true-1:1 if you trust the entry. Show as **valid, even recommended**  |
| `a ≥ T` _with_ a partial                  | `b` comes out below `a` (runner would target _less_ than the partial) — nonsensical; **flag it**                                |
| Break-even ON                             | "Full loss" only at `−1R` if price never reached the partial; once the partial fills, worst case is the **locked partial gain** |
| Blank / ≤ 0 inputs                        | Sizing outputs `—` (mirrors sheet `IFERROR`)                                                                                    |
| `k` out of range                          | Clamp to `0…C`                                                                                                                  |

---

## 8. Build phases

| Phase                | Scope                                                  | Definition of done                                           |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| **1 — Sizing**       | Port the sheet: contract lookup + live contract count  | Ship-able alone; already beats the xlsx                      |
| **2 — Exit engine**  | Partial/runner calc + honest breakdown (§3.2–3.4)      | `computeExit` passes all §3.2/§3.3 fixtures; outcomes render |
| **3 — Price levels** | Entry + direction → order prices (§3.5)                | Bracket prices match hand calc for long & short              |
| **4 — Polish**       | Presets, `localStorage`, tick-mode toggle, mobile pass | Reopens with last inputs; usable one-thumbed next to a chart |

---

## 9. Testing

`lib/calc.ts` is pure, so the verified tables in §3.2 / §3.3 _are_ the test suite. Use **Vitest 4.1**
`test.each` for table-driven fixtures:

```ts
// lib/calc.test.ts
import { describe, expect, test } from 'vitest';
import { computeExit } from './calc';

describe('computeExit — runner TP b = (T − p·a)/(1 − p)', () => {
  // §3.3 whole-contract fixtures: [C, k, a, T, expectedB]
  test.each([
    { C: 4, k: 2, a: 0.8, T: 1, b: 1.2 },
    { C: 5, k: 3, a: 0.8, T: 1, b: 1.3 },
    { C: 6, k: 3, a: 0.8, T: 1, b: 1.2 },
    { C: 6, k: 4, a: 0.8, T: 1, b: 1.4 },
  ])('C=$C k=$k a=$a T=$T → b=$b', ({ C, k, a, T, b }) => {
    const res = computeExit(
      {
        totalContracts: C,
        partialContracts: k,
        partialLevelR: a,
        targetRR: T,
        stopToBreakeven: false,
      },
      /* dollarPerPoint */ 10,
    );
    expect(res.runnerLevelR).toBeCloseTo(b, 2);
  });

  test('k = C → no runner, no divide-by-zero', () => {
    const res = computeExit(
      {
        totalContracts: 5,
        partialContracts: 5,
        partialLevelR: 0.8,
        targetRR: 1,
        stopToBreakeven: false,
      },
      10,
    );
    expect(Number.isFinite(res.runnerLevelR)).toBe(false);
    expect(res.warnings.join(' ')).toMatch(/no runner/i);
  });
});
```

Run: `pnpm vitest run` (CI) / `pnpm vitest` (watch).

> Coverage target: 100% of `lib/calc.ts` branches — it's tiny and it's the whole product. UI is thin
> presentation over these functions and needs only smoke tests.

---

## 10. Decisions & rationale

| Decision                                   | Why                                                                                                     | Alternative rejected                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Static export (`output: 'export'`)         | No server needed; deploy anywhere free                                                                  | Server runtime — pointless for client-only math                                                    |
| Render-time derivation + React Compiler    | Results are pure functions of inputs; compiler auto-memoizes more precisely than hand-written `useMemo` | manual `useMemo` everywhere — now redundant boilerplate; `useEffect`+`useState` — stale-state bugs |
| Integer stepper for `k`, % shown as output | Micros are whole contracts; a % slider lies                                                             | % slider — reproduces the bug we're fixing                                                         |
| One `lib/calc.ts` for all math             | Single source of truth, table-testable                                                                  | Math scattered in components — untestable                                                          |
| Honest breakdown visible by default        | The differentiator; hiding it recreates the 1.8R illusion                                               | "Details" expander — defeats the purpose                                                           |
| Tailwind v4 CSS-first                      | No `tailwind.config.js`; tokens in `@theme`                                                             | v3 JS config — heavier, legacy                                                                     |
| shadcn/ui primitives, owned source         | Accessible Radix-based controls, no black-box dep; re-skin tokens freely                                | hand-rolled inputs — re-derive a11y/focus; a heavyweight component lib — less control              |

---

## Appendix — the formula, once more, plainly

> **Runner TP (in R) = (Target_RR × Total − Partial_contracts × Partial_level) ÷ Runner_contracts**

or with a fraction:

> **`b = (T − p·a) / (1 − p)`**

Default it to `T = 1`, `a = 0.8`, and let the trader move `k`. That single line is the whole reason
the app exists.
