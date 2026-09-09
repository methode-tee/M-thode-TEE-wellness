-- MÉTHODE TEE — V489.2.1 · AUDIT LECTURE SEULE
select jsonb_pretty(jsonb_build_object(
  'status','v48921_audit_lecture_seule',
  'functions',jsonb_build_object(
    'candidate_meta_v2',to_regprocedure('public.mt_planner_candidate_meta_v2()') is not null,
    'personal_context_v2',to_regprocedure('public.mt_planner_personal_context_v2(date)') is not null,
    'purchase_quote_v2',to_regprocedure('public.mt_planner_purchase_quote_v2(jsonb,text)') is not null,
    'bounded_cost_batch',to_regprocedure('public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text)') is not null,
    'ciqual_universe_v1',to_regprocedure('public.mt_planner_ciqual_universe_v1()') is not null,
    'ciqual_price_batch_v1',to_regprocedure('public.mt_planner_ciqual_price_batch_v1(text[],text,text)') is not null
  ),
  'counts',jsonb_build_object(
    'exact_purchase_formats',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified),
    'formats_current_365d',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified and (current_date-coalesce(format_observed_on,observed_on))<=365),
    'package_prices_fresh_120d',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified and coalesce(package_price_eur,0)>0 and (current_date-coalesce(price_observed_on,observed_on))<=120),
    'format_known_but_package_price_stale',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified and (current_date-coalesce(format_observed_on,observed_on))<=365 and (current_date-coalesce(price_observed_on,observed_on))>120),
    'specific_cultural_candidates',(select count(*) from public.mt_planner_candidate_meta_v2() where discovery_level=2),
    'recommendation_history_rows',(select count(*) from public.mt_planner_recommendation_history)
  ),
  'guards',jsonb_build_object('format_max_age_days',365,'price_max_age_days',120,'stale_package_price_allowed',false),
  'data_rewritten',false
)) as audit_v48921;

select d.display_name,pf.package_label,pf.package_weight_g,pf.package_price_eur,
       pf.food_dictionary_id,pf.ciqual_code,
       coalesce(pf.format_observed_on,pf.observed_on) as format_observed_on,
       coalesce(pf.price_observed_on,pf.observed_on) as price_observed_on,
       (current_date-coalesce(pf.format_observed_on,pf.observed_on)) as format_age_days,
       (current_date-coalesce(pf.price_observed_on,pf.observed_on)) as price_age_days
from public.mt_food_purchase_format_reference pf
left join public.food_dictionary d on d.id=pf.food_dictionary_id
where pf.enabled and pf.verified
order by d.display_name nulls last,pf.package_label;
