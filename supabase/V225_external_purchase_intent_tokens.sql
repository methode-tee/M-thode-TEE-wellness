-- =========================================================
-- MÉTHODE TEE — V225 secure hand-off WebView -> Safari
-- Adds a short-lived opaque token so checkout.html can resolve
-- the exact selected purchase without sharing browser storage.
-- =========================================================

alter table public.external_purchase_intents
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz;

create index if not exists idx_external_purchase_intents_token_hash
  on public.external_purchase_intents(token_hash)
  where token_hash is not null;

update public.external_purchase_intents
set expires_at = coalesce(expires_at, created_at + interval '30 minutes')
where expires_at is null;
