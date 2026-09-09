-- V489.0 — audit lecture seule de la chaîne planificateur / source de vérité.
select jsonb_build_object(
  'bridge_v4885',jsonb_build_object(
    'planner_food_items',to_regclass('public.mt_planner_food_items') is not null,
    'ready_foods',to_regprocedure('public.mt_planner_ready_foods_v1()') is not null,
    'whole_dish_cost',to_regprocedure('public.mt_planner_food_cost_v1(uuid,numeric,text,text)') is not null
  ),
  'catalog',jsonb_build_object(
    'unified_total',(select count(*) from public.mt_planner_recipe_catalog()),
    'external_enabled',case when to_regclass('public.mt_planner_food_items') is null then null else (select count(*) from public.mt_planner_food_items where enabled) end
  ),
  'v489',jsonb_build_object(
    'traits',to_regprocedure('public.mt_planner_candidate_traits_v1()') is not null,
    'batch_v2',to_regprocedure('public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text)') is not null,
    'history',to_regclass('public.mt_planner_recommendation_history') is not null,
    'purchase_formats',to_regclass('public.mt_food_purchase_format_reference') is not null
  ),
  'note','Les migrations historiques V4885, V48862 et V4888 sont désormais archivées dans le patch V4890/baseline_history pour ne plus dépendre uniquement de l état live Supabase.'
) as v4890_source_truth_audit;
