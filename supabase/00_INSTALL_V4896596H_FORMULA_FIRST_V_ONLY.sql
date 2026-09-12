-- MÉTHODE TEE — V4896596H
-- Adapter V-only : FORMULE D'ABORD, V ENSUITE.
--
-- Règle stricte repas principal :
--   protein                  -> manque starch + vegetable
--   starch                   -> manque protein + vegetable
--   vegetable                -> manque protein + starch
--   protein + starch         -> manque vegetable
--   protein + vegetable      -> manque starch
--   starch + vegetable       -> manque protein
--   protein + starch + vegetable -> COMPLET, aucun V commun exigé, aucun ajout.
--
-- Le V n'a qu'un rôle : choisir les aliments compatibles pour les rôles manquants.
-- Il ne décide plus de la formule du repas principal.
-- Les plats préparés/composés protégés ne sont jamais forcés dans la formule.
-- Aucun héritage par profile_code, aucune IA, aucun ancien moteur de pairing.

begin;

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
  present_structural text[]:='{}'::text[];
  main_present text[]:='{}'::text[];
  required_roles text[]:='{}'::text[];
  present_group_roles text[]:='{}'::text[];
  missing text[]:='{}'::text[];
  role_key text;
  formula_signature text:=null;
  formula_source text:=null;
  selected_formula jsonb:=null;
  g_v_code text:=null; g_group_kind text:=null; g_title text:=null; g_source_type text:=null;
  g_country text:=null; g_cuisine_family text:=null; g_confidence numeric:=null;
  status text:='ok'; composite_guard boolean:=false;
  main_formula_active boolean:=false;
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
    present_structural:=public.mt_text_array_distinct_v6594(
      present_structural||public.mt_jsonb_text_array_v1(coalesce(rec.profile #> '{deterministic,structural_roles}','[]'::jsonb))
    );

    -- Garde composite : identité déterministe OU V_SELF créé comme protection de plat préparé.
    composite_guard:=composite_guard
      or coalesce((rec.profile #>> '{deterministic,composite}')::boolean,false)
      or coalesce(rec.pairing_complete,false)
      or exists (
        select 1
        from public.mt_food_v_memberships_v1 mm
        join public.mt_food_v_groups_v1 gg on gg.v_code=mm.v_code
        where mm.profile_key=rec.profile_key
          and gg.enabled
          and gg.source_type='exact_self_prepared_v6596g'
      );

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
    return jsonb_build_object('active',false,'engine_version','V4896596H','status','no_selected_profile');
  end if;

  -- Ordre canonique des trois rôles structurels du repas principal.
  select coalesce(array_agg(x.role order by x.ord),'{}'::text[])
  into main_present
  from (
    select 1 ord,'protein'::text role where 'protein'=any(present_structural)
    union all
    select 2,'starch' where 'starch'=any(present_structural)
    union all
    select 3,'vegetable' where 'vegetable'=any(present_structural)
  ) x;

  main_formula_active:=cardinality(main_present)>0 and not composite_guard;

  -- 1) PLAT COMPOSÉ : on protège immédiatement. Aucune formule principale n'est lancée.
  if composite_guard then
    status:='protected_composite';
    required_roles:='{}'::text[];
    missing:='{}'::text[];
    formula_source:='composite_guard_v1';
    selected_formula:=jsonb_build_object('type','protected_composite','missing_roles','[]'::jsonb);

  -- 2) REPAS PRINCIPAL : formule fixe AVANT toute recherche de V.
  elsif main_formula_active then
    required_roles:=array['protein','starch','vegetable']::text[];
    present_group_roles:=main_present;

    select coalesce(array_agg(x.role order by x.ord),'{}'::text[])
    into missing
    from (
      select 1 ord,'protein'::text role where not ('protein'=any(main_present))
      union all
      select 2,'starch' where not ('starch'=any(main_present))
      union all
      select 3,'vegetable' where not ('vegetable'=any(main_present))
    ) x;

    formula_signature:=array_to_string(main_present,'+');
    formula_source:='fixed_main_role_formula_v1';
    selected_formula:=jsonb_build_object(
      'type','main_meal_fixed_roles',
      'present_roles',to_jsonb(main_present),
      'required_roles',to_jsonb(required_roles),
      'missing_roles',to_jsonb(missing)
    );

    -- POINT CRITIQUE : si les 3 rôles sont présents, on s'arrête ici.
    -- Aucun V commun n'est exigé et aucun aliment ne peut être ajouté.
    if cardinality(missing)=0 then
      status:='complete';

    else
      -- Le V intervient seulement MAINTENANT pour remplir les rôles manquants.
      select q.v_code,q.group_kind,q.title,q.source_type,q.country,q.cuisine_family,q.confidence
      into g_v_code,g_group_kind,g_title,g_source_type,g_country,g_cuisine_family,g_confidence
      from (
        select
          g.v_code,g.group_kind,g.title,g.source_type,g.country,g.cuisine_family,g.confidence,
          coalesce(sum(sm.weight),0) as selected_weight
        from public.mt_food_v_groups_v1 g
        join public.mt_food_v_memberships_v1 sm
          on sm.v_code=g.v_code and sm.profile_key=any(selected_keys)
        where g.enabled
          and g.group_kind<>'exact_self'
        group by g.v_code,g.group_kind,g.title,g.source_type,g.country,g.cuisine_family,g.confidence
        having count(distinct sm.profile_key)=cardinality(selected_keys)
           and not exists (
             select 1
             from unnest(missing) miss(role)
             where not exists (
               select 1
               from public.mt_food_v_memberships_v1 mx
               join public.mt_food_culinary_profiles_v1 px on px.profile_key=mx.profile_key
               where mx.v_code=g.v_code
                 and mx.role=miss.role
                 and not (mx.profile_key=any(selected_keys))
                 and coalesce((px.profile #>> '{deterministic,composite}')::boolean,false)=false
                 and coalesce((px.profile #>> '{deterministic,candidate_eligible}')::boolean,false)=true
                 -- Ne jamais auto-proposer cru / abats pour les rôles principaux.
                 and not (
                   miss.role in ('protein','starch')
                   and public.food_normalize(coalesce(px.display_name,'')) ~ '(^| )(cru|crue|crus|crues)( |$)'
                 )
                 and not (
                   miss.role='protein'
                   and public.food_normalize(coalesce(px.display_name,'')) ~ '(coeur|cœur|foie|gesier|gésier|abats|rognon|langue|tripes|cervelle)'
                 )
             )
           )
        order by
          case g.group_kind
            when 'knowledge_cultural' then 0
            when 'main_meal' then 1
            when 'exact_main' then 2
            when 'knowledge_other' then 3
            else 5
          end,
          selected_weight desc,
          g.confidence desc,
          g.v_code
        limit 1
      ) q;

      if g_v_code is null then
        status:='no_common_v';
      else
        foreach role_key in array missing loop
          select p.*,m.weight into cand
          from public.mt_food_v_memberships_v1 m
          join public.mt_food_culinary_profiles_v1 p on p.profile_key=m.profile_key
          left join public.food_dictionary d on d.id=p.dictionary_id
          where m.v_code=g_v_code
            and m.role=role_key
            and not (p.profile_key=any(selected_keys))
            and coalesce((p.profile #>> '{deterministic,composite}')::boolean,false)=false
            and coalesce((p.profile #>> '{deterministic,candidate_eligible}')::boolean,false)=true
            and not (
              role_key in ('protein','starch')
              and public.food_normalize(coalesce(p.display_name,'')) ~ '(^| )(cru|crue|crus|crues)( |$)'
            )
            and not (
              role_key='protein'
              and public.food_normalize(coalesce(p.display_name,'')) ~ '(coeur|cœur|foie|gesier|gésier|abats|rognon|langue|tripes|cervelle)'
            )
          order by m.weight desc,coalesce(d.priority,0) desc,p.display_name
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

        if jsonb_array_length(suggestions)=cardinality(missing) then
          status:='ok';
        else
          suggestions:='[]'::jsonb;
          status:='no_common_v';
          g_v_code:=null; g_group_kind:=null; g_title:=null; g_source_type:=null;
          g_country:=null; g_cuisine_family:=null; g_confidence:=null;
        end if;
      end if;
    end if;

  -- 3) HORS FORMULE PRINCIPALE : liste fermée V uniquement, sans forcer P+F+V.
  else
    formula_source:='v_group_non_main_v1';

    select
      q.v_code,q.group_kind,q.title,q.source_type,q.country,q.cuisine_family,q.confidence,
      q.required_roles,q.present_roles,q.missing_roles
    into
      g_v_code,g_group_kind,g_title,g_source_type,g_country,g_cuisine_family,g_confidence,
      required_roles,present_group_roles,missing
    from (
      select
        g.v_code,g.group_kind,g.title,g.source_type,g.country,g.cuisine_family,g.confidence,
        coalesce(rr.roles,'{}'::text[]) as required_roles,
        coalesce(pr.roles,'{}'::text[]) as present_roles,
        coalesce(mr.roles,'{}'::text[]) as missing_roles,
        coalesce(sum(sm.weight),0) as selected_weight
      from public.mt_food_v_groups_v1 g
      join public.mt_food_v_memberships_v1 sm
        on sm.v_code=g.v_code and sm.profile_key=any(selected_keys)
      left join lateral (
        select array_agg(distinct m.role order by m.role) as roles
        from public.mt_food_v_memberships_v1 m
        where m.v_code=g.v_code and m.required
      ) rr on true
      left join lateral (
        select array_agg(distinct m.role order by m.role) as roles
        from public.mt_food_v_memberships_v1 m
        where m.v_code=g.v_code and m.profile_key=any(selected_keys)
      ) pr on true
      left join lateral (
        select array_agg(x.role order by x.role) as roles
        from (
          select unnest(coalesce(rr.roles,'{}'::text[])) as role
          except
          select unnest(coalesce(pr.roles,'{}'::text[])) as role
        ) x
      ) mr on true
      where g.enabled
      group by g.v_code,g.group_kind,g.title,g.source_type,g.country,g.cuisine_family,g.confidence,
               rr.roles,pr.roles,mr.roles
      having count(distinct sm.profile_key)=cardinality(selected_keys)
      order by
        case g.group_kind
          when 'knowledge_sweet' then 0
          when 'knowledge_cultural' then 1
          when 'knowledge_other' then 2
          when 'exact_self' then 8
          else 5
        end,
        coalesce(array_length(mr.roles,1),0),
        selected_weight desc,
        g.confidence desc,
        g.v_code
      limit 1
    ) q;

    selected_formula:=jsonb_build_object(
      'type','non_main_v_group',
      'required_roles',to_jsonb(required_roles),
      'missing_roles',to_jsonb(missing)
    );

    if g_v_code is null then
      status:='no_common_v';
      missing:='{}'::text[];
    elsif cardinality(missing)=0 then
      status:='complete';
    else
      foreach role_key in array missing loop
        select p.*,m.weight into cand
        from public.mt_food_v_memberships_v1 m
        join public.mt_food_culinary_profiles_v1 p on p.profile_key=m.profile_key
        left join public.food_dictionary d on d.id=p.dictionary_id
        where m.v_code=g_v_code
          and m.role=role_key
          and not (p.profile_key=any(selected_keys))
          and coalesce((p.profile #>> '{deterministic,composite}')::boolean,false)=false
        order by m.weight desc,coalesce(d.priority,0) desc,p.display_name
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

      if jsonb_array_length(suggestions)=cardinality(missing) then
        status:='ok';
      else
        suggestions:='[]'::jsonb;
        status:='no_common_v';
        g_v_code:=null; g_group_kind:=null; g_title:=null; g_source_type:=null;
        g_country:=null; g_cuisine_family:=null; g_confidence:=null;
        missing:='{}'::text[];
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'active',true,
    'engine_version','V4896596H',
    'mode','v_exact_formula_first',
    'status',status,
    'selected_items',selected,
    'present_roles',to_jsonb(present_structural),
    'main_present_roles',to_jsonb(main_present),
    'group_present_roles',to_jsonb(present_group_roles),
    'required_roles',to_jsonb(required_roles),
    'missing_roles',to_jsonb(missing),
    'role_signature',formula_signature,
    'formula_source',formula_source,
    'selected_formula',selected_formula,
    'complete',status='complete',
    'composite_guard',composite_guard,
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

-- Audit d'installation uniquement : ne modifie aucune donnée V.
select jsonb_build_object(
  'status','V4896596H_INSTALLED',
  'rpc_exists',to_regprocedure('public.mt_adapter_v_engine_v1(jsonb,integer)') is not null,
  'foods_without_exact_v',(select count(*) from public.mt_food_culinary_profiles_v1 where cardinality(coalesce(v_groups,'{}'::text[]))=0),
  'non_exact_memberships',(
    select count(*) from public.mt_food_v_memberships_v1
    where source not in ('exact_curated','exact_knowledge','exact_expanded','exact_self')
  ),
  'identity_mismatches',(
    select count(*) from public.mt_food_culinary_profiles_v1 p
    where p.v_profile_code is distinct from coalesce(p.profile #>> '{deterministic,profile_code}',p.v_profile_code)
       or p.v_roles is distinct from public.mt_jsonb_text_array_v1(coalesce(p.profile #> '{deterministic,structural_roles}','[]'::jsonb))
  ),
  'engine_rule','roles -> fixed formula -> V intersection -> exact candidates'
) as resultat;
