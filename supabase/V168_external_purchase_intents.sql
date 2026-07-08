-- =========================================================
-- MÉTHODE TEE — V168 External Purchase Link EU
-- Table d'intentions d'achat pour URL Apple stable : /checkout.html
-- Ne modifie pas les webhooks Stripe ni les tables d'achats existantes.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.external_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  purchase_type text not null check (purchase_type in ('protocol','recipe','app_access')),
  item_id text,
  item_label text,
  status text not null default 'pending' check (status in ('pending','redirecting','completed','expired','cancelled','failed')),
  stripe_checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_external_purchase_intents_user_status_created
  on public.external_purchase_intents(user_id, status, created_at desc);

alter table public.external_purchase_intents enable row level security;

drop policy if exists "external_purchase_intents_select_own" on public.external_purchase_intents;
create policy "external_purchase_intents_select_own"
  on public.external_purchase_intents
  for select
  using (auth.uid() = user_id);

drop policy if exists "external_purchase_intents_update_own" on public.external_purchase_intents;
create policy "external_purchase_intents_update_own"
  on public.external_purchase_intents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insertion par Edge Function uniquement via service_role.
