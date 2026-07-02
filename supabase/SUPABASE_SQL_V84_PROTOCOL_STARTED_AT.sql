-- V84 — Protocol started_at (safe production migration)
-- Objectif : figer la vraie date de démarrage d'un protocole.
-- À exécuter une seule fois dans Supabase SQL Editor.

alter table public.protocol_progress
add column if not exists started_at timestamptz;

-- Rétrocompatibilité : les protocoles déjà commencés gardent leur date de création.
update public.protocol_progress
set started_at = coalesce(started_at, created_at, now())
where started_at is null;

-- Pour les futures insertions SQL directes, Supabase posera automatiquement la date de départ.
alter table public.protocol_progress
alter column started_at set default now();

create index if not exists idx_protocol_progress_started_at
on public.protocol_progress(started_at);
