-- V76 — Recettes reliées à un protocole
-- Ajout non destructif : n'affecte pas Stripe, les webhooks ni le déblocage.
alter table public.recipes
add column if not exists related_protocol_id text;

create index if not exists recipes_related_protocol_id_idx
on public.recipes (related_protocol_id);
