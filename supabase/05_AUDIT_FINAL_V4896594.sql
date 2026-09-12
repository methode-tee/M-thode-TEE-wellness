-- MÉTHODE TEE — V4896594 — audit final lecture seule.
with a as (
  select
    count(*) total_profiles,
    count(*) filter(where nullif(profile #>> '{deterministic,profile_code}','') is null) missing_profile_code,
    count(*) filter(where (coalesce(roles,'{}'::text[]) || coalesce(fill_roles,'{}'::text[])) && array['protein','starch','vegetable']::text[]
                         and nullif(profile #>> '{deterministic,profile_code}','') is null) structural_missing_profile,
    count(*) filter(where locked) locked_profiles,
    count(*) filter(where locked and nullif(profile #>> '{deterministic,profile_code}','') is null) locked_missing_deterministic,
    count(*) filter(where public.mt_food_is_plain_pasta_v1(display_name)
                         and profile #>> '{deterministic,profile_code}' <> 'starch_v10_pasta') bad_plain_pasta_profile,
    count(*) filter(where public.mt_food_is_prepared_pasta_dish_v1(display_name)
                         and profile #>> '{deterministic,profile_code}' <> 'composite_v60_prepared_pasta') bad_prepared_pasta_profile
  from public.mt_food_culinary_profiles_v1
), trig as (
  select count(*) filter(where tgname='aa_mt_food_profile_semantic_xy_before_write_v6594') new_trigger,
         count(*) filter(where tgname in ('aa_mt_food_profile_semantic_xy_before_write_v6589','aa_mt_food_profile_semantic_xy_before_write_v6590','aa_mt_food_profile_semantic_xy_before_write_v6591','aa_mt_food_profile_semantic_xy_before_write_v6592')) old_triggers
  from pg_trigger where tgrelid='public.mt_food_culinary_profiles_v1'::regclass and not tgisinternal
), m as (
  select count(*) matrix_rows,
    count(*) filter(where source_profile_code<>'*' and not exists(select 1 from public.mt_food_deterministic_profile_catalog_v1 c where c.profile_code=source_profile_code)) orphan_source,
    count(*) filter(where not exists(select 1 from public.mt_food_deterministic_profile_catalog_v1 c where c.profile_code=target_profile_code)) orphan_target
  from public.mt_food_profile_compatibility_v1
)
select jsonb_build_object(
  'status','V4896594_AUDIT_FINAL',
  'total_profiles',a.total_profiles,
  'missing_profile_code',a.missing_profile_code,
  'structural_missing_profile',a.structural_missing_profile,
  'locked_profiles',a.locked_profiles,
  'locked_missing_deterministic',a.locked_missing_deterministic,
  'bad_plain_pasta_profile',a.bad_plain_pasta_profile,
  'bad_prepared_pasta_profile',a.bad_prepared_pasta_profile,
  'formula_rows',(select count(*) from public.mt_food_structure_formulas_v1),
  'catalog_rows',(select count(*) from public.mt_food_deterministic_profile_catalog_v1),
  'matrix_rows',m.matrix_rows,'orphan_source',m.orphan_source,'orphan_target',m.orphan_target,
  'new_trigger',trig.new_trigger,'old_triggers',trig.old_triggers,
  'trigger_locked_short_circuit',position('if coalesce(new.locked,false) then' in lower(pg_get_functiondef('public.mt_food_profile_semantic_xy_before_write_v6594()'::regprocedure)))>0,
  'runtime_external_ai',false,'runtime_internet',false,'payments_changed',false,'unlock_changed',false
) v4896594_audit
from a,trig,m;

-- Profils repères : vérification visuelle des cas qui avaient posé problème.
select display_name,roles,fill_roles,families,
       profile #>> '{deterministic,profile_code}' as deterministic_profile_code,
       profile #>> '{deterministic,role_signature}' as role_signature,
       profile #> '{deterministic,missing_roles}' as missing_roles,
       locked,pairing_mode,pairing_version
from public.mt_food_culinary_profiles_v1
where public.food_normalize(display_name) like any(array[
  'macaroni%','maccheroni%','thon%','oeuf%','jambon%','tomate%pelee%','lait demi ecreme%','lait 1er age%'
])
order by display_name
limit 80;

-- Smoke dynamiques : ils utilisent des IDs réels de TA base et n'inventent rien.
with x as (
  select dictionary_id,ciqual_code from public.mt_food_culinary_profiles_v1
  where public.food_normalize(display_name) like any(array['macaroni%','maccheroni%'])
    and ('starch'=any(coalesce(roles,'{}'::text[])) or 'starch'=any(coalesce(fill_roles,'{}'::text[])))
  order by locked desc,display_name limit 1
)
select 'SMOKE_MACARONI' test,
  public.mt_adapter_deterministic_candidates_v1(jsonb_build_array(jsonb_build_object('dictionary_id',dictionary_id,'code',ciqual_code,'unknown',false)),5) result
from x;

with x as (
  select dictionary_id,ciqual_code from public.mt_food_culinary_profiles_v1
  where public.food_normalize(display_name) like 'thon%'
    and ('protein'=any(coalesce(roles,'{}'::text[])) or 'protein'=any(coalesce(fill_roles,'{}'::text[])))
  order by (case when public.food_normalize(display_name) like '%au naturel%' then 0 else 1 end),display_name limit 1
)
select 'SMOKE_THON' test,
  public.mt_adapter_deterministic_candidates_v1(jsonb_build_array(jsonb_build_object('dictionary_id',dictionary_id,'code',ciqual_code,'unknown',false)),5) result
from x;

with x as (
  select dictionary_id,ciqual_code from public.mt_food_culinary_profiles_v1
  where public.food_normalize(display_name) like 'tomate%pelee%'
  order by display_name limit 1
)
select 'SMOKE_TOMATE_PELEE' test,
  public.mt_adapter_deterministic_candidates_v1(jsonb_build_array(jsonb_build_object('dictionary_id',dictionary_id,'code',ciqual_code,'unknown',false)),5) result
from x;


-- V4896594R2 — continuité CP483B.
with targets(profile_key,expected_role,expected_kind) as (
  values
    ('ciqual:53100','starch','plantain_raw'),('ciqual:53101','starch','plantain_cooked'),
    ('ciqual:37002','composite','composite'),('ciqual:25211','composite','composite'),
    ('ciqual:11215','condiment','condiment'),('ciqual:25409','composite','composite'),
    ('ciqual:25552','composite','composite'),('ciqual:25410','composite','composite'),
    ('ciqual:25562','composite','composite'),('ciqual:25418','composite','composite'),
    ('ciqual:26266','composite','composite'),('ciqual:25400','composite','composite'),
    ('ciqual:28929','protein','poultry'),('ciqual:25508','composite','composite'),
    ('ciqual:25396','composite','composite'),('ciqual:25546','composite','composite'),
    ('ciqual:25073','composite','composite'),('ciqual:20194','composite','composite'),
    ('dict:f6737fad-faf6-45b0-b251-456d3ff8c899','composite','composite')
), q as (
  select t.*,p.display_name,p.roles,p.fill_roles,p.families,p.profile
  from targets t left join public.mt_food_culinary_profiles_v1 p on p.profile_key=t.profile_key
), trig as (
  select
    exists(select 1 from pg_trigger t where t.tgrelid='public.mt_food_culinary_profiles_v1'::regclass and t.tgname='aa_mt_food_profile_semantic_xy_before_write_v6594' and not t.tgisinternal and t.tgenabled in ('O','A')) aa6594,
    exists(select 1 from pg_trigger t where t.tgrelid='public.mt_food_culinary_profiles_v1'::regclass and t.tgname='zz_mt_cp483b_override' and not t.tgisinternal and t.tgenabled in ('O','A')) cp483b,
    exists(select 1 from pg_trigger t where t.tgrelid='public.mt_food_culinary_profiles_v1'::regclass and t.tgname='zzz_mt_food_deterministic_finalize_v6594' and not t.tgisinternal and t.tgenabled in ('O','A')) finalizer
)
select jsonb_build_object(
  'status','V4896594R2_CP483B_CONTINUATION_AUDIT',
  'cp483b_backups',(select count(*) from public.mt_cp483b_profile_backup),
  'cp483b_overrides_enabled',(select count(*) from public.mt_cp483b_overrides where enabled),
  'trigger_v6594',trig.aa6594,'trigger_cp483b',trig.cp483b,'trigger_deterministic_finalizer',trig.finalizer,
  'targets_total',(select count(*) from targets),
  'targets_found',count(*) filter(where q.display_name is not null),
  'wrong_primary_role',count(*) filter(where q.display_name is not null and not (q.expected_role=any(coalesce(q.roles,'{}'::text[])))),
  'poultry_still_pork',count(*) filter(where q.expected_kind='poultry' and 'protein:pork_cured'=any(coalesce(q.families,'{}'::text[]))),
  'plantain_raw_candidate',count(*) filter(where q.expected_kind='plantain_raw' and coalesce((q.profile->>'candidate_eligible')::boolean,false)),
  'plantain_cooked_not_candidate',count(*) filter(where q.expected_kind='plantain_cooked' and not coalesce((q.profile->>'candidate_eligible')::boolean,false)),
  'composite_fill_roles_nonempty',count(*) filter(where q.expected_kind='composite' and cardinality(coalesce(q.fill_roles,'{}'::text[]))<>0),
  'deterministic_missing',count(*) filter(where q.display_name is not null and nullif(q.profile #>> '{deterministic,profile_code}','') is null),
  'formules_completes_installees',(select count(*) from public.mt_food_structure_formulas_v1)>=8,
  'catalogue_profils_installe',(select count(*) from public.mt_food_deterministic_profile_catalog_v1)>0,
  'matrice_installee',(select count(*) from public.mt_food_profile_compatibility_v1)>0
) as resultat
from q cross join trig;
