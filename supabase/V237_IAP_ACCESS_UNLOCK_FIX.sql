-- MÉTHODE TEE V237 — Garantie d'accès après achat Apple IAP
-- À exécuter une seule fois dans Supabase > SQL Editor avant de redéployer validate-apple-iap.

alter table if exists public.user_protocols
  add column if not exists user_email text;

alter table if exists public.user_protocols
  add column if not exists unlocked boolean default true;

alter table if exists public.user_protocols
  alter column unlocked set default true;

-- Répare les accès actifs déjà enregistrés sans unlocked=true.
update public.user_protocols
set unlocked = true
where status = 'active'
  and unlocked is distinct from true;

notify pgrst, 'reload schema';
