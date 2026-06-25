-- V19 · XP vivant / récompenses réclamables
-- À lancer une seule fois dans Supabase SQL Editor.

alter table public.member_profiles
add column if not exists level_label text default '🌱 Graine';

alter table public.member_profiles
add column if not exists claimed_rewards jsonb default '[]'::jsonb;
