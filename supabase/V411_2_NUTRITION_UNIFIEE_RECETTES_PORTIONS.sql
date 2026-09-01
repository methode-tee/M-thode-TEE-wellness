-- MÉTHODE TEE — PATCH V411.2
-- NUTRITION UNIFIÉE · RECETTES STRUCTURÉES · PORTIONS · SNAPSHOTS IMMUTABLES
--
-- À exécuter UNE seule fois dans Supabase SQL Editor avant d'uploader les fichiers front.
--
-- Principes :
-- 1) un seul résolveur nutritionnel pour CIQUAL, food_dictionary, recettes,
--    smoothies et snapshots historiques ;
-- 2) un repas déjà enregistré reste figé : aucune valeur absente n'est remplie
--    rétroactivement depuis une référence plus récente ;
-- 3) les recettes Méthode Tee peuvent recevoir des ingrédients structurés + grammes,
--    puis un snapshot nutritionnel par portion ;
-- 4) les portions naturelles sont centralisables et traçables ; les anciens repères
--    UX sont conservés comme ESTIMATIONS, pas comme données scientifiques ;
-- 5) une donnée inconnue reste inconnue. Jamais de faux zéro.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- PRÉFLIGHT
-- -----------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.ciqual_foods') is null
     or to_regclass('public.ciqual_food_nutrients') is null
     or to_regclass('public.food_dictionary') is null
     or to_regclass('public.food_meals') is null
     or to_regclass('public.food_meal_items') is null
     or to_regclass('public.recipes') is null
     or to_regclass('public.recipe_purchases') is null
     or to_regclass('public.botanical_blends') is null
     or to_regclass('public.botanical_blend_nutrition_snapshots') is null then
    raise exception 'Tables nutrition/recettes attendues introuvables. Les lots smoothies précédents doivent être installés avant V411.2.';
  end if;

  if to_regprocedure('public.food_normalize(text)') is null then
    raise exception 'Fonction public.food_normalize(text) introuvable.';
  end if;

  if to_regprocedure('public.mt_nutrition_extra_num(jsonb,text)') is null then
    raise exception 'Fonction public.mt_nutrition_extra_num(jsonb,text) introuvable.';
  end if;
end
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. PORTIONS NATURELLES CENTRALISÉES
-- -----------------------------------------------------------------------------
create table if not exists public.food_portion_profiles (
  id uuid primary key default gen_random_uuid(),
  ciqual_code text references public.ciqual_foods(code) on delete cascade,
  food_dictionary_id uuid references public.food_dictionary(id) on delete cascade,
  name_pattern text,
  match_mode text not null default 'contains'
    check (match_mode in ('exact','prefix','contains')),
  unit_label text not null,
  grams_per_unit numeric not null check (grams_per_unit > 0),
  default_amount numeric not null default 1 check (default_amount > 0),
  step numeric not null default 1 check (step > 0),
  min_amount numeric not null default 0.5 check (min_amount > 0),
  estimated boolean not null default true,
  verified boolean not null default false,
  source_label text,
  notes text,
  priority integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ciqual_code is not null or food_dictionary_id is not null or nullif(btrim(name_pattern),'') is not null)
);

create index if not exists food_portion_profiles_ciqual_idx
  on public.food_portion_profiles(ciqual_code) where enabled;
create index if not exists food_portion_profiles_dictionary_idx
  on public.food_portion_profiles(food_dictionary_id) where enabled;
create index if not exists food_portion_profiles_priority_idx
  on public.food_portion_profiles(priority,id) where enabled;

alter table public.food_portion_profiles enable row level security;
drop policy if exists "food portion profiles read" on public.food_portion_profiles;
drop policy if exists "food portion profiles admin" on public.food_portion_profiles;
create policy "food portion profiles read"
  on public.food_portion_profiles for select to authenticated using (enabled or public.is_admin());
create policy "food portion profiles admin"
  on public.food_portion_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.food_portion_profiles to authenticated;

-- On reprend strictement les repères UX déjà présents dans V411.
-- Ils restent marqués estimated=true / verified=false.
with seed(name_pattern,match_mode,unit_label,grams_per_unit,default_amount,step,min_amount,priority) as (
  values
    ('burger','contains','burger',220,1,0.5,0.5,60),
    ('hamburger','contains','burger',220,1,0.5,0.5,60),
    ('œuf','contains','œuf',60,1,1,1,50),
    ('oeuf','contains','œuf',60,1,1,1,50),
    ('banane','contains','banane',120,1,0.5,0.5,50),
    ('avocat','contains','avocat',150,0.5,0.5,0.5,50),
    ('yaourt','contains','pot',125,1,1,1,50),
    ('yogourt','contains','pot',125,1,1,1,50),
    ('skyr','contains','pot',125,1,1,1,50),
    ('pain de mie','contains','tranche',30,1,1,1,50),
    ('toast','contains','tranche',30,1,1,1,55),
    ('pomme','contains','pomme',150,1,0.5,0.5,70),
    ('orange','contains','orange',150,1,0.5,0.5,70),
    ('kiwi','contains','kiwi',75,1,1,1,70)
)
insert into public.food_portion_profiles(
  name_pattern,match_mode,unit_label,grams_per_unit,default_amount,step,min_amount,
  estimated,verified,source_label,notes,priority
)
select
  s.name_pattern,s.match_mode,s.unit_label,s.grams_per_unit,s.default_amount,s.step,s.min_amount,
  true,false,'Méthode Tee — repères UX historiques V411',
  'Repère d’interface conservé sans le présenter comme poids réglementaire ou universel.',s.priority
from seed s
where not exists (
  select 1 from public.food_portion_profiles p
  where p.ciqual_code is null and p.food_dictionary_id is null
    and public.food_normalize(p.name_pattern)=public.food_normalize(s.name_pattern)
    and p.unit_label=s.unit_label
);

create or replace function public.mt_portion_profile(
  p_name text,
  p_ciqual_code text default null,
  p_dictionary_id uuid default null
)
returns jsonb
language sql stable security invoker set search_path=public
as $$
  with q as (
    select p.*,
      case
        when p_ciqual_code is not null and p.ciqual_code=p_ciqual_code then 0
        when p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id then 1
        when p.match_mode='exact' and public.food_normalize(p_name)=public.food_normalize(p.name_pattern) then 10
        when p.match_mode='prefix' and public.food_normalize(p_name) like public.food_normalize(p.name_pattern)||'%' then 20
        when p.match_mode='contains' and public.food_normalize(p_name) like '%'||public.food_normalize(p.name_pattern)||'%' then 30
        else 999
      end as rank
    from public.food_portion_profiles p
    where p.enabled
  )
  select jsonb_build_object(
    'id',id,'unit',unit_label,'grams_per_unit',grams_per_unit,
    'default_amount',default_amount,'step',step,'min',min_amount,
    'estimated',estimated,'verified',verified,'source_label',source_label,
    'notes',notes
  )
  from q
  where rank<999
  order by rank,priority,id
  limit 1;
$$;
grant execute on function public.mt_portion_profile(text,text,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. HELPERS NUTRITION
-- -----------------------------------------------------------------------------
create or replace function public.mt_nutrition_json_num(p_values jsonb,p_key text)
returns numeric
language plpgsql immutable parallel safe
as $$
declare raw text;
begin
  if p_values is null or p_key is null or not (p_values ? p_key) then return null; end if;
  if jsonb_typeof(p_values->p_key)='number' then raw:=p_values->>p_key;
  elsif jsonb_typeof(p_values->p_key)='object' then raw:=nullif(trim(p_values->p_key->>'value'),'');
  else return null;
  end if;
  if raw is null or raw !~ '^-?[0-9]+([.,][0-9]+)?$' then return null; end if;
  return replace(raw,',','.')::numeric;
exception when others then return null;
end;
$$;

-- Référence alimentaire vivante : dictionary vérifié > CIQUAL lié > CIQUAL direct.
create or replace function public.mt_nutrition_reference(
  p_ciqual_code text default null,
  p_dictionary_id uuid default null
)
returns jsonb
language plpgsql stable security invoker set search_path=public
as $$
declare
  d public.food_dictionary%rowtype;
  c public.ciqual_foods%rowtype;
  v_code text;
  v_name text;
  v_verified boolean := false;
  v_extra jsonb := '{}'::jsonb;
  v_micro jsonb := '{}'::jsonb;
  v_source text;
  v_kind text;
  v_kcal numeric; v_protein numeric; v_fat numeric; v_carbs numeric; v_fiber numeric; v_salt numeric;
begin
  if p_dictionary_id is not null then
    select * into d from public.food_dictionary
    where id=p_dictionary_id and (enabled or public.is_admin());
    if found then
      v_verified:=coalesce(d.nutrition_verified,false);
      v_code:=coalesce(d.ciqual_code,p_ciqual_code);
      if v_code is not null then select * into c from public.ciqual_foods where code=v_code; end if;
      v_name:=coalesce(d.display_name,d.canonical_name,c.name);
      v_kcal:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_kcal_100g end,c.kcal_100g);
      v_protein:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_protein_100g end,c.protein_100g);
      v_fat:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_fat_100g end,c.fat_100g);
      v_carbs:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_carbs_100g end,c.carbs_100g);
      v_fiber:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_fiber_100g end,c.fiber_100g);
      v_salt:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then d.custom_salt_100g end,c.salt_100g);
      v_extra:=coalesce(c.nutrition_extra_100g,'{}'::jsonb)
        || case when v_verified and (d.nutrition_basis='100g' or v_code is null) then coalesce(d.custom_nutrition_extra_100g,'{}'::jsonb) else '{}'::jsonb end;
      v_micro:=coalesce((select jsonb_object_agg(n.nutrient_key,
                    jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version))
                  from public.ciqual_food_nutrients n where n.ciqual_code=v_code),'{}'::jsonb)
        || case when v_verified and (d.nutrition_basis='100g' or v_code is null) then coalesce(d.custom_micronutrients_100g,'{}'::jsonb) else '{}'::jsonb end;
      v_source:=coalesce(case when v_verified and (d.nutrition_basis='100g' or v_code is null) then nullif(d.nutrition_source_label,'') end,c.source,d.source,'Méthode Tee');
      v_kind:=case
        when v_verified and (d.nutrition_basis='100g' or v_code is null) and (
          d.custom_kcal_100g is not null or d.custom_protein_100g is not null or
          d.custom_fat_100g is not null or d.custom_carbs_100g is not null or
          d.custom_fiber_100g is not null or d.custom_salt_100g is not null or
          coalesce(d.custom_nutrition_extra_100g,'{}'::jsonb)<>'{}'::jsonb or
          coalesce(d.custom_micronutrients_100g,'{}'::jsonb)<>'{}'::jsonb
        ) then case when d.nutrition_basis='100ml' then 'dictionary_verified_100ml' else 'dictionary_verified' end
        when v_code is not null then 'ciqual_linked'
        else 'dictionary_metadata_only'
      end;
      return jsonb_build_object(
        'kind','food_reference','immutable',false,'reference_kind',v_kind,
        'nutrition_basis',case when v_verified and d.nutrition_basis='100ml' and v_code is null then '100ml' else '100g' end,
        'dictionary_id',d.id,'ciqual_code',v_code,'name',v_name,
        'source_label',v_source,'verified',v_verified or v_code is not null,
        'reference_100g',jsonb_build_object(
          'kcal_100g',v_kcal,'protein_100g',v_protein,'fat_100g',v_fat,
          'carbs_100g',v_carbs,'fiber_100g',v_fiber,'salt_100g',v_salt,
          'nutrition_extra_100g',v_extra,'micronutrients_100g',v_micro
        )
      );
    end if;
  end if;

  if p_ciqual_code is not null then
    select * into c from public.ciqual_foods where code=p_ciqual_code;
    if found then
      v_micro:=coalesce((select jsonb_object_agg(n.nutrient_key,
                    jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version))
                  from public.ciqual_food_nutrients n where n.ciqual_code=c.code),'{}'::jsonb);
      return jsonb_build_object(
        'kind','food_reference','immutable',false,'reference_kind','ciqual_direct','nutrition_basis','100g',
        'dictionary_id',null,'ciqual_code',c.code,'name',c.name,
        'source_label',coalesce(c.source,'Référence alimentaire'),'verified',true,
        'reference_100g',jsonb_build_object(
          'kcal_100g',c.kcal_100g,'protein_100g',c.protein_100g,'fat_100g',c.fat_100g,
          'carbs_100g',c.carbs_100g,'fiber_100g',c.fiber_100g,'salt_100g',c.salt_100g,
          'nutrition_extra_100g',coalesce(c.nutrition_extra_100g,'{}'::jsonb),
          'micronutrients_100g',v_micro
        )
      );
    end if;
  end if;

  return null;
end;
$$;
grant execute on function public.mt_nutrition_reference(text,uuid) to authenticated;

-- Recherche dédiée à l'éditeur de recettes : ne retourne que des références
-- que le résolveur considère réellement nutritionnelles et vérifiées.
create or replace function public.mt_recipe_ingredient_search(p_query text,p_limit integer default 10)
returns table(
  ciqual_code text,
  dictionary_id uuid,
  display_name text,
  source_label text,
  reference_kind text
)
language sql stable security invoker set search_path=public
as $$
  with candidates as (
    select f.*,
      public.mt_nutrition_reference(f.code,f.dictionary_id) ref
    from public.search_foods_v4(p_query,greatest(1,least(coalesce(p_limit,10)*2,30))) f
  )
  select
    c.code,
    c.dictionary_id,
    coalesce(c.display_name,c.name),
    c.ref->>'source_label',
    c.ref->>'reference_kind'
  from candidates c
  where c.ref is not null
    and coalesce((c.ref->>'verified')::boolean,false)=true
    and (
      c.ref->'reference_100g'->>'kcal_100g' is not null
      or c.ref->'reference_100g'->>'protein_100g' is not null
      or c.ref->'reference_100g'->>'fat_100g' is not null
      or c.ref->'reference_100g'->>'carbs_100g' is not null
      or c.ref->'reference_100g'->>'fiber_100g' is not null
      or c.ref->'reference_100g'->>'salt_100g' is not null
    )
  order by c.match_rank,c.display_name
  limit greatest(1,least(coalesce(p_limit,10),20));
$$;
grant execute on function public.mt_recipe_ingredient_search(text,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RECETTES STRUCTURÉES + SNAPSHOTS
-- -----------------------------------------------------------------------------
create table if not exists public.recipe_nutrition_profiles (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  servings numeric not null default 1 check (servings > 0),
  serving_label text not null default '1 portion',
  calculation_ready boolean not null default true,
  notes text,
  calculation_version text not null default 'MT_RECIPE_NUTRITION_V1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_nutrition_items (
  id bigint generated by default as identity primary key,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  sort_order integer not null default 0,
  ingredient_name text not null,
  ciqual_code text references public.ciqual_foods(code) on delete restrict,
  food_dictionary_id uuid references public.food_dictionary(id) on delete restrict,
  quantity_g numeric not null check (quantity_g > 0),
  optional boolean not null default false,
  included_in_reference boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ciqual_code is not null or food_dictionary_id is not null)
);
create index if not exists recipe_nutrition_items_recipe_idx
  on public.recipe_nutrition_items(recipe_id,sort_order,id);

create table if not exists public.recipe_nutrition_snapshots (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  servings numeric not null,
  serving_label text not null,
  total_mass_g numeric not null,

  kcal_total numeric,
  protein_total_g numeric,
  fat_total_g numeric,
  carbs_total_g numeric,
  fiber_total_g numeric,
  salt_total_g numeric,

  kcal_per_serving numeric,
  protein_per_serving_g numeric,
  fat_per_serving_g numeric,
  carbs_per_serving_g numeric,
  fiber_per_serving_g numeric,
  salt_per_serving_g numeric,
  energy_kj_per_serving numeric,

  core_coverage jsonb not null default '{}'::jsonb,
  nutrition_extra_per_serving jsonb not null default '{}'::jsonb,
  micronutrients_per_serving jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '[]'::jsonb,
  calculation_version text not null,
  calculated_at timestamptz not null default now()
);

alter table public.recipe_nutrition_profiles enable row level security;
alter table public.recipe_nutrition_items enable row level security;
alter table public.recipe_nutrition_snapshots enable row level security;

-- Les tables structurées restent privées en accès direct : le front passe par les RPC
-- contrôlées ci-dessous. Cela évite d'exposer les ingrédients d'une recette premium.
drop policy if exists "recipe nutrition profiles read" on public.recipe_nutrition_profiles;
drop policy if exists "recipe nutrition profiles admin" on public.recipe_nutrition_profiles;
create policy "recipe nutrition profiles admin" on public.recipe_nutrition_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "recipe nutrition items read" on public.recipe_nutrition_items;
drop policy if exists "recipe nutrition items admin" on public.recipe_nutrition_items;
create policy "recipe nutrition items admin" on public.recipe_nutrition_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "recipe nutrition snapshots read" on public.recipe_nutrition_snapshots;
drop policy if exists "recipe nutrition snapshots admin" on public.recipe_nutrition_snapshots;
create policy "recipe nutrition snapshots admin" on public.recipe_nutrition_snapshots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select,insert,update,delete on public.recipe_nutrition_profiles,public.recipe_nutrition_items,public.recipe_nutrition_snapshots to authenticated;

-- Contrôle d'accès unique pour une recette : libre, achetée, ou admin.
create or replace function public.mt_recipe_access_allowed(p_recipe_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1
    from public.recipes r
    where r.id=p_recipe_id
      and (
        public.is_admin()
        or (
          r.active=true
          and (
            coalesce(r.is_premium,false)=false
            or exists(
              select 1 from public.recipe_purchases rp
              where rp.recipe_id=r.id
                and rp.user_id=auth.uid()
                and coalesce(rp.status,'active')='active'
            )
          )
        )
      )
  );
$$;
revoke all on function public.mt_recipe_access_allowed(uuid) from public,anon;
grant execute on function public.mt_recipe_access_allowed(uuid) to authenticated;

create or replace function public.mt_recalculate_recipe_nutrition(p_recipe_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_servings numeric;
  v_label text;
  v_version text;
  v_total_items int;
  v_mass numeric;
  v_kcal_known numeric; v_protein_known numeric; v_fat_known numeric; v_carbs_known numeric; v_fiber_known numeric; v_salt_known numeric;
  v_kcal_n int; v_protein_n int; v_fat_n int; v_carbs_n int; v_fiber_n int; v_salt_n int;
  v_extra jsonb := '{}'::jsonb;
  v_micro jsonb := '{}'::jsonb;
  v_provenance jsonb := '[]'::jsonb;
  k text;
  unit text;
  documented int;
  val numeric;
  detail jsonb;
  extra_keys text[] := array['sugars_g','saturated_fat_g','sodium_g','trans_fat_g','monounsaturated_fat_g','polyunsaturated_fat_g','starch_g','polyols_g','cholesterol_g','alcohol_g','omega3_g','omega6_g','energy_kj'];
  micro_keys text[] := array['iron_mg','calcium_mg','zinc_mg','iodine_ug','magnesium_mg','phosphorus_mg','potassium_mg','selenium_ug','vitamin_b1_mg','vitamin_b2_mg','vitamin_b3_mg','vitamin_b6_mg','vitamin_b9_ug','vitamin_b12_ug','vitamin_c_mg','vitamin_d_ug','vitamin_e_mg'];
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select servings,serving_label,calculation_version
  into v_servings,v_label,v_version
  from public.recipe_nutrition_profiles where recipe_id=p_recipe_id;
  if not found then raise exception 'Profil nutrition recette introuvable'; end if;

  drop table if exists pg_temp.mt_recipe_values;
  create temporary table mt_recipe_values on commit drop as
  select
    i.id,i.ingredient_name,i.quantity_g,i.optional,i.included_in_reference,
    i.ciqual_code,i.food_dictionary_id,
    public.mt_nutrition_reference(i.ciqual_code,i.food_dictionary_id) ref
  from public.recipe_nutrition_items i
  where i.recipe_id=p_recipe_id
  order by i.sort_order,i.id;

  select count(*),coalesce(sum(quantity_g),0)
  into v_total_items,v_mass
  from mt_recipe_values where included_in_reference;
  if v_total_items=0 then
    delete from public.recipe_nutrition_snapshots where recipe_id=p_recipe_id;
    return jsonb_build_object('status','empty_recipe_nutrition','recipe_id',p_recipe_id);
  end if;

  select
    count(*) filter(where ref->'reference_100g'->>'kcal_100g' is not null),
    count(*) filter(where ref->'reference_100g'->>'protein_100g' is not null),
    count(*) filter(where ref->'reference_100g'->>'fat_100g' is not null),
    count(*) filter(where ref->'reference_100g'->>'carbs_100g' is not null),
    count(*) filter(where ref->'reference_100g'->>'fiber_100g' is not null),
    count(*) filter(where ref->'reference_100g'->>'salt_100g' is not null),
    sum((ref->'reference_100g'->>'kcal_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'kcal_100g' is not null),
    sum((ref->'reference_100g'->>'protein_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'protein_100g' is not null),
    sum((ref->'reference_100g'->>'fat_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'fat_100g' is not null),
    sum((ref->'reference_100g'->>'carbs_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'carbs_100g' is not null),
    sum((ref->'reference_100g'->>'fiber_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'fiber_100g' is not null),
    sum((ref->'reference_100g'->>'salt_100g')::numeric*quantity_g/100) filter(where ref->'reference_100g'->>'salt_100g' is not null)
  into v_kcal_n,v_protein_n,v_fat_n,v_carbs_n,v_fiber_n,v_salt_n,
       v_kcal_known,v_protein_known,v_fat_known,v_carbs_known,v_fiber_known,v_salt_known
  from mt_recipe_values where included_in_reference;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient',ingredient_name,'quantity_g',quantity_g,
    'ciqual_code',ciqual_code,'dictionary_id',food_dictionary_id,
    'reference_kind',ref->>'reference_kind','source_label',ref->>'source_label'
  ) order by id),'[]'::jsonb)
  into v_provenance
  from mt_recipe_values where included_in_reference;

  foreach k in array extra_keys loop
    unit:=case when k='energy_kj' then 'kJ' else 'g' end;
    select count(x)::int,
           sum(x*quantity_g/100),
           jsonb_agg(jsonb_build_object('ingredient',ingredient_name,'documented',x is not null) order by id)
    into documented,val,detail
    from (
      select v.*,
        public.mt_nutrition_extra_num(v.ref->'reference_100g'->'nutrition_extra_100g',k) x
      from mt_recipe_values v where included_in_reference
    ) q;
    v_extra:=v_extra||jsonb_build_object(k,jsonb_strip_nulls(jsonb_build_object(
      'unit',unit,
      'status',case when documented=v_total_items then 'complete' when documented=0 then 'undocumented' else 'partial' end,
      'value',case when documented=v_total_items then round(val/v_servings,4) end,
      'partial_value',case when documented>0 and documented<v_total_items then round(val/v_servings,4) end,
      'documented_items',documented,'total_items',v_total_items,'coverage_detail',coalesce(detail,'[]'::jsonb)
    )));
  end loop;

  foreach k in array micro_keys loop
    unit:=case when k like '%_ug' then 'µg' else 'mg' end;
    select count(x)::int,
           sum(x*quantity_g/100),
           jsonb_agg(jsonb_build_object('ingredient',ingredient_name,'documented',x is not null) order by id)
    into documented,val,detail
    from (
      select v.*,
        public.mt_nutrition_json_num(v.ref->'reference_100g'->'micronutrients_100g',k) x
      from mt_recipe_values v where included_in_reference
    ) q;
    v_micro:=v_micro||jsonb_build_object(k,jsonb_strip_nulls(jsonb_build_object(
      'unit',unit,
      'status',case when documented=v_total_items then 'complete' when documented=0 then 'undocumented' else 'partial' end,
      'value',case when documented=v_total_items then round(val/v_servings,4) end,
      'partial_value',case when documented>0 and documented<v_total_items then round(val/v_servings,4) end,
      'documented_items',documented,'total_items',v_total_items,'coverage_detail',coalesce(detail,'[]'::jsonb)
    )));
  end loop;

  insert into public.recipe_nutrition_snapshots(
    recipe_id,servings,serving_label,total_mass_g,
    kcal_total,protein_total_g,fat_total_g,carbs_total_g,fiber_total_g,salt_total_g,
    kcal_per_serving,protein_per_serving_g,fat_per_serving_g,carbs_per_serving_g,fiber_per_serving_g,salt_per_serving_g,energy_kj_per_serving,
    core_coverage,nutrition_extra_per_serving,micronutrients_per_serving,provenance,calculation_version,calculated_at
  ) values (
    p_recipe_id,v_servings,v_label,v_mass,
    case when v_kcal_n=v_total_items then round(v_kcal_known,2) end,
    case when v_protein_n=v_total_items then round(v_protein_known,2) end,
    case when v_fat_n=v_total_items then round(v_fat_known,2) end,
    case when v_carbs_n=v_total_items then round(v_carbs_known,2) end,
    case when v_fiber_n=v_total_items then round(v_fiber_known,2) end,
    case when v_salt_n=v_total_items then round(v_salt_known,3) end,
    case when v_kcal_n=v_total_items then round(v_kcal_known/v_servings,2) end,
    case when v_protein_n=v_total_items then round(v_protein_known/v_servings,2) end,
    case when v_fat_n=v_total_items then round(v_fat_known/v_servings,2) end,
    case when v_carbs_n=v_total_items then round(v_carbs_known/v_servings,2) end,
    case when v_fiber_n=v_total_items then round(v_fiber_known/v_servings,2) end,
    case when v_salt_n=v_total_items then round(v_salt_known/v_servings,3) end,
    case when v_kcal_n=v_total_items then round((v_kcal_known/v_servings)*4.184,1) end,
    jsonb_build_object(
      'total_items',v_total_items,
      'kcal',jsonb_build_object('status',case when v_kcal_n=v_total_items then 'complete' when v_kcal_n=0 then 'undocumented' else 'partial' end,'documented_items',v_kcal_n),
      'protein_g',jsonb_build_object('status',case when v_protein_n=v_total_items then 'complete' when v_protein_n=0 then 'undocumented' else 'partial' end,'documented_items',v_protein_n),
      'fat_g',jsonb_build_object('status',case when v_fat_n=v_total_items then 'complete' when v_fat_n=0 then 'undocumented' else 'partial' end,'documented_items',v_fat_n),
      'carbs_g',jsonb_build_object('status',case when v_carbs_n=v_total_items then 'complete' when v_carbs_n=0 then 'undocumented' else 'partial' end,'documented_items',v_carbs_n),
      'fiber_g',jsonb_build_object('status',case when v_fiber_n=v_total_items then 'complete' when v_fiber_n=0 then 'undocumented' else 'partial' end,'documented_items',v_fiber_n),
      'salt_g',jsonb_build_object('status',case when v_salt_n=v_total_items then 'complete' when v_salt_n=0 then 'undocumented' else 'partial' end,'documented_items',v_salt_n)
    ),
    v_extra,v_micro,v_provenance,v_version,now()
  )
  on conflict(recipe_id) do update set
    servings=excluded.servings,serving_label=excluded.serving_label,total_mass_g=excluded.total_mass_g,
    kcal_total=excluded.kcal_total,protein_total_g=excluded.protein_total_g,fat_total_g=excluded.fat_total_g,
    carbs_total_g=excluded.carbs_total_g,fiber_total_g=excluded.fiber_total_g,salt_total_g=excluded.salt_total_g,
    kcal_per_serving=excluded.kcal_per_serving,protein_per_serving_g=excluded.protein_per_serving_g,
    fat_per_serving_g=excluded.fat_per_serving_g,carbs_per_serving_g=excluded.carbs_per_serving_g,
    fiber_per_serving_g=excluded.fiber_per_serving_g,salt_per_serving_g=excluded.salt_per_serving_g,
    energy_kj_per_serving=excluded.energy_kj_per_serving,core_coverage=excluded.core_coverage,
    nutrition_extra_per_serving=excluded.nutrition_extra_per_serving,
    micronutrients_per_serving=excluded.micronutrients_per_serving,provenance=excluded.provenance,
    calculation_version=excluded.calculation_version,calculated_at=excluded.calculated_at;

  return jsonb_build_object('status','recipe_nutrition_recalculated','recipe_id',p_recipe_id,'items',v_total_items,'servings',v_servings);
end;
$$;
revoke all on function public.mt_recalculate_recipe_nutrition(uuid) from public,anon,authenticated;
grant execute on function public.mt_recalculate_recipe_nutrition(uuid) to authenticated;

create or replace function public.mt_admin_save_recipe_nutrition(
  p_recipe_id uuid,
  p_servings numeric,
  p_serving_label text,
  p_items jsonb
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  x jsonb;
  idx int:=0;
  q numeric;
  c text;
  d uuid;
  nm text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if not exists(select 1 from public.recipes where id=p_recipe_id) then raise exception 'Recette introuvable'; end if;
  if coalesce(p_servings,0)<=0 then raise exception 'Nombre de portions invalide'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'p_items doit être un tableau JSON'; end if;

  insert into public.recipe_nutrition_profiles(recipe_id,servings,serving_label,calculation_ready,updated_at)
  values(p_recipe_id,p_servings,coalesce(nullif(btrim(p_serving_label),''),'1 portion'),true,now())
  on conflict(recipe_id) do update set servings=excluded.servings,serving_label=excluded.serving_label,calculation_ready=true,updated_at=now();

  delete from public.recipe_nutrition_items where recipe_id=p_recipe_id;

  for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    q:=nullif(x->>'quantity_g','')::numeric;
    c:=nullif(x->>'ciqual_code','');
    d:=nullif(x->>'dictionary_id','')::uuid;
    nm:=coalesce(nullif(btrim(x->>'ingredient_name'),''),'Ingrédient');
    if q is null or q<=0 then raise exception 'Quantité invalide pour %',nm; end if;
    if c is null and d is null then raise exception 'Référence nutritionnelle manquante pour %',nm; end if;
    if public.mt_nutrition_reference(c,d) is null then raise exception 'Référence introuvable pour %',nm; end if;
    if c is null and d is not null and exists(
      select 1 from public.food_dictionary fd
      where fd.id=d and fd.nutrition_verified=true and fd.nutrition_basis='100ml'
    ) then
      raise exception 'La référence % est définie pour 100 ml. Ajoute une référence CIQUAL en grammes ou une densité vérifiée avant de l’utiliser dans une recette structurée.',nm;
    end if;

    insert into public.recipe_nutrition_items(
      recipe_id,sort_order,ingredient_name,ciqual_code,food_dictionary_id,
      quantity_g,optional,included_in_reference,notes
    ) values (
      p_recipe_id,idx,nm,c,d,q,
      coalesce((x->>'optional')::boolean,false),
      coalesce((x->>'included_in_reference')::boolean,true),
      nullif(x->>'notes','')
    );
    idx:=idx+1;
  end loop;

  return public.mt_recalculate_recipe_nutrition(p_recipe_id);
end;
$$;
revoke all on function public.mt_admin_save_recipe_nutrition(uuid,numeric,text,jsonb) from public,anon;
grant execute on function public.mt_admin_save_recipe_nutrition(uuid,numeric,text,jsonb) to authenticated;

create or replace function public.mt_get_recipe_nutrition(p_recipe_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.mt_recipe_access_allowed(p_recipe_id) then return null; end if;
  select jsonb_build_object(
    'kind','recipe_snapshot','immutable',false,'snapshot_scope','recipe_reference',
    'recipe_id',s.recipe_id,'servings',s.servings,'serving_label',s.serving_label,
    'reference_mass_g',round(s.total_mass_g/s.servings,2),
    'core',jsonb_build_object(
      'kcal',s.kcal_per_serving,'protein_g',s.protein_per_serving_g,'fat_g',s.fat_per_serving_g,
      'carbs_g',s.carbs_per_serving_g,'fiber_g',s.fiber_per_serving_g,'salt_g',s.salt_per_serving_g,
      'energy_kj',s.energy_kj_per_serving
    ),
    'core_coverage',s.core_coverage,
    'nutrition_extra',s.nutrition_extra_per_serving,
    'micronutrients',s.micronutrients_per_serving,
    'provenance',s.provenance,
    'calculation_version',s.calculation_version,'calculated_at',s.calculated_at,
    'nutrition_disclaimer','Valeurs estimées à partir de la recette de référence structurée Méthode Tee. Une modification des ingrédients ou quantités change le résultat.'
  ) into out_json
  from public.recipe_nutrition_snapshots s
  where s.recipe_id=p_recipe_id
  limit 1;
  return out_json;
end;
$$;
revoke all on function public.mt_get_recipe_nutrition(uuid) from public,anon;
grant execute on function public.mt_get_recipe_nutrition(uuid) to authenticated;

create or replace function public.mt_get_recipe_nutrition_admin(p_recipe_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  return jsonb_build_object(
    'profile',(select to_jsonb(p) from public.recipe_nutrition_profiles p where p.recipe_id=p_recipe_id),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'ingredient_name',i.ingredient_name,'ciqual_code',i.ciqual_code,
      'dictionary_id',i.food_dictionary_id,'quantity_g',i.quantity_g,'optional',i.optional,
      'included_in_reference',i.included_in_reference,'notes',i.notes
    ) order by i.sort_order,i.id) from public.recipe_nutrition_items i where i.recipe_id=p_recipe_id),'[]'::jsonb),
    'snapshot',public.mt_get_recipe_nutrition(p_recipe_id)
  );
end;
$$;
revoke all on function public.mt_get_recipe_nutrition_admin(uuid) from public,anon;
grant execute on function public.mt_get_recipe_nutrition_admin(uuid) to authenticated;

-- Une portion de référence convertie en items consommables et SNAPSHOTTABLES.
-- SECURITY DEFINER uniquement pour lire les lignes structurées privées, après contrôle d'accès.
create or replace function public.mt_get_recipe_meal_items(p_recipe_id uuid,p_servings numeric default 1)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.mt_recipe_access_allowed(p_recipe_id) then return '[]'::jsonb; end if;
  with p as (
    select * from public.recipe_nutrition_profiles where recipe_id=p_recipe_id
  ), rows as (
    select i.*,
      public.mt_nutrition_reference(i.ciqual_code,i.food_dictionary_id) ref,
      (i.quantity_g/p.servings*greatest(coalesce(p_servings,1),0.01))::numeric quantity_for_meal
    from public.recipe_nutrition_items i cross join p
    where i.recipe_id=p_recipe_id and i.included_in_reference=true
    order by i.sort_order,i.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient_name',ingredient_name,
    'ciqual_code',ciqual_code,'dictionary_id',food_dictionary_id,
    'quantity_g',round(quantity_for_meal,3),
    'reference_100g',ref->'reference_100g',
    'source_label',ref->>'source_label','reference_kind',ref->>'reference_kind'
  )),'[]'::jsonb) into out_json
  from rows;
  return out_json;
end;
$$;
revoke all on function public.mt_get_recipe_meal_items(uuid,numeric) from public,anon;
grant execute on function public.mt_get_recipe_meal_items(uuid,numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RÉSOLVEUR NUTRITIONNEL UNIQUE
-- Priorité : snapshot historique > recette > smoothie catalogue > dictionary > CIQUAL.
-- -----------------------------------------------------------------------------
create or replace function public.mt_nutrition_resolve(
  p_meal_item_id bigint default null,
  p_recipe_id uuid default null,
  p_blend_id uuid default null,
  p_dictionary_id uuid default null,
  p_ciqual_code text default null
)
returns jsonb
language plpgsql stable security invoker set search_path=public
as $$
declare
  i public.food_meal_items%rowtype;
  r jsonb;
begin
  if p_meal_item_id is not null then
    select fi.* into i
    from public.food_meal_items fi
    join public.food_meals fm on fm.id=fi.meal_id
    where fi.id=p_meal_item_id and fm.user_id=auth.uid();
    if found then
      return jsonb_build_object(
        'kind','meal_item_snapshot','immutable',true,'meal_item_id',i.id,'name',i.food_name,'quantity_g',i.quantity_g,
        'ciqual_code',i.ciqual_code,'dictionary_id',i.food_dictionary_id,
        'reference_100g',jsonb_build_object(
          'kcal_100g',i.kcal_100g,'protein_100g',i.protein_100g,'fat_100g',i.fat_100g,
          'carbs_100g',i.carbs_100g,'fiber_100g',i.fiber_100g,'salt_100g',i.salt_100g,
          'nutrition_extra_100g',coalesce(i.nutrition_extra_100g,'{}'::jsonb),
          'micronutrients_100g',coalesce(i.micronutrients_100g,'{}'::jsonb)
        ),
        'portion',jsonb_build_object(
          'kcal',i.kcal,'protein_g',i.protein,'fat_g',i.fat,'carbs_g',i.carbs,'fiber_g',i.fiber,'salt_g',i.salt,
          'nutrition_extra',coalesce(i.nutrition_extra,'{}'::jsonb),
          'micronutrients',coalesce(i.micronutrients,'{}'::jsonb)
        ),
        'source_label','Snapshot du repas enregistré'
      );
    end if;
    return null;
  end if;

  if p_recipe_id is not null then
    r:=public.mt_get_recipe_nutrition(p_recipe_id);
    if r is not null then return r; end if;
  end if;

  if p_blend_id is not null and to_regclass('public.botanical_blend_nutrition_snapshots') is not null then
    select jsonb_build_object(
      'kind','blend_snapshot','immutable',false,'snapshot_scope','blend_reference',
      'blend_id',s.blend_id,'serving_label',s.serving_label,'reference_mass_g',s.reference_mass_g,
      'core',jsonb_build_object(
        'kcal',s.kcal,'protein_g',s.protein_g,'fat_g',s.fat_g,'carbs_g',s.carbs_g,
        'fiber_g',s.fiber_g,'salt_g',s.salt_g,'energy_kj',s.energy_kj
      ),
      'core_coverage',s.core_coverage,'nutrition_extra',s.nutrition_extra,
      'micronutrients',s.micronutrients,'provenance',s.provenance,
      'calculation_version',s.calculation_version,'calculated_at',s.calculated_at,
      'nutrition_disclaimer','Valeurs estimées pour la recette de référence Méthode Tee ; la composition réelle peut varier selon les options et quantités choisies.'
    ) into r
    from public.botanical_blend_nutrition_snapshots s
    join public.botanical_blends b on b.id=s.blend_id
    where s.blend_id=p_blend_id and b.enabled
    limit 1;
    if r is not null then return r; end if;
  end if;

  return public.mt_nutrition_reference(p_ciqual_code,p_dictionary_id);
end;
$$;
grant execute on function public.mt_nutrition_resolve(bigint,uuid,uuid,uuid,text) to authenticated;

create or replace function public.mt_nutrition_resolve_batch(p_refs jsonb)
returns jsonb
language sql stable security invoker set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'client_key',x->>'client_key',
    'nutrition',public.mt_nutrition_resolve(
      nullif(x->>'meal_item_id','')::bigint,
      nullif(x->>'recipe_id','')::uuid,
      nullif(x->>'blend_id','')::uuid,
      nullif(x->>'dictionary_id','')::uuid,
      nullif(x->>'ciqual_code','')
    )
  )),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_refs,'[]'::jsonb)) x;
$$;
grant execute on function public.mt_nutrition_resolve_batch(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 4B. ANALYSE QUOTIDIENNE COUVERTURE-AWARE
-- Utilise EXCLUSIVEMENT les snapshots enregistrés dans food_meal_items.
-- Une somme quotidienne n'est exposée comme valeur que si toute la sélection
-- documente ce nutriment. Les sommes partielles restent séparées.
-- -----------------------------------------------------------------------------
create or replace function public.food_day_micronutrition_summary(target_date date)
returns jsonb
language sql stable security invoker set search_path=public
as $$
  with meals as (
    select id from public.food_meals
    where user_id=auth.uid() and meal_date=target_date
  ),
  items as (
    select i.* from public.food_meal_items i
    join meals m on m.id=i.meal_id
    where i.quantity_g is not null and i.quantity_g>0
  ),
  counts as (
    select
      (select count(*) from meals)::int meal_count,
      (select count(*) from items)::int item_count,
      (select count(*) from items where kcal is not null)::int calculable_items,
      coalesce((select count(*) from (
        select meal_id
        from items
        group by meal_id
        having count(*)>0 and count(kcal)=count(*)
      ) q),0)::int calculated_meals
  ),
  macros as (
    select
      case when count(*)>0 and count(kcal)=count(*) then sum(kcal) end kcal,
      case when count(*)>0 and count(protein)=count(*) then sum(protein) end protein_g,
      case when count(*)>0 and count(fat)=count(*) then sum(fat) end fat_g,
      case when count(*)>0 and count(carbs)=count(*) then sum(carbs) end carbs_g,
      case when count(*)>0 and count(fiber)=count(*) then sum(fiber) end fiber_g,
      case when count(*)>0 and count(salt)=count(*) then sum(salt) end salt_g
    from items
  ),
  micro_keys(key) as (
    values
      ('iron_mg'),('calcium_mg'),('zinc_mg'),('iodine_ug'),('magnesium_mg'),('phosphorus_mg'),
      ('potassium_mg'),('selenium_ug'),('vitamin_b1_mg'),('vitamin_b2_mg'),('vitamin_b3_mg'),
      ('vitamin_b6_mg'),('vitamin_b9_ug'),('vitamin_b12_ug'),('vitamin_c_mg'),('vitamin_d_ug'),
      ('vitamin_e_mg'),('omega3_g')
  ),
  micro_item as (
    select i.id item_id,i.food_name,k.key,
      public.mt_nutrition_json_num(coalesce(i.micronutrients,'{}'::jsonb),k.key) value
    from items i cross join micro_keys k
  ),
  micro_agg as (
    select key,
      count(*)::int total_items,
      count(value)::int documented_items,
      sum(value) filter(where value is not null) documented_value
    from micro_item group by key
  ),
  complete_micros as (
    select key,documented_value value
    from micro_agg
    where total_items>0 and documented_items=total_items
  ),
  partial_micros as (
    select key,documented_value value
    from micro_agg
    where documented_items>0 and documented_items<total_items
  ),
  coverage as (
    select coalesce(jsonb_object_agg(key,jsonb_build_object(
      'status',case when total_items=0 or documented_items=0 then 'undocumented'
                    when documented_items=total_items then 'complete' else 'partial' end,
      'documented_items',documented_items,'total_items',total_items
    )),'{}'::jsonb) value
    from micro_agg
  ),
  source_totals as (
    select key,food_name,sum(value) value
    from micro_item
    where value is not null and nullif(trim(food_name),'') is not null
    group by key,food_name
  ),
  source_ranked as (
    select key,food_name,value,row_number() over(partition by key order by value desc,food_name) rn
    from source_totals
  ),
  source_arrays as (
    select key,jsonb_agg(jsonb_build_object('name',food_name,'value',round(value,3)) order by value desc,food_name) sources
    from source_ranked where rn<=5 group by key
  ),
  source_object as (
    select coalesce(jsonb_object_agg(key,sources),'{}'::jsonb) value from source_arrays
  ),
  source_foods as (
    select coalesce(jsonb_agg(food_name order by food_name),'[]'::jsonb) value,count(*)::int source_count
    from (select distinct food_name from items where nullif(trim(food_name),'') is not null) x
  )
  select jsonb_build_object(
    'date',target_date,
    'meal_count',c.meal_count,
    'item_count',c.item_count,
    'quantified_items',c.item_count,
    'calculable_items',c.calculable_items,
    'calculated_meals',c.calculated_meals,
    'kcal',m.kcal,'protein_g',m.protein_g,'fat_g',m.fat_g,'carbs_g',m.carbs_g,'fiber_g',m.fiber_g,'salt_g',m.salt_g,
    'micronutrients',coalesce((select jsonb_object_agg(key,round(value,3)) from complete_micros),'{}'::jsonb),
    'micronutrients_partial',coalesce((select jsonb_object_agg(key,round(value,3)) from partial_micros),'{}'::jsonb),
    'micronutrient_coverage',(select value from coverage),
    'micronutrient_sources',(select value from source_object),
    'source_foods',(select value from source_foods),
    'micronutrient_source_count',(select source_count from source_foods),
    'micronutrient_coverage_count',(select count(*) from complete_micros),
    'data_quality',case
      when c.meal_count=0 then 'no_meal'
      when c.calculated_meals=0 then 'not_calculable'
      when c.calculated_meals<c.meal_count then 'partial'
      else 'complete'
    end,
    'source_note','Analyse construite uniquement depuis les snapshots des repas enregistrés. Les nutriments incomplets restent partiels/non documentés et ne sont jamais interprétés comme zéro.'
  )
  from counts c cross join macros m;
$$;
grant execute on function public.food_day_micronutrition_summary(date) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. VÉRIFICATIONS NON-RÉGRESSION
-- -----------------------------------------------------------------------------
do $verify$
begin
  if to_regprocedure('public.mt_nutrition_resolve(bigint,uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.mt_nutrition_resolve_batch(jsonb)') is null
     or to_regprocedure('public.mt_admin_save_recipe_nutrition(uuid,numeric,text,jsonb)') is null
     or to_regprocedure('public.mt_get_recipe_meal_items(uuid,numeric)') is null
     or to_regprocedure('public.mt_recipe_access_allowed(uuid)') is null
     or to_regprocedure('public.mt_recipe_ingredient_search(text,integer)') is null
     or to_regprocedure('public.mt_portion_profile(text,text,uuid)') is null then
    raise exception 'Une fonction du moteur nutritionnel unifié manque.';
  end if;
end
$verify$;

commit;

select jsonb_pretty(jsonb_build_object(
  'status','v411_2_nutrition_unifiee_backend_pret',
  'resolver_ready',to_regprocedure('public.mt_nutrition_resolve(bigint,uuid,uuid,uuid,text)') is not null,
  'resolver_batch_ready',to_regprocedure('public.mt_nutrition_resolve_batch(jsonb)') is not null,
  'recipe_engine_ready',to_regprocedure('public.mt_admin_save_recipe_nutrition(uuid,numeric,text,jsonb)') is not null,
  'recipe_ingredient_search_ready',to_regprocedure('public.mt_recipe_ingredient_search(text,integer)') is not null,
  'recipe_meal_snapshot_ready',to_regprocedure('public.mt_get_recipe_meal_items(uuid,numeric)') is not null,
  'portion_engine_ready',to_regprocedure('public.mt_portion_profile(text,text,uuid)') is not null,
  'coverage_aware_analysis_ready',to_regprocedure('public.food_day_micronutrition_summary(date)') is not null,
  'historical_rows_rewritten',false,
  'existing_ciqual_dictionary_blends_rewritten',false,
  'next','Uploader le patch front V411.2 après validation de ce statut.'
)) as result;
