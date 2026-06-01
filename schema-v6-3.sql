-- MÉTHODE TEE V6.3 — FULL PREMIUM
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

create table if not exists public.sections (
  id text primary key,
  label text not null,
  emoji text default '◆',
  position integer default 0,
  is_visible boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.journal_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  category text default 'journal',
  media_urls text[] default '{}',
  media_types text[] default '{}',
  is_private boolean default true,
  is_published boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.protocols (
  id text primary key,
  title text not null,
  category text not null default 'pharmacie',
  emoji text default '🌿',
  image_url text,
  price numeric not null default 5,
  currency text default 'EUR',
  duration_label text default '5 jours',
  duration_days integer default 5,
  stripe_price_id text,
  short text,
  description text,
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.protocol_files (
  id uuid primary key default gen_random_uuid(),
  protocol_id text references public.protocols(id) on delete cascade,
  title text not null,
  file_type text default 'pdf',
  storage_path text,
  external_url text,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  protocol_id text references public.protocols(id) on delete cascade,
  stripe_session_id text,
  amount numeric,
  currency text default 'EUR',
  access_starts_at timestamptz default now(),
  access_expires_at timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.sections enable row level security;
alter table public.journal_posts enable row level security;
alter table public.protocols enable row level security;
alter table public.protocol_files enable row level security;
alter table public.purchases enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
    and (is_admin = true or lower(email) = 'teayannaparis@gmail.com')
  );
$$;

drop policy if exists "profiles own/admin" on public.profiles;
create policy "profiles own/admin" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update own/admin" on public.profiles;
create policy "profiles update own/admin" on public.profiles for update using (auth.uid() = id or public.is_admin());

drop policy if exists "settings read members" on public.app_settings;
create policy "settings read members" on public.app_settings for select using (auth.uid() is not null);
drop policy if exists "settings admin" on public.app_settings;
create policy "settings admin" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sections read members" on public.sections;
create policy "sections read members" on public.sections for select using (auth.uid() is not null and is_visible = true);
drop policy if exists "sections admin" on public.sections;
create policy "sections admin" on public.sections for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "posts read members" on public.journal_posts;
create policy "posts read members" on public.journal_posts for select using (auth.uid() is not null and is_published = true);
drop policy if exists "posts admin" on public.journal_posts;
create policy "posts admin" on public.journal_posts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "protocols read members" on public.protocols;
create policy "protocols read members" on public.protocols for select using (auth.uid() is not null and is_active = true);
drop policy if exists "protocols admin" on public.protocols;
create policy "protocols admin" on public.protocols for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "files read purchased" on public.protocol_files;
create policy "files read purchased" on public.protocol_files for select using (
  public.is_admin()
  or exists (
    select 1 from public.purchases p
    where p.user_id = auth.uid()
      and p.protocol_id = protocol_files.protocol_id
      and p.status = 'active'
      and (p.access_expires_at is null or p.access_expires_at > now())
  )
);
drop policy if exists "files admin" on public.protocol_files;
create policy "files admin" on public.protocol_files for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "purchases own/admin" on public.purchases;
create policy "purchases own/admin" on public.purchases for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "purchases insert own/admin" on public.purchases;
create policy "purchases insert own/admin" on public.purchases for insert with check (auth.uid() = user_id or public.is_admin());

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    lower(new.email) = 'teayannaparis@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.sections (id,label,emoji,position,is_visible) values
('journal','Accueil','🏠',1,true),
('pharmacie','Pharmacie végétale','🌿',2,true),
('objectifs','Objectifs Corps','🔥',3,true),
('bibliotheque','Bibliothèque privée','📖',4,true),
('profil','Profil','👤',5,true)
on conflict (id) do update set label=excluded.label, emoji=excluded.emoji, position=excluded.position, is_visible=excluded.is_visible;

insert into public.protocols (id,title,category,emoji,price,duration_label,duration_days,short,description,is_active) values
('maux-de-ventre','Maux de ventre','pharmacie','🤢',5,'5 jours',5,'Digestion lourde, ventre gonflé, inconfort après repas.','Un espace de soutien avec protocole, routine, plantes, PDF et conseils ciblés.',true),
('regles-douloureuses','Règles douloureuses','pharmacie','🌸',7,'5 jours',5,'Crampes, bas du dos, nausées, fatigue hormonale.','Un protocole de confort du cycle avec nutrition, plantes et gestes de soutien.',true),
('flat-belly-reset','Flat Belly Reset','objectifs','🔥',24,'28 jours',28,'Digestion, ventre plat, discipline et routine silhouette.','Un protocole complet sur 28 jours pour accompagner le terrain digestif.',true)
on conflict (id) do nothing;

insert into public.journal_posts (title, body, category, is_private, is_published) values
('Bienvenue dans ton journal Méthode Tee','Ici, tu retrouveras les posts privés, routines, tips, notes terrain, contenus exclusifs et inspirations pour avancer à ton rythme.','journal',true,true)
on conflict do nothing;
