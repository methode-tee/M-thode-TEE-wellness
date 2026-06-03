-- =========================================================
-- MÉTHODE TEE — V18 CLUB + PROTOCOLES PREMIUM
-- Ajouts non destructifs : progression, viewer, contenus avancés
-- Garde le système user_protocols existant pour le déblocage automatique.
-- =========================================================

-- 1) Colonnes enrichies sur protocols
alter table public.protocols add column if not exists total_days integer default 21;
alter table public.protocols add column if not exists level_label text default 'Exploration';
alter table public.protocols add column if not exists certificate_enabled boolean default true;
alter table public.protocols add column if not exists premium_positioning text default 'transformation';

-- 2) Colonnes enrichies sur protocol_contents
alter table public.protocol_contents add column if not exists day_number integer;
alter table public.protocol_contents add column if not exists access_level text default 'protocol';
alter table public.protocol_contents add column if not exists is_preview boolean default false;
alter table public.protocol_contents add column if not exists content_text text;
alter table public.protocol_contents add column if not exists thumbnail_url text;
alter table public.protocol_contents add column if not exists audio_url text;
alter table public.protocol_contents add column if not exists embed_url text;
alter table public.protocol_contents add column if not exists xp_points integer default 0;
alter table public.protocol_contents add column if not exists downloadable boolean default true;

-- 3) Progression par protocole premium
create table if not exists public.protocol_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  current_day integer default 1,
  total_days integer default 21,
  streak integer default 0,
  xp integer default 0,
  level_label text default 'Exploration',
  last_validated_at timestamptz,
  completed_days jsonb default '[]'::jsonb,
  checklist_state jsonb default '{}'::jsonb,
  completed_content jsonb default '[]'::jsonb,
  certificate_unlocked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, protocol_id)
);

-- 4) Progression globale du Club 5€
create table if not exists public.club_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  club_streak integer default 0,
  xp integer default 0,
  mood text,
  water_count integer default 0,
  sleep_quality text,
  gratitude_note text,
  checklist_state jsonb default '{}'::jsonb,
  favorite_content jsonb default '[]'::jsonb,
  last_checkin_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5) updated_at automatique
create or replace function public.mt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_protocol_progress_updated_at on public.protocol_progress;
create trigger trg_protocol_progress_updated_at
before update on public.protocol_progress
for each row execute function public.mt_set_updated_at();

drop trigger if exists trg_club_progress_updated_at on public.club_progress;
create trigger trg_club_progress_updated_at
before update on public.club_progress
for each row execute function public.mt_set_updated_at();

-- 6) Indexes
create index if not exists idx_protocol_progress_user on public.protocol_progress(user_id);
create index if not exists idx_protocol_progress_protocol on public.protocol_progress(protocol_id);
create index if not exists idx_protocol_contents_access_level on public.protocol_contents(access_level);
create index if not exists idx_protocol_contents_day on public.protocol_contents(protocol_id, day_number);

-- 7) RLS
alter table public.protocol_progress enable row level security;
alter table public.club_progress enable row level security;

-- Protocol progress policies
drop policy if exists "Users can read own protocol progress" on public.protocol_progress;
create policy "Users can read own protocol progress"
on public.protocol_progress for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own protocol progress" on public.protocol_progress;
create policy "Users can insert own protocol progress"
on public.protocol_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own protocol progress" on public.protocol_progress;
create policy "Users can update own protocol progress"
on public.protocol_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own protocol progress" on public.protocol_progress;
create policy "Users can delete own protocol progress"
on public.protocol_progress for delete
using (auth.uid() = user_id);

-- Club progress policies
drop policy if exists "Users can read own club progress" on public.club_progress;
create policy "Users can read own club progress"
on public.club_progress for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own club progress" on public.club_progress;
create policy "Users can insert own club progress"
on public.club_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own club progress" on public.club_progress;
create policy "Users can update own club progress"
on public.club_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Lecture des contenus : accès club public aux membres via frontend + accès protocole via user_protocols existant.
-- On garde tes policies existantes sur protocol_contents si elles existent.
-- =========================================================
-- FIN V18
-- =========================================================
