-- MÉTHODE TEE — V411.2 — VÉRIFICATION LECTURE SEULE
select jsonb_pretty(jsonb_build_object(
  'status',case when
    to_regclass('public.food_portion_profiles') is not null
    and to_regclass('public.recipe_nutrition_profiles') is not null
    and to_regclass('public.recipe_nutrition_items') is not null
    and to_regclass('public.recipe_nutrition_snapshots') is not null
    and to_regprocedure('public.mt_nutrition_resolve(bigint,uuid,uuid,uuid,text)') is not null
    and to_regprocedure('public.mt_nutrition_resolve_batch(jsonb)') is not null
    and to_regprocedure('public.mt_recipe_ingredient_search(text,integer)') is not null
    and to_regprocedure('public.mt_admin_save_recipe_nutrition(uuid,numeric,text,jsonb)') is not null
    and to_regprocedure('public.mt_get_recipe_meal_items(uuid,numeric)') is not null
    and to_regprocedure('public.mt_portion_profile(text,text,uuid)') is not null
    and to_regprocedure('public.food_day_micronutrition_summary(date)') is not null
    then 'verification_v411_2_ok' else 'verification_v411_2_a_revoir' end,
  'portion_profiles',(select count(*) from public.food_portion_profiles where enabled),
  'structured_recipes',(select count(*) from public.recipe_nutrition_profiles),
  'recipe_snapshots',(select count(*) from public.recipe_nutrition_snapshots),
  'historical_meal_items_current_count',(select count(*) from public.food_meal_items),
  'smoothie_snapshots',(select count(*) from public.botanical_blend_nutrition_snapshots),
  'note','Lecture seule. Le compteur historique est rapporté uniquement pour suivi ; ce script ne modifie aucune ligne.'
)) as result;
