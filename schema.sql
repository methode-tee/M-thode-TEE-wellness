-- MÉTHODE TEE V5 — SUPABASE SCHEMA

-- 1. Profils utilisateurs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  main_goal text,
  current_state text,
  routine_level text,
  onboarding_completed boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Guides / produits digitaux
create table if not exists public.guides (
  id text primary key,
  title text not null,
  category text not null,
  emoji text,
  price numeric not null default 0,
  currency text default 'EUR',
  duration_days integer default 7,
  stripe_price_id text,
  short text,
  promise text,
  tags text[],
  products text[],
  pdf_path text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Achats
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guide_id text references public.guides(id) on delete cascade,
  stripe_session_id text,
  stripe_payment_intent text,
  amount numeric,
  currency text default 'EUR',
  access_starts_at timestamptz default now(),
  access_expires_at timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

-- 4. Abonnements Club
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- 5. Historique onboarding / ressentis
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  digestion integer,
  energy integer,
  sleep integer,
  stress integer,
  cycle text,
  mood text,
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.guides enable row level security;
alter table public.purchases enable row level security;
alter table public.subscriptions enable row level security;
alter table public.checkins enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

-- Guides lisibles par tous si actifs
create policy "Anyone can read active guides" on public.guides
for select using (active = true);

-- Admins can manage guides
create policy "Admins can manage guides" on public.guides
for all using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Purchases
create policy "Users can view own purchases" on public.purchases
for select using (auth.uid() = user_id);

create policy "Users can insert own purchases demo" on public.purchases
for insert with check (auth.uid() = user_id);

-- Subscriptions
create policy "Users can view own subscriptions" on public.subscriptions
for select using (auth.uid() = user_id);

-- Checkins
create policy "Users can manage own checkins" on public.checkins
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fonction pour créer profil automatiquement
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage :
-- Créer dans Supabase Storage un bucket privé nommé : guide-pdfs
-- Ajouter policies Storage adaptées selon ton besoin.
