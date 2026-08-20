-- V389 — Mon Équilibre : contexte culinaire compact CIQUAL + dictionnaire
-- À exécuter UNE FOIS dans Supabase SQL Editor avant de tester le patch V389.
-- Remplace uniquement la fonction compacte déjà appelée par Mon Équilibre.

create or replace function public.food_day_balance_summary(target_date date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  with meals as (
    select m.*,exists(select 1 from public.food_meal_items i where i.meal_id=m.id) as has_nutrition_items
    from public.food_meals m
    where m.user_id=auth.uid() and m.meal_date=target_date
  ), items_ranked as (
    select
      i.id,i.meal_id,i.food_name,i.ciqual_code,i.quantity_g,i.kcal,i.protein,i.fiber,i.fat,i.carbs,i.salt,
      m.meal_type,
      d.canonical_name,d.display_name,d.country,d.categories,d.typical_components,d.optional_components,d.adapter_profile,
      row_number() over(order by i.quantity_g desc nulls last,i.id) as rn
    from public.food_meal_items i
    join meals m on m.id=i.meal_id
    left join lateral (
      select fd.*
      from public.food_dictionary fd
      where fd.enabled and (
        (i.ciqual_code is not null and fd.ciqual_code=i.ciqual_code)
        or public.food_normalize(fd.canonical_name)=public.food_normalize(i.food_name)
        or public.food_normalize(fd.display_name)=public.food_normalize(i.food_name)
        or exists(select 1 from unnest(fd.aliases) a where public.food_normalize(a)=public.food_normalize(i.food_name))
      )
      order by case when fd.ciqual_code=i.ciqual_code then 0 else 1 end,fd.priority,fd.id
      limit 1
    ) d on true
  ), context_items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',food_name,'ciqual_code',ciqual_code,'meal_type',meal_type,
      'protein',protein,'fiber',fiber,
      'canonical_name',canonical_name,'display_name',display_name,'country',country,
      'categories',coalesce(categories,'{}'::text[]),
      'typical_components',coalesce(typical_components,'[]'::jsonb),
      'optional_components',coalesce(optional_components,'[]'::jsonb),
      'adapter_profile',coalesce(adapter_profile,'{}'::jsonb)
    ) order by rn),'[]'::jsonb) as value
    from items_ranked where rn<=8
  )
  select jsonb_build_object(
    'meal_count',count(*),
    'calculated_meal_count',count(*) filter(where has_nutrition_items),
    'protein_total',case when count(*) filter(where has_nutrition_items)>0 then round((sum(protein_total) filter(where has_nutrition_items))::numeric,1) else null end,
    'fiber_total',case when count(*) filter(where has_nutrition_items)>0 then round((sum(fiber_total) filter(where has_nutrition_items))::numeric,1) else null end,
    'energy_after',case when count(energy_after)>0 then round(avg(energy_after)::numeric,1) else null end,
    'digestion_after',case when count(digestion_after)>0 then round(avg(digestion_after)::numeric,1) else null end,
    'satiety_after',case when count(satiety_after)>0 then round(avg(satiety_after)::numeric,1) else null end,
    'food_context',(select value from context_items)
  )
  from meals;
$$;

grant execute on function public.food_day_balance_summary(date) to authenticated;
