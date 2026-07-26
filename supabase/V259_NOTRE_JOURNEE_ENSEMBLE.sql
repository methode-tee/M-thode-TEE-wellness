-- V259 — Notre journée ensemble
-- Ajout isolé. Ne modifie aucune table d'achat, protocole, recette ou déblocage.
create extension if not exists "pgcrypto";

alter table public.daily_rituals
  add column if not exists time_label text default '',
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists weekdays smallint[] not null default '{}';

create table if not exists public.daily_journey_settings (
  id integer primary key default 1 check (id=1),
  title text not null default 'Notre journée ensemble',
  subtitle text not null default 'Les rendez-vous de la communauté au rythme de ta journée.',
  show_member_count boolean not null default true,
  member_minimum integer not null default 50 check (member_minimum>=0),
  updated_at timestamptz not null default now()
);
insert into public.daily_journey_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.daily_journey_participation (
  user_id uuid not null references auth.users(id) on delete cascade,
  participation_date date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key(user_id,participation_date)
);
create index if not exists daily_journey_participation_date_idx on public.daily_journey_participation(participation_date);

create table if not exists public.daily_journey_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  ritual_id uuid not null references public.daily_rituals(id) on delete cascade,
  completion_date date not null default current_date,
  completed_at timestamptz not null default now(),
  primary key(user_id,ritual_id,completion_date)
);
create index if not exists daily_journey_completions_day_idx on public.daily_journey_completions(completion_date,user_id);

alter table public.daily_journey_settings enable row level security;
alter table public.daily_journey_participation enable row level security;
alter table public.daily_journey_completions enable row level security;

drop policy if exists "daily_journey_settings_read" on public.daily_journey_settings;
create policy "daily_journey_settings_read" on public.daily_journey_settings for select using(true);
drop policy if exists "daily_journey_settings_admin" on public.daily_journey_settings;
create policy "daily_journey_settings_admin" on public.daily_journey_settings for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "daily_journey_participation_own" on public.daily_journey_participation;
create policy "daily_journey_participation_own" on public.daily_journey_participation for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "daily_journey_completions_own" on public.daily_journey_completions;
create policy "daily_journey_completions_own" on public.daily_journey_completions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create or replace function public.daily_journey_member_count(target_date date default current_date)
returns integer language sql security definer set search_path=public stable as $$
  select count(*)::integer from public.daily_journey_participation where participation_date=target_date;
$$;
grant execute on function public.daily_journey_member_count(date) to anon, authenticated;

comment on function public.daily_journey_member_count(date) is 'Retourne uniquement un total anonyme de participants uniques pour la date. Aucun identifiant utilisateur n’est exposé.';
