-- V159 — Rituels universels du jour + liens extensibles
-- À exécuter une seule fois dans Supabase SQL Editor.
-- Compatible même si V158 n'a PAS été exécuté.
-- Ne touche pas aux paiements ni aux déblocages : ajoute seulement public.daily_rituals.

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
  target_type text not null default 'none',
  target_id text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_rituals
  add column if not exists target_type text not null default 'none',
  add column if not exists target_id text default '',
  add column if not exists url text default '',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_rituals_target_type_check'
  ) then
    alter table public.daily_rituals
      add constraint daily_rituals_target_type_check
      check (target_type in ('recipe','protocol','page','post','pdf','audio','url','none'));
  end if;
end $$;

create index if not exists daily_rituals_active_position_idx
on public.daily_rituals (active, position);

create index if not exists daily_rituals_target_idx
on public.daily_rituals (target_type, target_id);

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

insert into public.daily_rituals (position, icon, title, sub, target_type, target_id, url, active)
select * from (values
  (1, 'hydration', 'Boire un grand verre d’eau', 'Le premier geste du jour', 'none', '', '', true),
  (2, 'leaf', 'Prendre 2 minutes pour respirer', 'Revenir doucement à soi', 'none', '', '', true)
) as v(position, icon, title, sub, target_type, target_id, url, active)
where not exists (select 1 from public.daily_rituals);

comment on table public.daily_rituals is
'Rituels universels affichés à tous dans le panneau Aujourd’hui. Gérés depuis l’admin, 1 à 5 lignes visibles.';

comment on column public.daily_rituals.target_type is
'Type de cible optionnelle: recipe, protocol, page, post, pdf, audio, url ou none. Ne débloque rien: redirige vers la logique d’accès existante.';

comment on column public.daily_rituals.target_id is
'Identifiant ou slug du contenu cible lorsque target_type vaut recipe, protocol, page, post, pdf ou audio.';
