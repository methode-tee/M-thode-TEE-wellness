-- V158 — Table dédiée aux rituels universels du jour
-- À exécuter une seule fois dans Supabase SQL Editor.
-- Ne touche pas aux tables existantes : ajoute seulement public.daily_rituals.

create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('teayannaparis@gmail.com');
$$;

create table if not exists public.daily_rituals (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 1,
  icon text not null default 'seed',
  title text not null,
  sub text default '',
  url text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_rituals_active_position_idx
on public.daily_rituals (active, position);

alter table public.daily_rituals enable row level security;

drop policy if exists "daily_rituals_read_active" on public.daily_rituals;
create policy "daily_rituals_read_active"
on public.daily_rituals
for select
using (active = true);

drop policy if exists "daily_rituals_admin_all" on public.daily_rituals;
create policy "daily_rituals_admin_all"
on public.daily_rituals
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.daily_rituals (position, icon, title, sub, url, active)
select * from (values
  (1, 'hydration', 'Boire un grand verre d’eau', 'Le premier geste du jour', '', true),
  (2, 'leaf', 'Prendre 2 minutes pour respirer', 'Revenir doucement à soi', '', true)
) as v(position, icon, title, sub, url, active)
where not exists (select 1 from public.daily_rituals);

comment on table public.daily_rituals is
'Rituels universels affichés à tous dans le panneau Aujourd’hui. Gérés depuis l’admin, 1 à 5 lignes visibles.';
