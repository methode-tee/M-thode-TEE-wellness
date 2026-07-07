-- V156 — Rituels universels du jour
-- Version sécurisée : fonctionne même si public.club_settings n'existe pas encore.
-- Crée les réglages globaux de l'app, ajoute daily_rituals, puis ouvre la lecture publique
-- et réserve l'écriture aux admins.

create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('teayannaparis@gmail.com');
$$;

create table if not exists public.club_settings (
  id integer primary key default 1,
  club_name text default 'Ton espace Méthode Tee',
  hero_subtitle text default 'Journal privé · Nutrition · Plantes · Bien-être',
  quote text default 'Ton corps sait. Accompagne-le.',
  ambiance text default 'botanical',
  show_stories boolean default true,
  show_private_drops boolean default true,
  enable_audio_card boolean default true,
  daily_rituals jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table public.club_settings
  add column if not exists club_name text default 'Ton espace Méthode Tee',
  add column if not exists hero_subtitle text default 'Journal privé · Nutrition · Plantes · Bien-être',
  add column if not exists quote text default 'Ton corps sait. Accompagne-le.',
  add column if not exists ambiance text default 'botanical',
  add column if not exists show_stories boolean default true,
  add column if not exists show_private_drops boolean default true,
  add column if not exists enable_audio_card boolean default true,
  add column if not exists daily_rituals jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz default now();

insert into public.club_settings (id, club_name, hero_subtitle, quote, ambiance, daily_rituals, updated_at)
values (
  1,
  'Ton espace Méthode Tee',
  'Journal privé · Nutrition · Plantes · Bien-être',
  'Ton corps sait. Accompagne-le.',
  'botanical',
  '[
    {"icon":"hydration","title":"Boire un grand verre d’eau","sub":"Le premier geste du jour","url":""},
    {"icon":"leaf","title":"Prendre 2 minutes pour respirer","sub":"Revenir doucement à soi","url":""}
  ]'::jsonb,
  now()
)
on conflict (id) do update set
  club_name = coalesce(public.club_settings.club_name, excluded.club_name),
  hero_subtitle = coalesce(public.club_settings.hero_subtitle, excluded.hero_subtitle),
  quote = coalesce(public.club_settings.quote, excluded.quote),
  ambiance = coalesce(public.club_settings.ambiance, excluded.ambiance),
  daily_rituals = case
    when public.club_settings.daily_rituals is null or public.club_settings.daily_rituals = '[]'::jsonb then excluded.daily_rituals
    else public.club_settings.daily_rituals
  end,
  updated_at = now();

comment on column public.club_settings.daily_rituals is
  'Liste JSON de rituels universels du jour: [{icon,title,sub,url}]. Affichée à tous dans le panneau Aujourd’hui.';

alter table public.club_settings enable row level security;

drop policy if exists "club_settings_read" on public.club_settings;
create policy "club_settings_read"
on public.club_settings
for select
using (true);

drop policy if exists "club_settings_admin" on public.club_settings;
create policy "club_settings_admin"
on public.club_settings
for all
using (public.is_admin())
with check (public.is_admin());
