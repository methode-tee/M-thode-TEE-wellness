-- V64 · Méthode Tee — Mon parcours / calendrier intelligent
-- À lancer une seule fois dans Supabase > SQL Editor

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  protocol_id uuid null,
  protocol_title text null,
  protocol_day integer null,
  has_journal boolean default false,
  has_checklist boolean default false,
  has_tracker boolean default false,
  has_photo boolean default false,
  has_recipe boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, activity_date)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  protocol_id text null,
  protocol_title text null,
  protocol_day integer null,
  mood text null,
  note_libre text null,
  answers jsonb default '{}'::jsonb,
  tracker_stress integer null,
  tracker_energie integer null,
  tracker_digestion integer null,
  tracker_sommeil integer null,
  tracker_humeur integer null,
  has_protocol_journal boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

alter table public.daily_activity enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "daily_activity select own" on public.daily_activity;
drop policy if exists "daily_activity insert own" on public.daily_activity;
drop policy if exists "daily_activity update own" on public.daily_activity;
drop policy if exists "daily_activity delete own" on public.daily_activity;
create policy "daily_activity select own" on public.daily_activity for select to authenticated using (auth.uid() = user_id);
create policy "daily_activity insert own" on public.daily_activity for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_activity update own" on public.daily_activity for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_activity delete own" on public.daily_activity for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "journal_entries select own" on public.journal_entries;
drop policy if exists "journal_entries insert own" on public.journal_entries;
drop policy if exists "journal_entries update own" on public.journal_entries;
drop policy if exists "journal_entries delete own" on public.journal_entries;
create policy "journal_entries select own" on public.journal_entries for select to authenticated using (auth.uid() = user_id);
create policy "journal_entries insert own" on public.journal_entries for insert to authenticated with check (auth.uid() = user_id);
create policy "journal_entries update own" on public.journal_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries delete own" on public.journal_entries for delete to authenticated using (auth.uid() = user_id);
