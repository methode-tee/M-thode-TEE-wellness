-- V166 — Persistance des missions du jour
-- À exécuter une seule fois dans Supabase SQL Editor.
-- Objectif : garder cochées jusqu'à minuit toutes les missions effectuées
-- (rituels, hydratation, protocole, routine, journal, checklist, tracker, photo),
-- même après déconnexion/reconnexion.

alter table public.daily_activity
  add column if not exists has_hydration boolean default false,
  add column if not exists has_protocol boolean default false,
  add column if not exists has_routine boolean default false,
  add column if not exists has_ritual boolean default false,
  add column if not exists hydration_liters numeric default 0,
  add column if not exists today_checks jsonb not null default '{}'::jsonb;

create index if not exists daily_activity_user_date_idx
on public.daily_activity (user_id, activity_date);

comment on column public.daily_activity.today_checks is
'Statut des missions du jour cochées côté Accueil/Profil. Reset naturel par date activity_date.';

comment on column public.daily_activity.hydration_liters is
'Quantité d’eau enregistrée pour la journée, utilisée pour restaurer le 2/2 L après reconnexion.';
