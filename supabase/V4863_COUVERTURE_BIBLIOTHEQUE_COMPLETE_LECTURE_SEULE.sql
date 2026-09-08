-- V486.3 · COUVERTURE DE TOUTE LA BIBLIOTHÈQUE PAR IDENTITÉ EXACTE
-- LECTURE SEULE.
--
-- Ce test ne lance pas des centaines de phrases vocales (inutilement coûteux).
-- Il vérifie que chaque fiche alimentaire active et nutritionnellement exploitable
-- est retrouvable par la couche exacte qui précède désormais le fallback fuzzy.
with eligible as (
  select d.id,d.display_name,d.canonical_name
  from public.food_dictionary d
  where d.enabled
    and length(public.food_normalize(coalesce(d.display_name,d.canonical_name,'')))>=3
    and (
      d.ciqual_code is not null
      or d.custom_kcal_100g is not null
      or d.custom_protein_100g is not null
      or d.custom_fat_100g is not null
      or d.custom_carbs_100g is not null
      or d.custom_fiber_100g is not null
      or d.custom_salt_100g is not null
    )
), checked as (
  select
    e.*,
    exists(
      select 1
      from public.food_speech_library_exact_dictionary_v2(
        coalesce(e.display_name,e.canonical_name),50
      ) x
      where x.dictionary_id=e.id
    ) own_identity_found,
    (
      select count(*)
      from public.food_speech_library_exact_dictionary_v2(
        coalesce(e.display_name,e.canonical_name),50
      )
    ) exact_identity_count
  from eligible e
)
select
  count(*) eligible_foods,
  count(*) filter(where own_identity_found) exact_retrievable,
  count(*) filter(where not own_identity_found) missing_exact,
  count(*) filter(where exact_identity_count>1) exact_homonyms_to_confirm,
  jsonb_agg(coalesce(display_name,canonical_name)) filter(where not own_identity_found) missing_names
from checked;
