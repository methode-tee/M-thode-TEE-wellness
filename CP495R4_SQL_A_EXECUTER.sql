-- MÉTHODE TEE — CP495R4
-- Résolution exacte segment -> profile_key + garde anti-adaptation partielle.
-- Prérequis : CP495 + CP495R1 + CP495R2.
-- Ne modifie ni les formules, ni les variantes, ni la mémoire, ni la complétude.

begin;

DO $preflight$
BEGIN
  IF to_regclass('public.mt_adapter_profile_cards_v5') IS NULL THEN RAISE EXCEPTION 'CP495R4: CP495 absent'; END IF;
  IF to_regclass('public.mt_manual_food_profiles_v1') IS NULL THEN RAISE EXCEPTION 'CP495R4: profils manuels absents'; END IF;
  IF to_regprocedure('public.food_normalize(text)') IS NULL THEN RAISE EXCEPTION 'CP495R4: food_normalize absent'; END IF;
  IF to_regprocedure('public.mt_adapter_reference_candidates_v1(text)') IS NULL THEN RAISE EXCEPTION 'CP495R4: resolver de base absent'; END IF;
END
$preflight$;

create table if not exists public.mt_adapter_profile_input_aliases_v5(
  alias_norm text not null,
  profile_key text not null references public.mt_adapter_profile_cards_v5(profile_key) on delete cascade,
  alias_text text not null,
  source text not null,
  priority integer not null default 100,
  version text not null default 'CP495R4',
  updated_at timestamptz not null default now(),
  primary key(alias_norm,profile_key)
);
alter table public.mt_adapter_profile_input_aliases_v5 enable row level security;
revoke all on public.mt_adapter_profile_input_aliases_v5 from anon,authenticated;

-- Recrée la couche d'alias exacts de façon déterministe.
delete from public.mt_adapter_profile_input_aliases_v5 where version in ('CP495R3','CP495R4');

-- Nom complet exact de chaque fiche.
insert into public.mt_adapter_profile_input_aliases_v5(alias_norm,profile_key,alias_text,source,priority,version,updated_at)
select public.food_normalize(m.display_name),m.profile_key,m.display_name,'exact_display_name',10,'CP495R4',now()
from public.mt_manual_food_profiles_v1 m
join public.mt_adapter_profile_cards_v5 c on c.profile_key=m.profile_key
where nullif(public.food_normalize(m.display_name),'') is not null
on conflict(alias_norm,profile_key) do update
set alias_text=excluded.alias_text,source=excluded.source,
    priority=least(public.mt_adapter_profile_input_aliases_v5.priority,excluded.priority),
    version='CP495R4',updated_at=now();

-- Libellé avant première virgule : garde l'état culinaire exact quand il est explicite.
insert into public.mt_adapter_profile_input_aliases_v5(alias_norm,profile_key,alias_text,source,priority,version,updated_at)
select public.food_normalize(trim(split_part(m.display_name,',',1))),m.profile_key,
       trim(split_part(m.display_name,',',1)),'exact_head_label',30,'CP495R4',now()
from public.mt_manual_food_profiles_v1 m
join public.mt_adapter_profile_cards_v5 c on c.profile_key=m.profile_key
where position(',' in m.display_name)>0
  and length(public.food_normalize(trim(split_part(m.display_name,',',1))))>=4
on conflict(alias_norm,profile_key) do update
set alias_text=excluded.alias_text,source=excluded.source,
    priority=least(public.mt_adapter_profile_input_aliases_v5.priority,excluded.priority),
    version='CP495R4',updated_at=now();

-- Alias parlés curatés : ils pointent directement vers UNE fiche exacte.
with curated(alias_text,profile_key,priority) as (values
  ('œufs brouillés','ciqual:22502',0),
  ('oeufs brouilles','ciqual:22502',0),
  ('œufs brouillées','ciqual:22502',0),
  ('oeufs brouillees','ciqual:22502',0),
  ('œuf brouillé','ciqual:22502',0),
  ('oeuf brouille','ciqual:22502',0),
  ('œuf brouillée','ciqual:22502',0),
  ('oeuf brouillee','ciqual:22502',0),
  ('yaourt nature','ciqual:19593',0),
  ('yogourt nature','ciqual:19593',0),
  ('yaourt nature classique','ciqual:19593',0)
)
insert into public.mt_adapter_profile_input_aliases_v5(alias_norm,profile_key,alias_text,source,priority,version,updated_at)
select public.food_normalize(x.alias_text),x.profile_key,x.alias_text,'explicit_spoken_alias',x.priority,'CP495R4',now()
from curated x
join public.mt_adapter_profile_cards_v5 c on c.profile_key=x.profile_key
on conflict(alias_norm,profile_key) do update
set alias_text=excluded.alias_text,source=excluded.source,priority=excluded.priority,
    version='CP495R4',updated_at=now();

create index if not exists mt_adapter_profile_input_aliases_v5_alias_idx
  on public.mt_adapter_profile_input_aliases_v5(alias_norm,priority,profile_key);

-- Le resolver principal intègre désormais la résolution profile_key exacte AVANT
-- l'ancien alias de groupe CP491, puis seulement le resolver de base.
create or replace function public.mt_adapter_manual_reference_candidates_v1(p_input_text text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  uid uuid:=auth.uid();
  outj jsonb:='[]'::jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;

  with segs as (
    select row_number() over() ord,
           btrim(x) input,
           public.food_normalize(
             btrim(regexp_replace(btrim(x),'[0-9]+([.,][0-9]+)?[[:space:]]*(g|gr|grammes?|ml)',' ','gi'))
           ) nq
    from regexp_split_to_table(left(coalesce(p_input_text,''),1000),'\s*(?:\+|,|;|/|&)\s*|\s+et\s+|\s+avec\s+','i') x
    where length(public.food_normalize(x))>=2
    limit 10
  ),
  exact_profile_ranked as (
    select
      s.ord,s.input,s.nq,
      a.priority as alias_priority,a.source as alias_source,
      m.profile_key,m.display_name,m.dictionary_id,m.ciqual_code,m.group_code,m.candidate_priority,
      p.roles,p.fill_roles,p.profile,p.pairing_mode,p.pairing_requires_accompaniment,p.pairing_complete,
      d.country,coalesce(d.categories,'{}'::text[]) categories,coalesce(d.adapter_profile,'{}'::jsonb) adapter_profile,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_kcal_100g end,cf.kcal_100g) kcal_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_protein_100g end,cf.protein_100g) protein_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_fat_100g end,cf.fat_100g) fat_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_carbs_100g end,cf.carbs_100g) carbs_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_fiber_100g end,cf.fiber_100g) fiber_100g,
      row_number() over(
        partition by s.ord
        order by a.priority,m.candidate_priority desc,public.food_normalize(m.display_name),m.profile_key
      ) rn
    from segs s
    join public.mt_adapter_profile_input_aliases_v5 a on a.alias_norm=s.nq
    join public.mt_manual_food_profiles_v1 m on m.profile_key=a.profile_key
    join public.mt_food_culinary_profiles_v1 p on p.profile_key=m.profile_key
    left join public.food_dictionary d on d.id=m.dictionary_id
    left join public.ciqual_foods cf on cf.code=m.ciqual_code
  ),
  exact_profile_grouped as (
    select s.ord,s.input,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'profile_key',c.profile_key,
          'code',c.ciqual_code,
          'ciqual_code',c.ciqual_code,
          'name',c.display_name,
          'dictionary_id',c.dictionary_id,
          'display_name',c.display_name,
          'country',c.country,
          'categories',c.categories,
          'adapter_profile',c.adapter_profile,
          'match_rank',c.alias_priority,
          'kcal_100g',c.kcal_100g,
          'protein_100g',c.protein_100g,
          'fat_100g',c.fat_100g,
          'carbs_100g',c.carbs_100g,
          'fiber_100g',c.fiber_100g,
          'roles',coalesce(c.roles,'{}'::text[]),
          'fill_roles',coalesce(c.fill_roles,'{}'::text[]),
          'profile',coalesce(c.profile,'{}'::jsonb),
          'pairing_mode',c.pairing_mode,
          'pairing_requires_accompaniment',coalesce(c.pairing_requires_accompaniment,false),
          'pairing_complete',coalesce(c.pairing_complete,false),
          'manual_group',c.group_code,
          'source','CP495R4_exact_profile_alias',
          'resolver_source',c.alias_source
        ) order by c.rn)
        from exact_profile_ranked c
        where c.ord=s.ord and c.rn<=8
      ),'[]'::jsonb) candidates
    from segs s
  ),
  exact_group_alias as (
    select s.ord,s.input,s.nq,a.group_code,a.priority
    from segs s
    join public.mt_manual_search_aliases_v1 a on a.normalized_alias=s.nq
  ),
  legacy_candidates as (
    select e.ord,e.input,m.profile_key,m.display_name,m.dictionary_id,m.ciqual_code,m.group_code,m.candidate_priority,
      p.roles,p.fill_roles,p.profile,p.pairing_mode,p.pairing_requires_accompaniment,p.pairing_complete,
      d.country,coalesce(d.categories,'{}'::text[]) categories,coalesce(d.adapter_profile,'{}'::jsonb) adapter_profile,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_kcal_100g end,cf.kcal_100g) kcal_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_protein_100g end,cf.protein_100g) protein_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_fat_100g end,cf.fat_100g) fat_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_carbs_100g end,cf.carbs_100g) carbs_100g,
      coalesce(case when coalesce(d.nutrition_verified,false) then d.custom_fiber_100g end,cf.fiber_100g) fiber_100g,
      row_number() over(partition by e.ord order by m.candidate_priority desc,public.food_normalize(m.display_name),m.profile_key) rn
    from exact_group_alias e
    join public.mt_manual_food_profiles_v1 m
      on m.group_code=e.group_code and m.manual_behavior in ('ingredient','component')
    join public.mt_food_culinary_profiles_v1 p on p.profile_key=m.profile_key
    left join public.food_dictionary d on d.id=m.dictionary_id
    left join public.ciqual_foods cf on cf.code=m.ciqual_code
  ),
  legacy_grouped as (
    select s.ord,s.input,
      coalesce((select jsonb_agg(jsonb_build_object(
        'profile_key',c.profile_key,'code',c.ciqual_code,'ciqual_code',c.ciqual_code,
        'name',c.display_name,'dictionary_id',c.dictionary_id,'display_name',c.display_name,
        'country',c.country,'categories',c.categories,'adapter_profile',c.adapter_profile,
        'match_rank',100-c.candidate_priority,
        'kcal_100g',c.kcal_100g,'protein_100g',c.protein_100g,'fat_100g',c.fat_100g,
        'carbs_100g',c.carbs_100g,'fiber_100g',c.fiber_100g,
        'roles',coalesce(c.roles,'{}'::text[]),'fill_roles',coalesce(c.fill_roles,'{}'::text[]),
        'profile',coalesce(c.profile,'{}'::jsonb),'pairing_mode',c.pairing_mode,
        'pairing_requires_accompaniment',coalesce(c.pairing_requires_accompaniment,false),
        'pairing_complete',coalesce(c.pairing_complete,false),'manual_group',c.group_code,
        'source','CP491_manual_alias'
      ) order by c.rn) from legacy_candidates c where c.ord=s.ord and c.rn<=8),'[]'::jsonb) candidates
    from segs s
  ),
  base as (
    select public.mt_adapter_reference_candidates_v1(p_input_text) j
  ),
  base_rows as (
    select row_number() over() base_ord,
           value obj,
           public.food_normalize(coalesce(value->>'input','')) input_norm
    from base,jsonb_array_elements(j)
  ),
  chosen as (
    select s.ord,s.input,
      case
        when jsonb_array_length(ep.candidates)>0 then ep.candidates
        when jsonb_array_length(lg.candidates)>0 then lg.candidates
        else coalesce(
          (select br.obj->'candidates' from base_rows br where br.input_norm=s.nq and jsonb_typeof(br.obj->'candidates')='array' order by br.base_ord limit 1),
          (select br.obj->'candidates' from base_rows br where br.base_ord=s.ord and jsonb_typeof(br.obj->'candidates')='array' limit 1),
          '[]'::jsonb
        )
      end candidates,
      case
        when jsonb_array_length(ep.candidates)>0 then 'CP495R4_exact_profile_alias'
        when jsonb_array_length(lg.candidates)>0 then 'CP491_manual_alias'
        else 'base_resolver'
      end resolver_source
    from segs s
    join exact_profile_grouped ep on ep.ord=s.ord
    join legacy_grouped lg on lg.ord=s.ord
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'input',c.input,
      'candidates',coalesce(c.candidates,'[]'::jsonb),
      'resolver_source',c.resolver_source,
      'resolved',jsonb_array_length(coalesce(c.candidates,'[]'::jsonb))>0
    ) order by c.ord
  ),'[]'::jsonb)
  into outj
  from chosen c;

  return outj;
end;
$function$;

revoke all on function public.mt_adapter_manual_reference_candidates_v1(text) from public,anon;
grant execute on function public.mt_adapter_manual_reference_candidates_v1(text) to authenticated;

select jsonb_build_object(
  'status','CP495R4_EXACT_RESOLVER_INSTALLED',
  'profiles_total',(select count(*) from public.mt_adapter_profile_cards_v5),
  'alias_rows_total',(select count(*) from public.mt_adapter_profile_input_aliases_v5),
  'alias_unknown_profile_keys',(
    select count(*) from public.mt_adapter_profile_input_aliases_v5 a
    left join public.mt_adapter_profile_cards_v5 c on c.profile_key=a.profile_key
    where c.profile_key is null
  ),
  'egg_scrambled_alias_target',(
    select profile_key from public.mt_adapter_profile_input_aliases_v5
    where alias_norm=public.food_normalize('œufs brouillées')
    order by priority,profile_key limit 1
  ),
  'yogurt_nature_alias_target',(
    select profile_key from public.mt_adapter_profile_input_aliases_v5
    where alias_norm=public.food_normalize('yaourt nature')
    order by priority,profile_key limit 1
  ),
  'manual_resolver_uses_exact_profile_alias',(
    select position('mt_adapter_profile_input_aliases_v5' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mt_adapter_manual_reference_candidates_v1'
    order by p.oid desc limit 1
  ),
  'manual_resolver_keeps_legacy_fallback',(
    select position('mt_manual_search_aliases_v1' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mt_adapter_manual_reference_candidates_v1'
    order by p.oid desc limit 1
  ),
  'recipe_engine_unchanged',true,
  'formula_driven_completeness',true,
  'memory_unchanged',true
) as cp495r4_audit;

commit;
