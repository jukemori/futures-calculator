---
title: Forex (CFD) mode — OANDA Japan NAS100 / XAUUSD
status: Implemented 2026-09-27
type: Extension of DESIGN.md (same app, same two stages, second instrument set)
audience: Traders sizing OANDA Japan CFDs (US100 / XAUUSD) with a yen-denominated account
owner: jukemori
last_updated: 2026-09-27
---

# Forex (CFD) mode — OANDA Japan NAS100 / XAUUSD

> **TL;DR** — Add a **Futures | Forex** toggle to the header. Forex mode runs the _same_ two
> stages (① size → ② runner TP) against OANDA Japan's US100 and XAUUSD CFDs, with three
> differences: the account currency is **yen**, position size is **fractional lots** (not whole
> contracts), and the **spread** is a real per-trade cost that sizing and the runner TP must
> absorb. The core formula `b = (T − p·a) / (1 − p)` survives — it just gains a spread term.

---

## 0. Quick facts

|                   | Futures (today)                                                                         | Forex (new)                                         |
| ----------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Instruments**   | MGC, GC, MNQ, NQ                                                                        | NAS100 (OANDA "US100"), XAUUSD                      |
| **Account ccy**   | USD                                                                                     | **JPY** — risk input and every $ output are ¥       |
| **Size unit**     | whole contracts                                                                         | lots, floored to the instrument's lot step          |
| **SL distance**   | pts                                                                                     | **pips** (OANDA's pip size: US100 1.0, XAUUSD 0.01) |
| **Spread**        | ignored (futures: ~1 tick)                                                              | input in pips, **added to risk**, solved into TP    |
| **FX conversion** | —                                                                                       | **live** `USD/JPY` fetched on load, manual override |
| **Math home**     | `lib/calc.ts`                                                                           | same file, generalized — no parallel engine         |
| **Non-goals**     | no instrument quotes, no broker integration, no server — USD/JPY is the one live number |                                                     |

---

## 1. Goal

Same question as futures — _risk X, stop Y → how big, and where does the runner go to hold T?_ —
answered for the two OANDA Japan CFDs the trader actually uses, in the currency the account is
actually in. A calculator that says "risk $1,200" to a yen account forces a mental FX conversion
at exactly the moment you shouldn't be doing arithmetic.

---

## 2. Instrument table (OANDA Japan — source of truth)

Researched 2026-09-27 from oanda.jp lineup pages. **Verify against the MT5 symbol spec before
trusting a live trade** — OANDA changes lot minimums occasionally (US100's minimum was cut from
1 → 0.1 lot on 2021-05-31).

| Instrument | OANDA name | 1 lot       | Quote | USD per 1.00 move / lot | Min lot | Lot step | Price precision | Max / order | Ref. spread\*     |
| ---------- | ---------- | ----------- | ----- | ----------------------- | ------- | -------- | --------------- | ----------- | ----------------- |
| XAUUSD     | XAU/USD    | 100 troy oz | USD   | **$100**                | 0.01    | 0.01     | 0.001           | 20 lots     | ~70 pips (≈$0.70) |
| NAS100     | US100      | 1 × index   | USD   | **$1**                  | 0.1     | 0.1      | 0.1             | 1,000 lots  | ~2.3 pips         |

\* Spreads at OANDA Japan are **variable** for index/commodity CFDs (not "原則固定"), so the
reference value is only a pre-filled default; the input is editable and persisted (§3.3).
Account: **standard course, MT5** (東京サーバー). Third-party reports for XAUUSD disagree (≈$0.57–
$0.70), so the trader should read the live spread off MT5 and adjust the default once.

Cross-check (NAS100): OANDA's margin example is `30,672 × 0.1 lot × 157 USD/JPY × 10% = ¥48,155`
→ 1 lot = 1 × index in USD, i.e. **$1 per point per lot**. XAUUSD: 100 oz × $1 = **$100 per $1
move per lot**.

### 2.1 Pip definitions (OANDA's own — confirmed)

From OANDA Lab's pip reference: **US100 is in the "1 pip = 1" group** (with US30, US500, JP225…)
and **XAUUSD is in the "1 pip = 0.01" group** (with USOIL, UKOIL…). The app uses exactly these so
pip counts match OANDA's web tools and the trader's MT5 habit:

| Instrument | 1 pip  | USD / pip / lot | ¥ / pip at min lot (USD/JPY 150) |
| ---------- | ------ | --------------- | -------------------------------- |
| NAS100     | 1.0 pt | $1              | 0.1 lot → ¥15                    |
| XAUUSD     | $0.01  | $1              | 0.01 lot → ¥1.5                  |

Note XAUUSD pips are _small_: a $5 gold stop is **500 pips**. The hint under the SL input
prints the conversion live (`500 pips = $5.00`) so a 50-vs-500 slip is obvious.

Stored as `pipSize` in the table so changing the convention is a one-line edit.

---

## 3. Stage 1 — Sizing (forex variant)

### 3.1 Formula

```text
usdPerPipPerLot = usdPerPointPerLot × pipSize
effStopPips     = slPips + spreadPips               // you pay the spread on the way in
riskPerLotYen   = effStopPips × usdPerPipPerLot × usdJpy
exactLots       = riskYen / riskPerLotYen
lots            = floor(exactLots / lotStep) × lotStep   // floor — never exceed risk
```

**Guards** — identical to futures: any of `riskYen`, `slPips`, `usdJpy` blank or ≤ 0 → `—`, not
an error. `spreadPips` blank → treated as 0 (with a hint), negative → invalid. `lots < minLot` →
"0 lots — increase risk or tighten SL" (same message as futures C = 0).

### 3.2 Worked example (becomes a test fixture)

XAUUSD, risk ¥30,000, SL 500 pips (= $5.00), spread 70 pips ($0.70), USD/JPY 150:

```text
usdPerPipPerLot = 100 × 0.01         = $1
effStopPips     = 500 + 70           = 570
riskPerLotYen   = 570 × 1 × 150      = ¥85,500
exactLots       = 30,000 / 85,500    = 0.3508…
lots            = floor(35.08) × 0.01 = 0.35 lots   (actual risk ¥29,925)
```

### 3.3 Why the spread is inside the risk, not a footnote

Long entry fills at the **ask**; the stop and TP trigger on the **bid** (chart price). So a
500-pip stop actually loses `500 + spread` pips. Ignoring it means every full loss is bigger than
the number you chose — on XAUUSD with a tight 200-pip ($2) stop, a 70-pip spread is **+35% risk**.
The sizing card shows it explicitly: `R ¥85,500 (SL 500 + spread 70 pips)`.

---

## 4. Stage 2 — Exit plan with spread

### 4.1 Definitions (additions to DESIGN.md §3.1)

| Symbol | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| `R`    | still the **chart** SL distance (`slPips`) — so `a`, `b` are chart levels |
| `σ`    | spread as a fraction of the SL: `spreadPips / slPips`                     |
| `C, k` | total / partial size in **lot steps** (integers — see §4.3)               |

Every leg pays the spread once, so per lot-step:

```text
full loss   = −(1 + σ)·R
partial     =  (a − σ)·R
runner      =  (b − σ)·R
```

### 4.2 Spread-aware runner TP

Set the net blended winner equal to `T` × the **net** risk (`(1 + σ)·C·R`) and solve for `b`:

```text
k·(a − σ) + (C − k)·(b − σ) = T·C·(1 + σ)

b = (T·C·(1 + σ) + C·σ − k·a) / (C − k)          // contract form
b = (T·(1 + σ) + σ − p·a) / (1 − p)              // fraction form
```

With `σ = 0` this is exactly the futures formula, so **one `computeExit` serves both modes** —
futures passes `σ = 0`. Worked check (`T = 1`, `a = 0.8`, `p = 0.5`, `σ = 0.14` from §3.2):
`b = (1.14 + 0.14 − 0.4) / 0.5 = 1.76R` vs 1.2R ignoring spread. That gap _is_ the feature —
the spread quietly turns a "1:1" plan into ~0.8:1 unless the runner goes further.

### 4.3 Fractional-lot reality

Futures has "you can't take 50% of 5 contracts"; forex has the same problem at a finer grain.
Internally everything is integer **lot steps** (`C = lots / lotStep`), so the existing integer
`k` stepper, `p = k / C`, and all tests keep working. The UI displays `k × lotStep` as lots
(e.g. stepper shows `0.18 lots`, step 0.01 for XAUUSD, 0.1 for NAS100).

### 4.4 Outcomes (in ¥)

Same three honest rows as futures — blended winner, partial-then-stall (BE on/off), full stop —
multiplied by `usdPerPipPerLot × lotStep × usdJpy` and **net of spread**. Breakeven stop on the
runner is "entry price", so a BE stall still loses the runner's spread: shown, not hidden.

### 4.5 Money in yen, chart prices in USD

**Every money figure in Forex mode is ¥**: risk input, R per lot, spread cost, and all three
outcome rows (`formatYen`, no decimals, signed like `formatUsd`). The only numbers left in USD
are the **chart price levels** (entry / SL / partial / runner, e.g. `2,650.25`, `21,480.5`),
because that's what OANDA's MT5 quotes and what you type into the order ticket — converting
them to yen would produce numbers you can't place. The ¥ side of each level lives in the
outcome rows right above them.

Levels are computed as `entry ± pips × pipSize`, rounded to the instrument's precision. They
are chart (bid-for-long) levels — the spread is already in the math, so orders go in as printed.

### 4.6 Live USD/JPY

- Fetched once on load and every 60 s while the tab is visible, from a free no-key, CORS-enabled
  FX endpoint: Coinbase `exchange-rates` (≈1-min updates), falling back to open.er-api.com
  (daily). The fetch lives in `lib/fx-rate.ts`; `hooks/use-usd-jpy.ts` wraps it.
- Shown as `USD/JPY 150.23 · live 12:37`. Last good rate is persisted, so offline/fetch
  failure falls back to it with a `stale` badge — sizing never goes blank because of a network
  hiccup.
- A pencil button switches to a manual override (persisted) for when you want to size against a
  specific rate; `Use live` switches back.
- Static export still works: it's a client-side `fetch`, no server or API route.

---

## 5. UI

### 5.1 The toggle

```text
┌──────────────────────────────────────────────────────────────┐
│ Risk + Runner TP          [ Futures | Forex ]   (?)  (◐)     │
└──────────────────────────────────────────────────────────────┘
```

- Segmented control (shadcn `ToggleGroup`, single) in the header, left of How it works.
- Title drops "Futures" → **"Risk + Runner TP"**; subtitle mentions the active mode.
- Switching mode **does not wipe** the other mode's inputs — each mode has its own persisted
  keys (§6.2), so flipping back and forth is free.

### 5.2 Size card in Forex mode

```text
┌ 1 SIZE ───────────────────────────── [Reset] ┐
│ Instrument [XAUUSD ▾]   Risk ¥ [30000    ¥] │
│ SL from Entry [500 pips]  Spread [70  pips] │
│ USD/JPY 150.23 · live 12:37             [✎] │
│ 1 pip = $0.01 on XAUUSD · 500 pips = $5.00   │ ← pip definition, next to the input
│ ┌──────────────────────────────────────────┐ │
│ │ 0.35 lots     ¥150/pip · R ¥85,500       │ │
│ │               SL 500 + spread 70 pips    │ │
│ │               0.3508 exact               │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 5.3 Exit card in Forex mode

Unchanged layout. Swaps: "contracts" → "lots", `$` → `¥`, `pts` → `pips`, runner travel in pips.
Presets (`50% @ 0.8R`, `80% @ 0.8R`, `Runner only`) work as-is on lot steps. The honest
breakdown gains one line when `σ > 0`: _"Spread costs ¥X on this trade (Y% of R)"_.

---

## 6. Implementation plan

### 6.1 Code shape

| File                        | Change                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- |
| `lib/instruments.ts` (new)  | OANDA table: `symbol, usdPerPoint, pipSize, minLot, lotStep, precision, spread` |
| `lib/calc.ts`               | `computeSizing` gains `lotStep` + `spread`; `computeExit` gains `spreadR` (σ)   |
| `lib/format.ts`             | `formatYen`, `formatLots`; money formatter chosen by mode                       |
| `lib/fx-rate.ts` (new)      | `fetchUsdJpy()`; `hooks/use-usd-jpy.ts` adds 60 s refresh, fallback, override   |
| `components/mode-toggle`    | new header segmented control                                                    |
| `sizing-card` / `exit-card` | receive a small `units` object (`{ money: '¥', size: 'lots', dist: 'pips' }`)   |
| `hooks/use-*-plan.ts`       | each mode builds a `ModePlan`; `app/page.tsx` just picks the active one         |

Futures calls pass `lotStep = 1, spread = 0, fx = 1` → behavior unchanged, existing 28 tests
must pass untouched.

### 6.2 Persistence

`mode` is persisted. Forex inputs use a `fx.` prefix (`fx.instrument`, `fx.risk`, `fx.stop`,
`fx.spread.NAS100`, `fx.spread.XAUUSD`, `fx.usdjpy.last`, `fx.usdjpy.manual`, `fx.k`, …). Spread is remembered **per
instrument** since the two differ by an order of magnitude. Reset clears only the active mode.

### 6.3 Tests (added to `calc.test.ts`)

- §3.2 sizing fixture (0.35 lots, ¥85,500/lot).
- NAS100 fixture on the 0.1 lot step.
- `σ = 0` ⇒ every futures fixture reproduces (regression guard for the generalized formula).
- §4.2 spread-aware `b` (1.76R) and net outcomes sum to `T × net risk`.
- Below-min-lot → invalid with the "increase risk or tighten SL" hint.

---

## 7. Edge cases

- `spread ≥ a·SL` → the partial is a net loss; warn _"Partial at 0.8R doesn't cover the spread"_.
- `lots > max per order` (20 for XAUUSD) → warn, don't clamp (you can split orders).
- USD/JPY never fetched and no persisted rate (first visit, offline) → sizing shows `—` with
  "USD/JPY unavailable — enter it manually" rather than guessing a rate.

---

## 8. Build phases

1. `instruments.ts` + generalized calc + tests (no UI).
2. Mode toggle, forex size card, yen formatting, persistence.
3. Spread-aware exit card + spread cost line + warnings.
4. How-it-works copy for forex (pip definition, why spread is in the risk).
