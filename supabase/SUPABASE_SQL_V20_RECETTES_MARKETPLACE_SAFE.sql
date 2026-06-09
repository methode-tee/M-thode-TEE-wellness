-- =========================================================
-- MÉTHODE TEE — V20 RECETTES MARKETPLACE SAFE
-- Ajout non destructif : recettes vendues séparément des protocoles.
-- Ne modifie pas le déblocage existant des protocoles.
-- =========================================================

-- 1) Table vitrine des recettes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  category text default 'Recette',
  mood text,
  emoji text default '🥣',
  image_url text,
  content_text text,
  full_content text,
  is_premium boolean default false,
  price_cents integer default 0,
  stripe_price_id text,
  sort_order integer default 100,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Table achats recettes
create table if not exists public.recipe_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  stripe_session_id text,
  amount_total integer,
  currency text default 'eur',
  status text default 'active',
  purchased_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, recipe_id)
);

-- 3) Colonne payments compatible recettes, sans casser les protocoles
alter table public.payments add column if not exists recipe_id uuid references public.recipes(id) on delete set null;

-- 4) updated_at automatique
create or replace function public.mt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recipes_updated_at on public.recipes;
create trigger trg_recipes_updated_at
before update on public.recipes
for each row execute function public.mt_set_updated_at();

-- 5) Indexes
create index if not exists idx_recipes_active_sort on public.recipes(active, sort_order, created_at desc);
create index if not exists idx_recipe_purchases_user on public.recipe_purchases(user_id);
create index if not exists idx_recipe_purchases_recipe on public.recipe_purchases(recipe_id);
create index if not exists idx_recipe_purchases_session on public.recipe_purchases(stripe_session_id);

-- 6) RLS
alter table public.recipes enable row level security;
alter table public.recipe_purchases enable row level security;

-- Tout utilisateur connecté peut lire la vitrine des recettes actives.
-- L'admin peut aussi voir les recettes masquées dans son studio.
drop policy if exists "Authenticated users can read active recipes" on public.recipes;
drop policy if exists "Recipes read active admin" on public.recipes;
create policy "Recipes read active admin"
on public.recipes for select
to authenticated
using (active = true or public.is_admin());

-- L'admin peut créer/modifier/supprimer les recettes depuis l'admin.
drop policy if exists "Recipes admin manage" on public.recipes;
create policy "Recipes admin manage"
on public.recipes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- L'utilisateur lit seulement ses achats.
drop policy if exists "Users can read own recipe purchases" on public.recipe_purchases;
create policy "Users can read own recipe purchases"
on public.recipe_purchases for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Pas d'insert/update direct client : le webhook Stripe écrit avec service_role.
-- =========================================================
-- FIN V20
-- =========================================================
