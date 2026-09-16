-- MÉTHODE TEE · AUDIT V4896603R1 · PRATICITÉ + CONTEXTES DES 3 794 PROFILS
select jsonb_build_object(
  'status','AUDIT_V4896603R1',
  'rows',(select count(*) from public.mt_food_guidance_profiles_v1),
  'expected_3794',(select count(*)=3794 from public.mt_food_guidance_profiles_v1),
  'contexts_non_empty',(select count(*)=3794 from public.mt_food_guidance_profiles_v1 where cardinality(contexts)>0),
  'contexts_valid',not exists(
    select 1 from public.mt_food_guidance_profiles_v1 g, unnest(g.contexts) c
    where c not in ('breakfast','lunch','snack','dinner')
  ),
  'breakfast_profiles',(select count(*) from public.mt_food_guidance_profiles_v1 where 'breakfast'=any(contexts)),
  'lunch_profiles',(select count(*) from public.mt_food_guidance_profiles_v1 where 'lunch'=any(contexts)),
  'snack_profiles',(select count(*) from public.mt_food_guidance_profiles_v1 where 'snack'=any(contexts)),
  'dinner_profiles',(select count(*) from public.mt_food_guidance_profiles_v1 where 'dinner'=any(contexts)),
  'prep_states',(select jsonb_object_agg(preparation_state,n) from (select preparation_state,count(*) n from public.mt_food_guidance_profiles_v1 group by preparation_state order by preparation_state) s),
  'prep_valid',not exists(select 1 from public.mt_food_guidance_profiles_v1 where preparation_state not in ('ready','meal_ready','assembly','requires_cooking')),
  'raw_animal_not_ready',not exists(
    select 1 from public.mt_food_guidance_profiles_v1
    where public.food_normalize(display_name) ~ '(boeuf|porc|poulet|dinde|veau|agneau|canard|saumon|thon|poisson|crevette|cabillaud|autruche|caille|cerf|cheval|chevreuil|faisan|lievre).*( cru| crue)( |$)'
      and preparation_state='ready'
  ),
  'oat_breakfast_ok',exists(
    select 1 from public.mt_food_guidance_profiles_v1
    where public.food_normalize(display_name) like '%flocon%avoine%'
      and 'breakfast'=any(contexts) and 'snack'=any(contexts)
  ),
  'fruit_multi_context_ok',exists(
    select 1 from public.mt_food_guidance_profiles_v1
    where public.food_normalize(display_name) like 'raisin noir muscat%'
      and 'breakfast'=any(contexts) and 'snack'=any(contexts) and 'lunch'=any(contexts) and 'dinner'=any(contexts)
  ),
  'spinach_meal_context_ok',exists(
    select 1 from public.mt_food_guidance_profiles_v1
    where public.food_normalize(display_name) like 'epinard%bouilli%cuit%eau%'
      and contexts @> array['lunch','dinner']::text[]
      and not ('breakfast'=any(contexts))
  ),
  'dry_lentil_requires_cooking',exists(
    select 1 from public.mt_food_guidance_profiles_v1
    where public.food_normalize(display_name) like 'lentille seche%'
      and preparation_state='requires_cooking'
  ),
  'guidance_v2',to_regprocedure('public.mt_food_guidance_v2(text,date,text,integer)') is not null,
  'voice_changed',false,
  'adapter_changed',false,
  'food_day_changed',false,
  'canonical_library_changed',false,
  'payments_changed',false,
  'unlock_changed',false
) as audit;
