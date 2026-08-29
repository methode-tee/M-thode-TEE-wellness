-- MÉTHODE TEE V419 — Micronutrition CIQUAL réelle + sources alimentaires + résumé borné
begin;

create table if not exists public.ciqual_food_nutrients (
  ciqual_code text not null references public.ciqual_foods(code) on delete cascade,
  nutrient_key text not null check (nutrient_key in ('iron_mg','calcium_mg','zinc_mg','iodine_ug','magnesium_mg','phosphorus_mg','potassium_mg','selenium_ug','vitamin_b1_mg','vitamin_b2_mg','vitamin_b3_mg','vitamin_b6_mg','vitamin_b9_ug','vitamin_b12_ug','vitamin_c_mg','vitamin_d_ug','vitamin_e_mg','omega3_g')),
  value_100g numeric not null check (value_100g >= 0), unit text not null,
  source text not null default 'ANSES - Table Ciqual 2025', source_version text not null default '2025-11-03',
  primary key (ciqual_code,nutrient_key)
);
alter table public.ciqual_food_nutrients drop constraint if exists ciqual_food_nutrients_nutrient_key_check;
alter table public.ciqual_food_nutrients add constraint ciqual_food_nutrients_nutrient_key_check check (nutrient_key in ('iron_mg','calcium_mg','zinc_mg','iodine_ug','magnesium_mg','phosphorus_mg','potassium_mg','selenium_ug','vitamin_b1_mg','vitamin_b2_mg','vitamin_b3_mg','vitamin_b6_mg','vitamin_b9_ug','vitamin_b12_ug','vitamin_c_mg','vitamin_d_ug','vitamin_e_mg','omega3_g'));
alter table public.ciqual_food_nutrients
  add column if not exists updated_at timestamptz not null default now();

alter table public.ciqual_food_nutrients enable row level security;
drop policy if exists "ciqual nutrients readable" on public.ciqual_food_nutrients;
create policy "ciqual nutrients readable" on public.ciqual_food_nutrients for select using (true);
grant select on public.ciqual_food_nutrients to anon, authenticated;

alter table public.food_meal_items add column if not exists micronutrients_100g jsonb not null default '{}'::jsonb;
alter table public.food_meal_items add column if not exists micronutrients jsonb not null default '{}'::jsonb;

create or replace function public.search_foods_v3(p_query text, p_limit integer default 10)
returns table(code text,name text,kcal_100g numeric,protein_100g numeric,fat_100g numeric,carbs_100g numeric,fiber_100g numeric,salt_100g numeric,source text,dictionary_id uuid,display_name text,country text,categories text[],adapter_profile jsonb,match_rank integer,micronutrients_100g jsonb)
language sql stable security invoker set search_path=public as $$
  select f.code,f.name,f.kcal_100g,f.protein_100g,f.fat_100g,f.carbs_100g,f.fiber_100g,f.salt_100g,f.source,f.dictionary_id,f.display_name,f.country,f.categories,f.adapter_profile,f.match_rank,
    coalesce((select jsonb_object_agg(n.nutrient_key,jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version)) from public.ciqual_food_nutrients n where n.ciqual_code=f.code),'{}'::jsonb)
  from public.search_foods_v2(p_query,greatest(1,least(coalesce(p_limit,10),50))) f;
$$;
grant execute on function public.search_foods_v3(text,integer) to anon, authenticated;

-- Une seule journée par appel. Aucune lecture de catalogue complet : l'egress reste borné.
create or replace function public.food_day_micronutrition_summary(target_date date)
returns jsonb language sql stable security invoker set search_path=public as $$
  with meals as (
    select id from public.food_meals where user_id=auth.uid() and meal_date=target_date
  ),
  items as (
    select i.* from public.food_meal_items i join meals m on m.id=i.meal_id
  ),
  calculable as (
    select * from items where quantity_g is not null and quantity_g>0 and ciqual_code is not null
  ),
  counts as (
    select
      (select count(*) from meals)::int meal_count,
      (select count(*) from items)::int item_count,
      (select count(*) from calculable)::int calculable_items,
      (select count(distinct meal_id) from calculable)::int calculated_meals
  ),
  macros as (
    select
      case when count(*)>0 then sum(kcal) else null end kcal,
      case when count(*)>0 then sum(protein) else null end protein_g,
      case when count(*)>0 then sum(fat) else null end fat_g,
      case when count(*)>0 then sum(carbs) else null end carbs_g,
      case when count(*)>0 then sum(fiber) else null end fiber_g
    from calculable
  ),
  micro_contrib as (
    select i.food_name,e.key,
      case
        when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric
        else nullif(e.value->>'value','')::numeric
      end as value
    from calculable i
    cross join lateral jsonb_each(i.micronutrients) e
    where jsonb_typeof(e.value)='number' or nullif(e.value->>'value','') is not null
  ),
  micros as (
    select key,sum(value) value from micro_contrib where value is not null group by key
  ),
  source_totals as (
    select key,food_name,sum(value) value
    from micro_contrib
    where value is not null and value>0 and nullif(trim(food_name),'') is not null
    group by key,food_name
  ),
  source_ranked as (
    select key,food_name,value,row_number() over(partition by key order by value desc,food_name) rn
    from source_totals
  ),
  source_arrays as (
    select key,jsonb_agg(jsonb_build_object('name',food_name,'value',round(value,3)) order by value desc,food_name) as sources
    from source_ranked where rn<=5 group by key
  ),
  source_object as (
    select coalesce(jsonb_object_agg(key,sources),'{}'::jsonb) value from source_arrays
  ),
  source_foods as (
    select coalesce(jsonb_agg(food_name order by food_name),'[]'::jsonb) value,
           count(*)::int source_count
    from (select distinct food_name from calculable where nullif(trim(food_name),'') is not null) x
  )
  select jsonb_build_object(
    'date',target_date,
    'meal_count',c.meal_count,
    'item_count',c.item_count,
    'quantified_items',(select count(*) from items where quantity_g is not null and quantity_g>0),
    'calculable_items',c.calculable_items,
    'calculated_meals',c.calculated_meals,
    'kcal',m.kcal,
    'protein_g',m.protein_g,
    'fat_g',m.fat_g,
    'carbs_g',m.carbs_g,
    'fiber_g',m.fiber_g,
    'micronutrients',coalesce((select jsonb_object_agg(key,round(value,3)) from micros where value is not null),'{}'::jsonb),
    'micronutrient_sources',(select value from source_object),
    'source_foods',(select value from source_foods),
    'micronutrient_source_count',(select source_count from source_foods),
    'micronutrient_coverage_count',(select count(*) from micros where value is not null),
    'data_quality',case
      when c.meal_count=0 then 'no_meal'
      when c.calculated_meals=0 then 'not_calculable'
      when c.calculated_meals<c.meal_count then 'partial'
      else 'complete'
    end,
    'source_note','Valeurs calculées uniquement à partir des quantités enregistrées et des références CIQUAL disponibles. Une donnée absente vaut « non documentée », jamais zéro ni carence.'
  ) from counts c cross join macros m;
$$;
grant execute on function public.food_day_micronutrition_summary(date) to authenticated;
commit;
