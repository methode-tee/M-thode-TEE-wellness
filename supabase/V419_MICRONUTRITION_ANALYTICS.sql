-- MÉTHODE TEE V419 — Micronutrition CIQUAL réelle, snapshots de repas et suivis analytiques
begin;

create table if not exists public.ciqual_food_nutrients (
  ciqual_code text not null references public.ciqual_foods(code) on delete cascade,
  nutrient_key text not null check (nutrient_key in ('iron_mg','calcium_mg','zinc_mg','iodine_ug','magnesium_mg','potassium_mg','selenium_ug','vitamin_b9_ug','vitamin_b12_ug','vitamin_c_mg','vitamin_d_ug','omega3_g')),
  value_100g numeric not null check (value_100g >= 0), unit text not null,
  source text not null default 'ANSES - Table Ciqual 2025', source_version text not null default '2025-11-03',
  primary key (ciqual_code,nutrient_key)
);
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

create or replace function public.food_day_micronutrition_summary(target_date date)
returns jsonb language sql stable security invoker set search_path=public as $$
  with meals as (select id from public.food_meals where user_id=auth.uid() and meal_date=target_date),
  items as (select i.* from public.food_meal_items i join meals m on m.id=i.meal_id),
  micros as (
    select e.key, sum(case when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric else coalesce((e.value->>'value')::numeric,0) end) value
    from items i cross join lateral jsonb_each(i.micronutrients) e group by e.key
  )
  select jsonb_build_object(
    'date',target_date,'meal_count',(select count(*) from meals),'item_count',(select count(*) from items),
    'quantified_items',(select count(*) from items where quantity_g is not null and quantity_g>0),
    'calculated_meals',(select count(distinct meal_id) from items where quantity_g is not null and quantity_g>0),
    'protein_g',coalesce((select sum(protein) from items),0),'fiber_g',coalesce((select sum(fiber) from items),0),
    'micronutrients',coalesce((select jsonb_object_agg(key,round(value,3)) from micros),'{}'::jsonb),
    'micronutrient_coverage_count',(select count(*) from micros where value>0),
    'source_note','Valeurs calculées uniquement à partir des quantités enregistrées et des données CIQUAL disponibles. Une donnée absente vaut « non documentée », jamais zéro ni carence.'
  );
$$;
grant execute on function public.food_day_micronutrition_summary(date) to authenticated;
commit;
