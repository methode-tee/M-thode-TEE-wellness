-- MÉTHODE TEE — V4896601 · Curation du guidage proactif
-- Objectifs :
-- 1) empêcher les produits McDonald's d'être suggérés spontanément par BB Tee ;
-- 2) conserver ces produits dans la bibliothèque pour saisie, calcul et Adapter mon repas ;
-- 3) ne toucher ni aux paiements, ni aux droits d'accès, ni aux objectifs utilisateur.
-- Idempotent : peut être relancé.

begin;

update public.food_dictionary
set
  guidance_enabled = false,
  guidance_profile = jsonb_set(
    coalesce(guidance_profile,'{}'::jsonb),
    '{auto_suggest}',
    'false'::jsonb,
    true
  )
where
  public.food_normalize(coalesce(source,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
  or public.food_normalize(coalesce(display_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
  or public.food_normalize(coalesce(canonical_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)';

commit;

select jsonb_build_object(
  'status','V4896601_CURATION_GUIDAGE_PROACTIF_PRET',
  'mcdo_auto_suggest_disabled', not exists(
    select 1
    from public.food_dictionary d
    where d.enabled=true
      and d.guidance_enabled=true
      and (
        public.food_normalize(coalesce(d.source,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
        or public.food_normalize(coalesce(d.display_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
        or public.food_normalize(coalesce(d.canonical_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
      )
  ),
  'library_entries_preserved', exists(
    select 1
    from public.food_dictionary d
    where public.food_normalize(coalesce(d.source,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
       or public.food_normalize(coalesce(d.display_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
       or public.food_normalize(coalesce(d.canonical_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
  ),
  'no_schema_change', true,
  'unlock_changed', false,
  'payments_changed', false
) as v4896601_result;
