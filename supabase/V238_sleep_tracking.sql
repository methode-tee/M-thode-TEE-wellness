-- V238 — Suivi quotidien sommeil / repos
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table public.daily_activity
  add column if not exists has_sleep boolean default false,
  add column if not exists sleep_hours numeric default 0;

comment on column public.daily_activity.has_sleep is
'Indique qu’un nombre d’heures de sommeil/repos a été saisi pour cette journée.';

comment on column public.daily_activity.sleep_hours is
'Nombre d’heures de sommeil/repos saisi quotidiennement. Le reset est naturel grâce à activity_date.';

notify pgrst, 'reload schema';
