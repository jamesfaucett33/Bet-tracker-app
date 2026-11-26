# Supabase setup

Project: `zielynjbewfhoerigbzm` (URL and publishable key are in `src/sync.tsx`).

## Tables
1. `bets` — cloud sync (created during sync setup).
2. `scan_usage`, `pro_interest` — free AI scans and the Pro interest test: run
   `setup-free-scans.sql` in the SQL editor.

## Free AI scanning function (`scan-slip`)
- Source: `functions/scan-slip/index.ts`, generated from `src/scanSpec.ts` by
  `npx tsx scripts/build-scan-function.ts` (re-run after changing the scan
  model, prompt or schema, then redeploy).
- Deploy: Dashboard → Edge Functions → Deploy a new function → Via Editor →
  name `scan-slip`, paste the file, Deploy.
- Secret: Edge Functions → Secrets → `ANTHROPIC_API_KEY` = your Anthropic key.
- Free allowance per account: `FREE_CREDIT_USD` at the top of the function.

## Seeing results
- Who would pay: Table Editor → `pro_interest`.
- Spend per tester: Table Editor → `scan_usage` (sum `cost_usd` by `user_id`).
