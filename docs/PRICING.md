# BetKeyper pricing

Plans live in `src/plans.ts` (the app and the scan server both read them).
Only **AI scans** count. Manual entry and screenshots the phone reads by
itself (about 20% of scans) are free and unlimited on every plan.

## Beta
While `BETA_SCANS` (src/plans.ts) is 50, every account gets at least 50 slip
scans a month, so beta testers cost up to 50¢ a month each. Set it to 0 at launch.

## Plans

| Plan | Monthly | Yearly | Yearly per month | AI scans / month |
|---|---|---|---|---|
| Rookie (free) | — | — | — | 25 the first 30 days, then 5 |
| Starter | $0.99 | $9.99 (save 16%) | $0.83 | 25 |
| **Pro** (most popular) | $2.99 | $24.99 (save 30%) | $2.08 | 100 |
| All-Pro | $5.99 | $49.99 (save 30%) | $4.17 | 400 |
| MVP | $9.99 | $89.99 (save 25%) | $7.50 | 750 |
| Scan pack (one-time) | $0.99 | | | +50, never expire |

## The math (1¢ per AI scan, Apple keeps 15%)

Worst case is a subscriber using **every** scan, every month. Typical apps
see 30–50% of an allowance used; the "typical" column assumes 40%.

| Plan | You keep / month | AI cost, all used | Profit, all used | Profit, typical (40%) |
|---|---|---|---|---|
| Rookie, first month | $0 | $0.25 | −$0.25 (once) | −$0.10 |
| Rookie, after | $0 | $0.05 | −$0.05 | −$0.02 |
| Starter monthly | $0.84 | $0.25 | +$0.59 | +$0.74 |
| Starter yearly | $0.71 | $0.25 | +$0.46 | +$0.61 |
| Pro monthly | $2.54 | $1.00 | +$1.54 | +$2.14 |
| Pro yearly | $1.77 | $1.00 | +$0.77 | +$1.37 |
| All-Pro monthly | $5.09 | $4.00 | +$1.09 | +$3.49 |
| All-Pro yearly | $3.54 | $4.00 | −$0.46 | +$1.94 |
| MVP monthly | $8.49 | $7.50 | +$0.99 | +$5.49 |
| MVP yearly | $6.37 | $7.50 | −$1.13 | +$3.37 |
| Scan pack | $0.84 | $0.50 | +$0.34 | |

Every monthly plan makes money even if every scan is used. The two big yearly
plans lose a little only on someone who maxes out every month for a year; at
normal usage they're the most profitable plans because they're paid upfront.

## Before launch
- **Confirm the 1¢.** The scanner currently runs on a large model (2–4¢ a
  scan). Test a smaller model on real tickets; switch only if it stays
  accurate. The numbers above assume 1¢.
- **Web payments** (Stripe) cost about 30¢ + 3% each, so on the website sell
  Starter yearly only.
- **Payments**: Apple in-app purchase on iPhone (required), Google Play on
  Android, Stripe on the web; RevenueCat ties them together and writes each
  person's plan into the `subscriptions` table.

## Levers if margins get tight
- Lower All-Pro / MVP scan counts, or raise their yearly prices.
- More scan packs (best margin per dollar).
- Free plan: 3 scans a month instead of 5.
