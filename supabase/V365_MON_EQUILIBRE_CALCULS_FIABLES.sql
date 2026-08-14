-- V365 — Mon Équilibre aujourd'hui : résumé alimentaire fiable
-- À exécuter UNE FOIS dans Supabase SQL Editor AVANT de tester le patch V365.
-- Remplace uniquement la fonction compacte déjà utilisée par Mon Équilibre.
-- Aucune table, aucune donnée existante et aucune RLS ne sont supprimées.

create or replace function public.food_day_balance_summary(target_date date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  with meals as (
    select
      m.*,
      exists (
        select 1
        from public.food_meal_items i
        where i.meal_id = m.id
      ) as has_nutrition_items
    from public.food_meals m
    where m.user_id = auth.uid()
      and m.meal_date = target_date
  )
  select jsonb_build_object(
    'meal_count', count(*),
    'calculated_meal_count', count(*) filter (where has_nutrition_items),
    'protein_total', case
      when count(*) filter (where has_nutrition_items) > 0
      then round((sum(protein_total) filter (where has_nutrition_items))::numeric, 1)
      else null
    end,
    'fiber_total', case
      when count(*) filter (where has_nutrition_items) > 0
      then round((sum(fiber_total) filter (where has_nutrition_items))::numeric, 1)
      else null
    end,
    'energy_after', case when count(energy_after)>0 then round(avg(energy_after)::numeric,1) else null end,
    'digestion_after', case when count(digestion_after)>0 then round(avg(digestion_after)::numeric,1) else null end,
    'satiety_after', case when count(satiety_after)>0 then round(avg(satiety_after)::numeric,1) else null end
  )
  from meals;
$$;

grant execute on function public.food_day_balance_summary(date) to authenticated;
