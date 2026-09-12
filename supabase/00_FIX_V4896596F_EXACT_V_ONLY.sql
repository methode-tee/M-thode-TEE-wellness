-- MÉTHODE TEE — V4896596F
-- MOTEUR V STRICT : AUCUN héritage de V par profile_code.
-- Un aliment appartient à un V uniquement lorsqu'une source culinaire documentée
-- relie CETTE fiche précise à ce V.
-- Sources utilisées :
--   1) catalogue des 300 repas TEE, composants CIQUAL résolus précisément ;
--   2) groupes KNOW déjà résolus vers exact_profile_key.
-- Les anciens V_COMP profil-à-profil sont désactivés pour Adapter mon repas.
-- Relançable. Un seul fichier.

begin;

do $preflight$
begin
  if to_regclass('public.mt_food_v_groups_v1') is null
     or to_regclass('public.mt_food_v_group_profiles_v1') is null
     or to_regclass('public.mt_food_v_memberships_v1') is null
     or to_regclass('public.mt_food_culinary_profiles_v1') is null
     or to_regclass('public.mt_curated_meals_v2') is null
     or to_regclass('public.mt_curated_meal_components_v2') is null then
    raise exception 'V4896596F : moteur V et catalogue culinaire requis';
  end if;
end
$preflight$;

-- Les matrices génériques profile->profile ne sont plus une source de vérité V.
update public.mt_food_v_groups_v1
set enabled=false,version='V4896596F',updated_at=now()
where group_kind='compatibility';

-- Repartir uniquement des appartenances exactes documentées.
delete from public.mt_food_v_memberships_v1;

-- 1) V_MAIN : la fiche exacte résolue dans le catalogue 300 repas.
with resolved_main as (
  select distinct
    p.profile_key,
    g.v_code,
    case
      when c.expected_role in ('protein','protein_plant','dairy_protein') then 'protein'
      when c.expected_role='starch' then 'starch'
      when c.expected_role='vegetable' then 'vegetable'
      else null
    end as role,
    coalesce(p.profile #>> '{deterministic,profile_code}',p.v_profile_code,'') as profile_code,
    c.required,
    case when c.resolution_status='manual' then 180 else 170 end::numeric as weight
  from public.mt_curated_meal_components_v2 c
  join public.mt_curated_meals_v2 cm on cm.meal_code=c.meal_code
  join public.mt_food_v_groups_v1 g
    on g.group_kind='main_meal' and g.source_key=c.meal_code
  join public.mt_food_culinary_profiles_v1 p
    on nullif(c.ciqual_code,'') is not null
   and p.ciqual_code::text=c.ciqual_code
  where g.enabled
    and cm.enabled
    and c.resolution_status in ('resolved_high','manual')
    and c.expected_role in ('protein','protein_plant','dairy_protein','starch','vegetable')
)
insert into public.mt_food_v_memberships_v1(
  profile_key,v_code,role,profile_code,required,weight,source,version
)
select profile_key,v_code,role,profile_code,required,weight,'exact_curated','V4896596F'
from resolved_main
where role is not null
on conflict(profile_key,v_code,role) do update set
  profile_code=excluded.profile_code,
  required=excluded.required,
  weight=greatest(public.mt_food_v_memberships_v1.weight,excluded.weight),
  source='exact_curated',
  version='V4896596F';

-- 2) V_KNOW : uniquement les fiches explicitement résolues vers exact_profile_key.
insert into public.mt_food_v_memberships_v1(
  profile_key,v_code,role,profile_code,required,weight,source,version
)
select distinct
  gp.exact_profile_key,
  gp.v_code,
  gp.role,
  coalesce(p.profile #>> '{deterministic,profile_code}',p.v_profile_code,gp.profile_code,''),
  gp.required,
  greatest(gp.weight,175),
  'exact_knowledge',
  'V4896596F'
from public.mt_food_v_group_profiles_v1 gp
join public.mt_food_v_groups_v1 g on g.v_code=gp.v_code
join public.mt_food_culinary_profiles_v1 p on p.profile_key=gp.exact_profile_key
where g.enabled
  and g.group_kind like 'knowledge%'
  and gp.exact_profile_key<>''
on conflict(profile_key,v_code,role) do update set
  profile_code=excluded.profile_code,
  required=excluded.required,
  weight=greatest(public.mt_food_v_memberships_v1.weight,excluded.weight),
  source=case when public.mt_food_v_memberships_v1.source='exact_curated' then public.mt_food_v_memberships_v1.source else 'exact_knowledge' end,
  version='V4896596F';

-- Synchroniser chaque fiche. Un aliment non documenté garde simplement zéro V.
update public.mt_food_culinary_profiles_v1 p
set v_profile_code=coalesce(p.profile #>> '{deterministic,profile_code}',p.v_profile_code),
    v_roles=public.mt_jsonb_text_array_v1(coalesce(p.profile #> '{deterministic,structural_roles}','[]'::jsonb)),
    v_groups=coalesce((
      select array_agg(distinct m.v_code order by m.v_code)
      from public.mt_food_v_memberships_v1 m
      where m.profile_key=p.profile_key
    ),'{}'::text[]),
    v_engine_version='V4896596F';

-- RPC : uniquement intersection des appartenances exactes.
create or replace function public.mt_adapter_v_engine_v1(
  p_selected_refs jsonb default '[]'::jsonb,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  j jsonb; rec record; cand record;
  selected jsonb:='[]'::jsonb; suggestions jsonb:='[]'::jsonb;
  selected_keys text[]:='{}'::text[];
  present text[]:='{}'::text[]; all_roles text[]:='{}'::text[];
  missing text[]:='{}'::text[];
  role_key text; complete_main boolean:=false; sweet_signal boolean:=false;
  g_v_code text:=null; g_group_kind text:=null; g_title text:=null; g_source_type text:=null;
  g_country text:=null; g_cuisine_family text:=null; g_confidence numeric:=null;
  status text:='ok'; composite_guard boolean:=false;
begin
  if uid is null then raise exception 'auth required'; end if;

  for j in select value from jsonb_array_elements(coalesce(p_selected_refs,'[]'::jsonb)) loop
    if coalesce((j->>'unknown')::boolean,false) then continue; end if;

    select p.* into rec
    from public.mt_food_culinary_profiles_v1 p
    where (nullif(j->>'dictionary_id','') is not null and p.dictionary_id=nullif(j->>'dictionary_id','')::uuid)
       or (nullif(j->>'code','') is not null and p.ciqual_code::text=nullif(j->>'code',''))
    order by
      (case when nullif(j->>'dictionary_id','') is not null and p.dictionary_id=nullif(j->>'dictionary_id','')::uuid then 0 else 1 end),
      coalesce(p.locked,false) desc,p.profile_key
    limit 1;

    if not found then continue; end if;

    selected_keys:=public.mt_text_array_distinct_v6594(array_append(selected_keys,rec.profile_key));
    present:=public.mt_text_array_distinct_v6594(present||public.mt_jsonb_text_array_v1(coalesce(rec.profile #> '{deterministic,structural_roles}','[]'::jsonb)));
    all_roles:=public.mt_text_array_distinct_v6594(all_roles||coalesce(rec.roles,'{}'::text[]));
    composite_guard:=composite_guard or coalesce((rec.profile #>> '{deterministic,composite}')::boolean,false);

    selected:=selected||jsonb_build_array(jsonb_build_object(
      'profile_key',rec.profile_key,
      'dictionary_id',rec.dictionary_id,
      'ciqual_code',rec.ciqual_code,
      'code',rec.ciqual_code,
      'name',rec.display_name,
      'display_name',rec.display_name,
      'roles',coalesce(rec.roles,'{}'::text[]),
      'fill_roles',coalesce(rec.fill_roles,'{}'::text[]),
      'profile',coalesce(rec.profile,'{}'::jsonb),
      'deterministic_profile_code',coalesce(rec.profile #>> '{deterministic,profile_code}',rec.v_profile_code),
      'v_groups',coalesce((
        select to_jsonb(array_agg(m.v_code order by m.v_code))
        from public.mt_food_v_memberships_v1 m where m.profile_key=rec.profile_key
      ),'[]'::jsonb)
    ));
  end loop;

  if cardinality(selected_keys)=0 then
    return jsonb_build_object('active',false,'engine_version','V4896596F','status','no_selected_profile');
  end if;

  complete_main:='protein'=any(present) and 'starch'=any(present) and 'vegetable'=any(present);
  sweet_signal:=all_roles && array['sweet','fruit','fat','nuts_seeds','aromatic']::text[];

  if complete_main then
    missing:='{}'::text[];
    status:='complete';
  else
    missing:=array_remove(array[
      case when not ('protein'=any(present)) then 'protein' end,
      case when not ('starch'=any(present)) then 'starch' end,
      case when not ('vegetable'=any(present)) then 'vegetable' end
    ]::text[],null);
  end if;

  if not complete_main then
    -- Un V est recevable seulement si TOUS les aliments sélectionnés y sont membres exactement.
    select q.v_code,q.group_kind,q.title,q.source_type,q.country,q.cuisine_family,q.confidence
    into g_v_code,g_group_kind,g_title,g_source_type,g_country,g_cuisine_family,g_confidence
    from (
      select g.*,sum(m.weight) as weight_sum
      from public.mt_food_v_groups_v1 g
      join public.mt_food_v_memberships_v1 m
        on m.v_code=g.v_code and m.profile_key=any(selected_keys)
      where g.enabled
        and (
          (sweet_signal and g.group_kind='knowledge_sweet')
          or g.group_kind in ('main_meal','knowledge_cultural')
          or (not sweet_signal and g.group_kind like 'knowledge%' and g.group_kind<>'knowledge_sweet')
        )
        and not exists (
          select 1 from unnest(missing) mr
          where not exists (
            select 1
            from public.mt_food_v_memberships_v1 mx
            join public.mt_food_culinary_profiles_v1 px on px.profile_key=mx.profile_key
            where mx.v_code=g.v_code
              and mx.role=mr
              and not (mx.profile_key=any(selected_keys))
              and coalesce((px.profile #>> '{deterministic,candidate_eligible}')::boolean,false)=true
              and coalesce((px.profile #>> '{deterministic,composite}')::boolean,false)=false
          )
        )
      group by g.v_code,g.group_kind,g.title,g.source_type,g.source_key,g.country,g.cuisine_family,g.confidence,g.enabled,g.version,g.updated_at
      having count(distinct m.profile_key)=cardinality(selected_keys)
      order by
        case g.group_kind when 'knowledge_cultural' then 0 when 'main_meal' then 1 when 'knowledge_sweet' then 2 else 3 end,
        weight_sum desc,g.confidence desc,g.v_code
      limit 1
    ) q;
  end if;

  if complete_main then
    g_group_kind:='main_meal';
  elsif g_v_code is null then
    status:='no_common_v';
  end if;

  if g_v_code is not null and not complete_main then
    foreach role_key in array missing loop
      select p.*,m.weight into cand
      from public.mt_food_v_memberships_v1 m
      join public.mt_food_culinary_profiles_v1 p on p.profile_key=m.profile_key
      left join public.food_dictionary d on d.id=p.dictionary_id
      where m.v_code=g_v_code
        and m.role=role_key
        and not (p.profile_key=any(selected_keys))
        and coalesce((p.profile #>> '{deterministic,candidate_eligible}')::boolean,false)=true
        and coalesce((p.profile #>> '{deterministic,composite}')::boolean,false)=false
      order by m.weight desc,coalesce(d.priority,100) desc,p.display_name
      limit 1;

      if found then
        suggestions:=suggestions||jsonb_build_array(jsonb_build_object(
          'role',role_key,
          'profile_key',cand.profile_key,
          'dictionary_id',cand.dictionary_id,
          'ciqual_code',cand.ciqual_code,
          'code',cand.ciqual_code,
          'name',cand.display_name,
          'display_name',cand.display_name,
          'deterministic_profile_code',coalesce(cand.profile #>> '{deterministic,profile_code}',cand.v_profile_code),
          'v_code',g_v_code
        ));
      end if;
    end loop;

    -- Ne jamais prétendre avoir complété si un rôle demandé n'a pas de suggestion exacte.
    if jsonb_array_length(suggestions)<cardinality(missing) then
      suggestions:='[]'::jsonb;
      status:='no_common_v';
      g_v_code:=null; g_group_kind:=null; g_title:=null; g_source_type:=null;
      g_country:=null; g_cuisine_family:=null; g_confidence:=null;
    end if;
  end if;

  return jsonb_build_object(
    'active',true,
    'engine_version','V4896596F',
    'mode','v_exact_only',
    'status',status,
    'selected_items',selected,
    'present_roles',to_jsonb(present),
    'all_roles',to_jsonb(all_roles),
    'missing_roles',to_jsonb(missing),
    'complete',status='complete',
    'composite_guard',composite_guard and g_v_code is null,
    'selected_group',case when g_v_code is null then null else jsonb_build_object(
      'v_code',g_v_code,'group_kind',g_group_kind,'title',g_title,'source_type',g_source_type,
      'country',g_country,'cuisine_family',g_cuisine_family,'confidence',g_confidence
    ) end,
    'group_kind',g_group_kind,
    'suggestions',suggestions
  );
end;
$$;

revoke all on function public.mt_adapter_v_engine_v1(jsonb,integer) from public,anon;
grant execute on function public.mt_adapter_v_engine_v1(jsonb,integer) to authenticated;

commit;

-- AUDIT : cette version ASSUME volontairement zéro héritage par profil.
select jsonb_build_object(
  'status','V4896596F_AUDIT',
  'profiles_total',(select count(*) from public.mt_food_culinary_profiles_v1),
  'foods_with_exact_v',(select count(*) from public.mt_food_culinary_profiles_v1 where cardinality(v_groups)>0),
  'foods_without_exact_v',(select count(*) from public.mt_food_culinary_profiles_v1 where cardinality(v_groups)=0),
  'memberships_total',(select count(*) from public.mt_food_v_memberships_v1),
  'non_exact_memberships',(select count(*) from public.mt_food_v_memberships_v1 where source not in ('exact_curated','exact_knowledge')),
  'enabled_compatibility_groups',(select count(*) from public.mt_food_v_groups_v1 where group_kind='compatibility' and enabled),
  'max_v_groups_per_food',(select coalesce(max(cardinality(v_groups)),0) from public.mt_food_culinary_profiles_v1),
  'foods_over_20_v',(select count(*) from public.mt_food_culinary_profiles_v1 where cardinality(v_groups)>20),
  'complete_meal_groups_with_3_roles',(
    select count(*) from public.mt_food_v_groups_v1 g
    where g.enabled and g.group_kind='main_meal'
      and exists(select 1 from public.mt_food_v_memberships_v1 m where m.v_code=g.v_code and m.role='protein')
      and exists(select 1 from public.mt_food_v_memberships_v1 m where m.v_code=g.v_code and m.role='starch')
      and exists(select 1 from public.mt_food_v_memberships_v1 m where m.v_code=g.v_code and m.role='vegetable')
  )
) as resultat;

select display_name,v_profile_code,v_roles,cardinality(v_groups) as v_count,v_groups[1:12] as v_sample
from public.mt_food_culinary_profiles_v1
where lower(display_name) like 'alloco%'
   or lower(display_name) like 'burger au poulet%'
   or lower(display_name) like 'fajita au poulet%'
   or lower(display_name) like 'chop suey%'
   or lower(display_name) like 'coeur, poulet%'
   or lower(display_name) like 'courgette, chair et peau, crue%'
order by display_name;
