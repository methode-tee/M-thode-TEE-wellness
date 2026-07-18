-- V234 — Migration complète vers Apple In-App Purchase (StoreKit 2)

alter table public.protocols add column if not exists apple_product_id text unique;
alter table public.recipes add column if not exists apple_product_id text unique;

alter table public.user_protocols add column if not exists apple_transaction_id text;
alter table public.user_protocols add column if not exists apple_original_transaction_id text;
alter table public.recipe_purchases add column if not exists apple_transaction_id text;
alter table public.recipe_purchases add column if not exists apple_original_transaction_id text;

create table if not exists public.apple_iap_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  original_transaction_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  purchase_type text not null check (purchase_type in ('protocol','recipe')),
  item_id uuid not null,
  environment text,
  purchase_date timestamptz,
  raw_transaction jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists apple_iap_transactions_user_idx on public.apple_iap_transactions(user_id);
alter table public.apple_iap_transactions enable row level security;
drop policy if exists "Users read own Apple transactions" on public.apple_iap_transactions;
create policy "Users read own Apple transactions" on public.apple_iap_transactions for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- Aucun INSERT client direct : seule la fonction Edge avec service_role déverrouille.
