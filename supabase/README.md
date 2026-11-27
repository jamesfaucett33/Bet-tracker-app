# Supabase setup

Project: `zielynjbewfhoerigbzm` (URL and publishable key are in `src/sync.tsx`).

## Tables
1. `bets` — cloud sync (created during sync setup).
2. `scan_usage` — AI scans per account: run `setup-free-scans.sql` in the
   SQL editor.
3. `subscriptions` + `scan_packs` — plans and scan packs: run
   `setup-plans.sql` after that. Give yourself unlimited scans: Table Editor →
   `subscriptions` → Insert row → your `user_id`, plan `staff`.

## Free AI scanning function (`scan-slip`)
- Source: `functions/scan-slip/index.ts`, generated from `src/scanSpec.ts` by
  `npx tsx scripts/build-scan-function.ts` (re-run after changing the scan
  model, prompt or schema, then redeploy).
- Deploy: Dashboard → Edge Functions → Deploy a new function → Via Editor →
  name `scan-slip`, paste the file, Deploy.
- Secret: Edge Functions → Secrets → `ANTHROPIC_API_KEY` = your Anthropic key.
- Scans per plan: `src/plans.ts` (then re-run the build script and redeploy).

## Seeing results
- Spend per tester: Table Editor → `scan_usage` (sum `cost_usd` by `user_id`).
