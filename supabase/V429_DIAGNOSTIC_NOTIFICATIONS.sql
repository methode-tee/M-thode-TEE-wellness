-- MÉTHODE TEE V429 — DIAGNOSTIC UNIQUEMENT, aucune modification de données.
-- La table native_push_tokens utilise `enabled` (booléen), pas `disabled_at`.

select
  count(*) as total_tokens,
  count(*) filter (where enabled is true) as actifs,
  count(*) filter (where enabled is false) as desactives,
  max(updated_at) as dernier_token_mis_a_jour
from public.native_push_tokens;

select
  user_id,
  platform,
  enabled,
  created_at,
  updated_at
from public.native_push_tokens
order by updated_at desc
limit 20;
