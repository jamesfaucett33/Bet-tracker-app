# Supabase setup

Project: `zielynjbewfhoerigbzm` (URL and publishable key are in `src/sync.tsx`).

## Tables
1. `bets` — cloud sync (created during sync setup).
2. `scan_usage` — AI scans per account: run `setup-free-scans.sql` in the
   SQL editor.
3. `subscriptions` + `scan_packs` — plans and scan packs: run
   `setup-plans.sql` after that.
4. `referral_codes` + `referrals` — "Give 25, get 25" invites: run
   `setup-referrals.sql` last. Rewards are granted by a database trigger once
   the friend confirms their email (turn on Confirm email, or rewards pay out
   at sign-up). Give yourself unlimited scans: Table Editor →
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

## Customer list (name, phone, marketing opt-ins)
Sign-up saves `full_name`, `phone`, `marketing_email`, `marketing_sms` and
`consent_at` on each account. To export people who said yes, run in the SQL
editor:

```sql
select email,
       raw_user_meta_data->>'full_name' as name,
       raw_user_meta_data->>'phone' as phone,
       (raw_user_meta_data->>'marketing_email')::boolean as email_ok,
       (raw_user_meta_data->>'marketing_sms')::boolean as text_ok,
       raw_user_meta_data->>'consent_at' as consent_at,
       created_at
from auth.users
order by created_at desc;
```
Only email people with `email_ok` true and text people with `text_ok` true.
