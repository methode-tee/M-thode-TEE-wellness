-- MÉTHODE TEE V14 — Private Club Luxe
create extension if not exists "pgcrypto";

create table if not exists public.club_settings (
  id integer primary key default 1,
  club_name text default 'Méthode Tee Club',
  hero_subtitle text default 'Journal privé · Nutrition · Plantes · Bien-être',
  quote text default 'Ton corps sait. Accompagne-le.',
  ambiance text default 'botanical',
  show_stories boolean default true,
  show_private_drops boolean default true,
  enable_audio_card boolean default true,
  updated_at timestamptz default now()
);

insert into public.club_settings (id, club_name, hero_subtitle, quote, ambiance)
values (1, 'Méthode Tee Club', 'Journal privé · Nutrition · Plantes · Bien-être', 'Ton corps sait. Accompagne-le.', 'botanical')
on conflict(id) do nothing;

create table if not exists public.club_capsules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text default '✦',
  type text default 'Privé',
  accent text default 'green',
  sort_order integer default 10,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.private_drops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  emoji text default '🔒',
  url text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  level text default 'Green',
  badge text default '🌿',
  points integer default 0,
  streak integer default 0,
  mood text,
  updated_at timestamptz default now()
);

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  item_type text,
  item_id text,
  created_at timestamptz default now(),
  unique(user_id, item_type, item_id)
);

create table if not exists public.user_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.club_settings enable row level security;
alter table public.club_capsules enable row level security;
alter table public.private_drops enable row level security;
alter table public.member_profiles enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_routines enable row level security;

drop policy if exists "club_settings_read" on public.club_settings;
create policy "club_settings_read" on public.club_settings for select using (true);
drop policy if exists "club_settings_admin" on public.club_settings;
create policy "club_settings_admin" on public.club_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "capsules_read" on public.club_capsules;
create policy "capsules_read" on public.club_capsules for select using (active = true or public.is_admin());
drop policy if exists "capsules_admin" on public.club_capsules;
create policy "capsules_admin" on public.club_capsules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "drops_read" on public.private_drops;
create policy "drops_read" on public.private_drops for select using (active = true or public.is_admin());
drop policy if exists "drops_admin" on public.private_drops;
create policy "drops_admin" on public.private_drops for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "member_profiles_own_admin" on public.member_profiles;
create policy "member_profiles_own_admin" on public.member_profiles for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "favorites_own" on public.user_favorites;
create policy "favorites_own" on public.user_favorites for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "routines_own" on public.user_routines;
create policy "routines_own" on public.user_routines for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

insert into public.club_capsules(title, emoji, type, accent, sort_order)
values
('Routine du jour','🌿','Routine','green',1),
('Conseil privé','✨','Tip','gold',2),
('Drop exclusif','🔒','Drop','dark',3),
('Mindset','🧘🏽‍♀️','Mindset','soft',4)
on conflict do nothing;
