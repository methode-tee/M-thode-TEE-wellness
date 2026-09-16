-- AUDIT MÉTHODE TEE — V4896601 · lecture seule
select jsonb_build_object(
  'status','AUDIT_V4896601',
  'guidance_rpc', to_regprocedure('public.mt_food_guidance_v1(text,date,text,integer)') is not null,
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
  'mcdo_still_in_library', exists(
    select 1
    from public.food_dictionary d
    where public.food_normalize(coalesce(d.source,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
       or public.food_normalize(coalesce(d.display_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
       or public.food_normalize(coalesce(d.canonical_name,'')) ~ '(^| )(mcdonald|mcdonalds|mcdo)( |$)'
  ),
  'guidance_profile_present', exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='food_dictionary' and column_name='guidance_profile'
  ),
  'guidance_enabled_present', exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='food_dictionary' and column_name='guidance_enabled'
  ),
  'no_schema_change', true
) as audit;
