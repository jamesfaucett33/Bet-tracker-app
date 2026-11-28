# BetKeyper pricing

Plans live in `src/plans.ts` (the app and the scan server both read them).
Only **bet uploads** (photos or screenshots read by Claude) count. Manual entry is free and unlimited on every plan. (The free on-phone reader was turned off on Nov 28: it could save wrong tickets.)

## Beta
While `BETA_SCANS` (src/plans.ts) is 50, every account gets at least 50 slip
scans a month, so beta testers cost up to 50¢ a month each. Set it to 0 at launch.

## Plans

| Plan | Monthly | Yearly | Yearly per month | Bet uploads / month |
|---|---|---|---|---|
| Rookie (free) | — | — | — | 25 the first 30 days, then 5 |
| Starter | $0.99 | $9.99 (save 15%) | $0.83 | 25 |
| **Pro** (most popular) | $2.99 | $27.99 (save 20%) | $2.33 | 75 |
| All-Pro | $5.99 | $52.99 (save 25%) | $4.42 | 200 |
| MVP | $9.99 | $82.99 (save 30%) | $6.92 | 400 |
| Upload pack (one-time) | $0.99 | | | +30, never expire |

**Rule: every paid plan is profitable even if a subscriber uses every upload,
every month, on monthly or yearly billing.**

## The math (1¢ per AI upload, Apple keeps 15%)

Profit per subscriber per month:

| Plan | Monthly, all used | Yearly, all used | Monthly, typical (40%) | Yearly, typical (40%) |
|---|---|---|---|---|
| Starter (25) | +$0.59 | +$0.46 | +$0.74 | +$0.61 |
| Pro (75) | +$1.79 | +$1.23 | +$2.24 | +$1.68 |
| All-Pro (200) | +$3.09 | +$1.75 | +$4.29 | +$2.95 |
| MVP (400) | +$4.49 | +$1.88 | +$6.89 | +$4.28 |
| Upload pack (30) | +$0.54 once | | | |

Free plan (acquisition cost): first month up to $0.25, then up to $0.05 a
month. Beta: up to $0.50 a month per tester while `BETA_SCANS` is 50.

**Break-even cost per upload** (yearly plan, every upload used): Starter
2.8¢, Pro 2.6¢, All-Pro 1.9¢, MVP 1.5¢. The scanner must cost under 1.5¢ an
upload for every plan to stay profitable in the worst case.

## Before launch
- **Get the cost under 1.5¢.** The scanner currently runs on a large model
  (2–4¢ an upload), which would lose money on full-use MVP / All-Pro yearly
  plans. Test a smaller model on real tickets; switch only if it stays
  accurate. The numbers above assume 1¢.
- **Web payments** (Stripe) cost about 30¢ + 3% each, so on the website sell
  Starter yearly only.
- **Payments**: Apple in-app purchase on iPhone (required), Google Play on
  Android, Stripe on the web; RevenueCat ties them together and writes each
  person's plan into the `subscriptions` table.

## Levers if margins get tight
- Lower upload counts or raise yearly prices (keep worst case profitable).
- More upload packs (best margin per dollar).
- Free plan: 3 uploads a month instead of 5.
