-- BetKeyper plans: which plan each account is on, plus one-time scan packs.
-- Run once in the Supabase SQL editor (after setup-free-scans.sql).
--
-- Plans are written by the payment system (RevenueCat webhook, later) with
-- the service role. Users can read their own row but never change it.
-- To give an account a plan by hand: Table Editor -> subscriptions -> Insert
-- row (user_id from Authentication -> Users, plan = starter / pro / allpro /
-- mvp / staff, renews_at empty = never expires). "staff" is unlimited.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null default 'rookie'
    check (plan in ('rookie', 'starter', 'pro', 'allpro', 'mvp', 'staff')),
  billing text check (billing in ('monthly', 'yearly')),
  renews_at timestamptz, -- plan ends after this (null = no end)
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "read own plan" on public.subscriptions
  for select using (auth.uid() = user_id);
grant select on public.subscriptions to authenticated;

-- Scan packs: extra AI scans bought once; they never expire.
create table if not exists public.scan_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scans integer not null check (scans > 0),
  created_at timestamptz not null default now()
);
alter table public.scan_packs enable row level security;
create policy "read own packs" on public.scan_packs
  for select using (auth.uid() = user_id);
grant select on public.scan_packs to authenticated;

-- Which allowance paid for each scan: the monthly plan or a scan pack.
alter table public.scan_usage
  add column if not exists paid_from text not null default 'plan'
    check (paid_from in ('plan', 'pack'));
create index if not exists scan_usage_user_time on public.scan_usage (user_id, created_at);

-- Beta: which plan each tester tried to buy (the upgrade button shows
-- "not available in beta" and records the interest here).
create table if not exists public.upgrade_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan text not null,
  billing text,
  created_at timestamptz not null default now()
);
alter table public.upgrade_interest enable row level security;
create policy "add own interest" on public.upgrade_interest
  for insert with check (auth.uid() = user_id);
grant insert on public.upgrade_interest to authenticated;
