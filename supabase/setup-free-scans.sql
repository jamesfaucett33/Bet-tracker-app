-- Free AI scanning for beta testers (a capped amount per account).
-- Run once in the Supabase SQL editor.

-- Every AI scan made on the owner's key, with what it cost.
create table if not exists public.scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cost_usd numeric(10, 5) not null check (cost_usd > 0),
  input_tokens integer,
  output_tokens integer,
  model text,
  created_at timestamptz not null default now()
);
alter table public.scan_usage enable row level security;
-- Users can see and add their own usage only. No update/delete, and cost must
-- be positive, so nobody can reset their own free credit.
drop policy if exists "read own usage" on public.scan_usage;
create policy "read own usage" on public.scan_usage
  for select using (auth.uid() = user_id);
drop policy if exists "add own usage" on public.scan_usage;
create policy "add own usage" on public.scan_usage
  for insert with check (auth.uid() = user_id);
grant select, insert on public.scan_usage to authenticated;
