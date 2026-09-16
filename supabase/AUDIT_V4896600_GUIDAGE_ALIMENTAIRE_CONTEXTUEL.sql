-- MÉTHODE TEE · Audit V4896600
with defs as (
  select
    coalesce(pg_get_functiondef(to_regprocedure('public.mt_food_guidance_v1(text,date,text,integer)')),'') as guidance_def,
    coalesce(pg_get_functiondef(to_regprocedure('public.mt_food_guidance_role_v2(text,text[],jsonb,numeric,numeric,numeric,numeric,numeric)')),'') as role_def,
    coalesce(pg_get_functiondef(to_regprocedure('public.mt_food_guidance_portion_fallback(text,text[])')),'') as portion_def
)
select jsonb_build_object(
  'status','AUDIT_V4896600',
  'guidance_rpc',to_regprocedure('public.mt_food_guidance_v1(text,date,text,integer)') is not null,
  'role_v2',to_regprocedure('public.mt_food_guidance_role_v2(text,text[],jsonb,numeric,numeric,numeric,numeric,numeric)') is not null,
  'version_v4896600',position('V4896600_CONTEXTUAL_FOOD_GUIDANCE' in guidance_def)>0,
  'small_quantity_filtered',position('guidance_role <> ''small_quantity''' in guidance_def)>0,
  'memory_affinity',position('memory_affinity_score' in guidance_def)>0,
  'culture_affinity',position('culture_familiar' in guidance_def)>0,
  'high_energy_penalty',position('kcal_portion>1200' in guidance_def)>0,
  'vanilla_portion_guard',position('gousse de vanille' in portion_def)>0,
  'no_schema_change',true
) as audit
from defs;
