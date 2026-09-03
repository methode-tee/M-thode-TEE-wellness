-- MÉTHODE TEE — V412.1 · vérification lecture seule
select jsonb_pretty(jsonb_build_object(
  'status','verification_v412_1',
  'recipe_yield_profiles',to_regclass('public.recipe_yield_profiles') is not null,
  'recipe_yield_rpc',to_regprocedure('public.mt_admin_save_recipe_yield(uuid,numeric,text,text,text)') is not null,
  'actual_beverage_calculator',to_regprocedure('public.mt_calculate_botanical_beverage_nutrition(jsonb)') is not null,
  'protocol_reference_rpc',to_regprocedure('public.mt_protocol_reference_comparison(uuid)') is not null,
  'beverage_quantified_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_beverage_entries' and column_name='composition_quantified'),
  'beverage_snapshot_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_beverage_entries' and column_name='nutrition_snapshot'),
  'read_only',true
)) as result;
