-- QA HOTFIX PROTOCOL_PROGRESS — à lancer une seule fois dans Supabase SQL Editor
-- Objectif : éviter les doublons user/protocole et garantir les colonnes utilisées par l'app.

alter table public.protocol_progress
  add column if not exists level_label text default 'Exploration',
  add column if not exists completed_days jsonb default '[]'::jsonb,
  add column if not exists checklist_state jsonb default '{}'::jsonb,
  add column if not exists completed_content jsonb default '[]'::jsonb,
  add column if not exists certificate_unlocked boolean default false,
  add column if not exists started_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Nettoie les doublons éventuels : on garde la ligne la plus récente pour chaque user/protocole.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, protocol_id
      order by coalesce(updated_at, created_at, started_at, now()) desc, id desc
    ) as rn
  from public.protocol_progress
)
delete from public.protocol_progress p
using ranked r
where p.id = r.id
  and r.rn > 1;

-- Empêche définitivement les doublons qui rendent la validation instable.
create unique index if not exists protocol_progress_user_protocol_uidx
on public.protocol_progress(user_id, protocol_id);

-- Valeurs par défaut propres pour les anciennes lignes.
update public.protocol_progress
set
  completed_days = coalesce(completed_days, '[]'::jsonb),
  checklist_state = coalesce(checklist_state, '{}'::jsonb),
  completed_content = coalesce(completed_content, '[]'::jsonb),
  started_at = coalesce(started_at, created_at, now()),
  total_days = coalesce(total_days, 21),
  current_day = greatest(1, coalesce(current_day, 1)),
  streak = greatest(0, coalesce(streak, 0)),
  xp = greatest(0, coalesce(xp, 0));
