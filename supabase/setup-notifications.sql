-- BetKeyper notifications: what each person wants, and where to reach them.
-- Run once in the Supabase SQL editor.

-- Choices from Profile -> Notifications (cashed, busted, legs, oneAway,
-- kickoff, recap, offers). The app saves them; the sender reads them.
create table if not exists public.notification_prefs (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "own prefs read" on public.notification_prefs for select using (auth.uid() = user_id);
create policy "own prefs insert" on public.notification_prefs for insert with check (auth.uid() = user_id);
create policy "own prefs update" on public.notification_prefs for update using (auth.uid() = user_id);
grant select, insert, update on public.notification_prefs to authenticated;

-- Phones registered for push (Expo push tokens), one row per device.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "own tokens read" on public.push_tokens for select using (auth.uid() = user_id);
create policy "own tokens insert" on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "own tokens update" on public.push_tokens for update using (auth.uid() = user_id);
create policy "own tokens delete" on public.push_tokens for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.push_tokens to authenticated;

-- What the sender has already announced, so nothing is sent twice.
create table if not exists public.notifications_sent (
  user_id uuid not null references auth.users on delete cascade,
  bet_id text not null,
  event text not null, -- e.g. 'cashed', 'busted', 'leg:2:hit', 'oneAway', 'kickoff'
  sent_at timestamptz not null default now(),
  primary key (user_id, bet_id, event)
);
alter table public.notifications_sent enable row level security; -- server only
