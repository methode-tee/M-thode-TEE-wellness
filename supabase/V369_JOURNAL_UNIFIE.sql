-- V369 — Journal privé unifié
-- À exécuter UNE FOIS dans Supabase SQL Editor AVANT de tester le patch V369.
--
-- Le stockage reste techniquement séparé pour éviter tout écrasement,
-- mais l'expérience utilisateur redevient UN SEUL journal par journée.
--
-- Ce script est idempotent et peut être exécuté même si le SQL V368
-- a déjà été lancé.

create table if not exists public.protocol_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  protocol_id text not null default '',
  content_id text not null default '',
  protocol_title text null,
  journal_title text null,
  protocol_day integer null,
  note_libre text null,
  answers jsonb not null default '{}'::jsonb,
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, protocol_id, content_id, entry_date)
);

alter table public.protocol_journal_entries
  add column if not exists journal_title text null;

alter table public.protocol_journal_entries
  add column if not exists protocol_day integer null;

alter table public.protocol_journal_entries
  add column if not exists signals jsonb not null default '{}'::jsonb;

create index if not exists protocol_journal_entries_user_date_idx
  on public.protocol_journal_entries(user_id, entry_date desc);

alter table public.protocol_journal_entries enable row level security;

drop policy if exists "protocol_journal_entries select own" on public.protocol_journal_entries;
drop policy if exists "protocol_journal_entries insert own" on public.protocol_journal_entries;
drop policy if exists "protocol_journal_entries update own" on public.protocol_journal_entries;
drop policy if exists "protocol_journal_entries delete own" on public.protocol_journal_entries;

create policy "protocol_journal_entries select own"
on public.protocol_journal_entries
for select to authenticated
using (auth.uid() = user_id);

create policy "protocol_journal_entries insert own"
on public.protocol_journal_entries
for insert to authenticated
with check (auth.uid() = user_id);

create policy "protocol_journal_entries update own"
on public.protocol_journal_entries
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "protocol_journal_entries delete own"
on public.protocol_journal_entries
for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete
on public.protocol_journal_entries
to authenticated;

-- Migration douce des anciennes entrées de protocole encore identifiables.
-- Aucune ligne journal_entries n'est supprimée.
insert into public.protocol_journal_entries (
  user_id,
  entry_date,
  protocol_id,
  content_id,
  protocol_title,
  journal_title,
  protocol_day,
  note_libre,
  answers,
  signals,
  created_at,
  updated_at
)
select
  j.user_id,
  j.entry_date,
  coalesce(nullif(j.protocol_id, ''), 'legacy'),
  coalesce(nullif(j.answers ->> 'content_id', ''), 'legacy-' || j.id::text),
  coalesce(nullif(j.protocol_title, ''), 'Protocole'),
  null,
  j.protocol_day,
  j.note_libre,
  coalesce(j.answers, '{}'::jsonb),
  jsonb_strip_nulls(jsonb_build_object(
    'tracker_stress', j.tracker_stress,
    'tracker_energie', j.tracker_energie,
    'tracker_digestion', j.tracker_digestion,
    'tracker_sommeil', j.tracker_sommeil,
    'tracker_humeur', j.tracker_humeur
  )),
  coalesce(j.created_at, now()),
  coalesce(j.updated_at, now())
from public.journal_entries j
where
  coalesce(j.has_protocol_journal, false) = true
  or coalesce(j.answers ->> 'source', '') in ('protocol_journal', 'local_protocol_journal')
on conflict (user_id, protocol_id, content_id, entry_date)
do update set
  protocol_title = coalesce(excluded.protocol_title, public.protocol_journal_entries.protocol_title),
  journal_title = coalesce(excluded.journal_title, public.protocol_journal_entries.journal_title),
  protocol_day = coalesce(excluded.protocol_day, public.protocol_journal_entries.protocol_day),
  note_libre = coalesce(excluded.note_libre, public.protocol_journal_entries.note_libre),
  answers = case
    when excluded.answers <> '{}'::jsonb then excluded.answers
    else public.protocol_journal_entries.answers
  end,
  signals = public.protocol_journal_entries.signals || excluded.signals,
  updated_at = greatest(public.protocol_journal_entries.updated_at, excluded.updated_at);

-- Le calendrier / Mon parcours doit considérer qu'un ressenti de protocole
-- fait bien partie du journal de la journée.
insert into public.daily_activity (
  user_id,
  activity_date,
  has_journal,
  created_at,
  updated_at
)
select
  p.user_id,
  p.entry_date,
  true,
  min(p.created_at),
  max(p.updated_at)
from public.protocol_journal_entries p
group by p.user_id, p.entry_date
on conflict (user_id, activity_date)
do update set
  has_journal = true,
  updated_at = greatest(public.daily_activity.updated_at, excluded.updated_at);

-- Un seul résumé compact pour Mon Équilibre :
-- - le journal quotidien reste prioritaire ;
-- - un ressenti de protocole ne complète QUE les repères quotidiens absents ;
-- - seuls des signaux structurés 1–10 explicitement reconnus sont utilisés ;
-- - le texte libre n'est jamais interprété.
create or replace function public.journal_balance_summary(
  target_date date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with daily as (
    select
      tracker_stress,
      tracker_energie,
      tracker_digestion,
      tracker_sommeil,
      tracker_humeur,
      mood
    from public.journal_entries
    where user_id = auth.uid()
      and entry_date = target_date
    limit 1
  ),
  protocol as (
    select
      round(avg(case
        when (signals ->> 'tracker_stress') ~ '^(10|[1-9])([.][0-9]+)?$'
        then (signals ->> 'tracker_stress')::numeric end), 1) as tracker_stress,
      round(avg(case
        when (signals ->> 'tracker_energie') ~ '^(10|[1-9])([.][0-9]+)?$'
        then (signals ->> 'tracker_energie')::numeric end), 1) as tracker_energie,
      round(avg(case
        when (signals ->> 'tracker_digestion') ~ '^(10|[1-9])([.][0-9]+)?$'
        then (signals ->> 'tracker_digestion')::numeric end), 1) as tracker_digestion,
      round(avg(case
        when (signals ->> 'tracker_sommeil') ~ '^(10|[1-9])([.][0-9]+)?$'
        then (signals ->> 'tracker_sommeil')::numeric end), 1) as tracker_sommeil,
      round(avg(case
        when (signals ->> 'tracker_humeur') ~ '^(10|[1-9])([.][0-9]+)?$'
        then (signals ->> 'tracker_humeur')::numeric end), 1) as tracker_humeur,
      count(*) filter (where signals <> '{}'::jsonb) as signal_rows
    from public.protocol_journal_entries
    where user_id = auth.uid()
      and entry_date = target_date
  )
  select jsonb_build_object(
    'tracker_stress', coalesce(
      (select tracker_stress from daily),
      (select tracker_stress from protocol)
    ),
    'tracker_energie', coalesce(
      (select tracker_energie from daily),
      (select tracker_energie from protocol)
    ),
    'tracker_digestion', coalesce(
      (select tracker_digestion from daily),
      (select tracker_digestion from protocol)
    ),
    'tracker_sommeil', coalesce(
      (select tracker_sommeil from daily),
      (select tracker_sommeil from protocol)
    ),
    'tracker_humeur', coalesce(
      (select tracker_humeur from daily),
      (select tracker_humeur from protocol)
    ),
    'mood', (select mood from daily),
    'protocol_signal_rows', coalesce((select signal_rows from protocol), 0)
  );
$$;

grant execute
on function public.journal_balance_summary(date)
to authenticated;
