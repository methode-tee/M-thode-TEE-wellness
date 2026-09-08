-- MÉTHODE TEE — V487.3 · QA LECTURE SEULE
select public.mt_v4873_healthcheck() as v4873_health;

select jsonb_build_object(
 'phyto_profile',to_regclass('public.mt_phyto_user_profile') is not null,
 'phyto_rules',to_regclass('public.mt_phyto_rules') is not null,
 'phyto_active_rules',to_regprocedure('public.mt_phyto_active_rules_v1()') is not null,
 'phyto_text_guard',to_regprocedure('public.mt_phyto_safety_check_text_v1(text)') is not null,
 'planner',to_regclass('public.mt_planner_preferences') is not null,
 'planner_catalog',to_regprocedure('public.mt_planner_recipe_catalog()') is not null,
 'price_sources',to_regclass('public.mt_price_sources') is not null,
 'price_reference',to_regclass('public.mt_food_price_reference') is not null,
 'rnm_source',exists(select 1 from public.mt_price_sources where code='RNM_DETAIL_FR' and enabled),
 'price_resolver',to_regprocedure('public.mt_food_price_resolve_v1(uuid,text,text,text,text)') is not null,
 'recipe_cost',to_regprocedure('public.mt_recipe_cost_estimate_v1(uuid,numeric,text,text)') is not null,
 'external_ai_api_required',false,
 'runtime_external_price_api',false
) as v4873_components;

select public.mt_price_status_v1() as v4873_price_status;
