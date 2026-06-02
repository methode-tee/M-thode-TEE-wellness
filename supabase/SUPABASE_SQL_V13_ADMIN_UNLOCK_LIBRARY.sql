-- MÉTHODE TEE V13 — Admin déblocage + bibliothèque + édition + buckets
create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('teayannaparis@gmail.com');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  has_app_access boolean default false,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  type text default 'Journal',
  image_url text,
  media_urls jsonb default '[]'::jsonb,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.posts add column if not exists media_urls jsonb default '[]'::jsonb;
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists active boolean default true;
alter table public.posts add column if not exists created_by uuid references auth.users(id);

create table if not exists public.app_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  title text,
  emoji text default '✦',
  description text,
  system_key text default 'custom',
  sort_order integer default 10,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.protocols (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  subtitle text,
  category text default 'pharmacie_vegetale',
  emoji text,
  short_description text,
  long_description text,
  price_cents integer default 500,
  duration_label text,
  payment_link text,
  image_url text,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.protocols add column if not exists payment_link text;
alter table public.protocols add column if not exists image_url text;
alter table public.protocols add column if not exists active boolean default true;
alter table public.protocols add column if not exists created_by uuid references auth.users(id);

create table if not exists public.user_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid not null,
  status text default 'active',
  purchased_at timestamptz default now(),
  unique(user_id, protocol_id)
);

create table if not exists public.protocol_contents (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  type text default 'document',
  title text not null,
  description text,
  content_text text,
  file_path text,
  file_url text,
  public_url text,
  video_url text,
  sort_order integer default 0,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.protocol_contents add column if not exists public_url text;
alter table public.protocol_contents add column if not exists file_url text;
alter table public.protocol_contents add column if not exists video_url text;
alter table public.protocol_contents add column if not exists sort_order integer default 0;
alter table public.protocol_contents add column if not exists active boolean default true;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.app_pages enable row level security;
alter table public.protocols enable row level security;
alter table public.user_protocols enable row level security;
alter table public.protocol_contents enable row level security;

drop policy if exists "profiles_own_admin" on public.profiles;
create policy "profiles_own_admin" on public.profiles
for all using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "posts_read_paid_admin" on public.posts;
create policy "posts_read_paid_admin" on public.posts
for select using (
  active = true and (
    public.is_admin()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.has_app_access = true)
  )
);

drop policy if exists "posts_admin_manage" on public.posts;
create policy "posts_admin_manage" on public.posts
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pages_read_active" on public.app_pages;
create policy "pages_read_active" on public.app_pages
for select using (active = true or public.is_admin());

drop policy if exists "pages_admin_manage" on public.app_pages;
create policy "pages_admin_manage" on public.app_pages
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "protocols_read_active" on public.protocols;
create policy "protocols_read_active" on public.protocols
for select using (active = true or public.is_admin());

drop policy if exists "protocols_admin_manage" on public.protocols;
create policy "protocols_admin_manage" on public.protocols
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "user_protocols_own_admin" on public.user_protocols;
create policy "user_protocols_own_admin" on public.user_protocols
for all using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "contents_owned_admin" on public.protocol_contents;
create policy "contents_owned_admin" on public.protocol_contents
for select using (
  public.is_admin()
  or exists(
    select 1 from public.user_protocols up
    where up.protocol_id = protocol_contents.protocol_id
    and up.user_id = auth.uid()
    and up.status = 'active'
  )
);

drop policy if exists "contents_admin_manage" on public.protocol_contents;
create policy "contents_admin_manage" on public.protocol_contents
for all using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values
('post-media','post-media',true),
('protocol-media','protocol-media',true),
('protocol-files','protocol-files',true)
on conflict(id) do update set public = true;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
for select using (bucket_id in ('post-media','protocol-media','protocol-files'));

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
for insert with check (bucket_id in ('post-media','protocol-media','protocol-files') and public.is_admin());

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
for update using (bucket_id in ('post-media','protocol-media','protocol-files') and public.is_admin())
with check (bucket_id in ('post-media','protocol-media','protocol-files') and public.is_admin());

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
for delete using (bucket_id in ('post-media','protocol-media','protocol-files') and public.is_admin());

insert into public.app_pages(slug,label,title,emoji,system_key,sort_order,active)
values
('index','Accueil','Accueil','🏠','home',1,true),
('pharmacie','Pharmacie','Pharmacie végétale','🌿','protocols_pharmacie',2,true),
('objectifs','Objectifs','Objectifs corps','🔥','protocols_objectifs',3,true),
('recettes','Recettes','Recettes privées','🥣','custom',4,true),
('bibliotheque','Biblio','Bibliothèque privée','📚','library',5,true),
('profil','Profil','Profil','👤','dashboard',6,true)
on conflict(slug) do nothing;
