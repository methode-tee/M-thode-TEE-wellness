-- V156 — Rituel universel du jour
-- Ajoute une liste éditable de 1 à 5 missions quotidiennes universelles,
-- pilotées depuis l'admin et affichées dans le panneau « Aujourd’hui ».

alter table public.club_settings
  add column if not exists daily_rituals jsonb not null default '[]'::jsonb;

comment on column public.club_settings.daily_rituals is
  'Liste JSON de rituels universels du jour: [{icon,title,sub,url}].';
