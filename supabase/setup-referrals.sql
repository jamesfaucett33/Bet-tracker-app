-- BetKeyper referrals: "Give 25, get 25".
-- Run once in the Supabase SQL editor, AFTER setup-free-scans.sql and
-- setup-plans.sql (the rewards are upload packs in public.scan_packs).
--
-- Every account gets a 6-character invite code. When someone signs up with a
-- code (?ref=CODE link) and confirms their email, they get 25 bonus uploads,
-- and so does the friend who invited them (up to 20 friends each). Rewards
-- are granted here in the database, so they can't be faked from the app.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create policy "read own code" on public.referral_codes
  for select using (auth.uid() = user_id);
grant select on public.referral_codes to authenticated;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users on delete cascade,
  referred_id uuid not null unique references auth.users on delete cascade,
  rewarded_referrer boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "see own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);
grant select on public.referrals to authenticated;

-- A new unique code for a user.
create or replace function public.make_referral_code(uid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  for i in 1..8 loop
    c := upper(substr(md5(uid::text || clock_timestamp()::text || i::text), 1, 6));
    begin
      insert into referral_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      if exists (select 1 from referral_codes where user_id = uid) then
        return (select code from referral_codes where user_id = uid);
      end if;
    end;
  end loop;
  return null;
end $$;

create or replace function public.handle_referral() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_referrer uuid;
  v_count int;
begin
  begin
    if not exists (select 1 from referral_codes where user_id = new.id) then
      perform make_referral_code(new.id);
    end if;

    -- Reward only once the new account's email is confirmed, and only once.
    if new.email_confirmed_at is null then return new; end if;
    if exists (select 1 from referrals where referred_id = new.id) then return new; end if;

    v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'ref', '')));
    if v_code = '' then return new; end if;
    select user_id into v_referrer from referral_codes where code = v_code;
    if v_referrer is null or v_referrer = new.id then return new; end if;

    select count(*) into v_count from referrals where referrer_id = v_referrer and rewarded_referrer;
    insert into referrals (referrer_id, referred_id, rewarded_referrer)
      values (v_referrer, new.id, v_count < 20);
    insert into scan_packs (user_id, scans) values (new.id, 25);
    if v_count < 20 then
      insert into scan_packs (user_id, scans) values (v_referrer, 25);
    end if;
  exception when others then
    -- Never block a sign-up because of a referral problem.
    raise warning 'referral skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_referral on auth.users;
create trigger on_auth_user_referral
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_referral();

-- Codes for accounts that already exist.
select public.make_referral_code(id) from auth.users
  where id not in (select user_id from public.referral_codes);
