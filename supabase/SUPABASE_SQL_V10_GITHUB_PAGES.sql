-- MÉTHODE TEE V10 — GitHub Pages + Stripe Payment Links
create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
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
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

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
  video_url text,
  sort_order integer default 0,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  type text default 'Journal',
  image_url text,
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.protocols enable row level security;
alter table public.user_protocols enable row level security;
alter table public.protocol_contents enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles_own_admin" on public.profiles;
create policy "profiles_own_admin" on public.profiles for all using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

drop policy if exists "protocols_read_active" on public.protocols;
create policy "protocols_read_active" on public.protocols for select using (active = true or public.is_admin());
drop policy if exists "protocols_admin_manage" on public.protocols;
create policy "protocols_admin_manage" on public.protocols for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_protocols_own_admin" on public.user_protocols;
create policy "user_protocols_own_admin" on public.user_protocols for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "contents_owned_admin" on public.protocol_contents;
create policy "contents_owned_admin" on public.protocol_contents for select using (public.is_admin() or exists(select 1 from public.user_protocols up where up.protocol_id = protocol_contents.protocol_id and up.user_id = auth.uid() and up.status='active'));
drop policy if exists "contents_admin_manage" on public.protocol_contents;
create policy "contents_admin_manage" on public.protocol_contents for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts for select using (active = true);
drop policy if exists "posts_admin_manage" on public.posts;
create policy "posts_admin_manage" on public.posts for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('protocol-files','protocol-files',false) on conflict(id) do nothing;

insert into public.protocols(slug,title,subtitle,category,emoji,short_description,long_description,price_cents,duration_label,active)
select 'maux-de-ventre','Maux de ventre','Digestion lourde','pharmacie_vegetale','🤢','Digestion lourde, ventre gonflé, inconfort après repas.','Protocole à remplir depuis l’admin.',500,'5 jours',true
where not exists(select 1 from public.protocols where slug='maux-de-ventre');
