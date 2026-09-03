-- MÉTHODE TEE — V411.3 · PRÉCISION RÉELLE
-- Additif au V411.2. Aucun ancien repas ni ancienne boisson n'est recalculé.
-- Objectifs :
--   1) poids final réellement préparé des recettes -> poids par portion / repère 100 g ;
--   2) calcul d'une boisson/smoothie à partir des quantités réellement saisies ;
--   3) snapshot nutritionnel uniquement pour les consommations futures quantifiées.
-- Important : aucun facteur de rétention vitaminique ou d'absorption d'huile n'est inventé.

begin;

do $preflight$
begin
  if to_regclass('public.recipe_nutrition_snapshots') is null
     or to_regclass('public.recipe_nutrition_profiles') is null
     or to_regclass('public.botanical_ingredient_nutrition_refs') is null
     or to_regclass('public.botanical_blend_nutrition_recipe_items') is null
     or to_regclass('public.user_beverage_entries') is null then
    raise exception 'V411.2 et les lots smoothies doivent être installés avant V411.3.';
  end if;
  if to_regprocedure('public.mt_get_recipe_nutrition(uuid)') is null
     or to_regprocedure('public.mt_nutrition_reference(text,uuid)') is null then
    raise exception 'Fonctions V411.2 manquantes.';
  end if;
end
$preflight$;

-- Empreintes de non-régression : aucune ligne historique ne sera mise à jour.
create temporary table mt_v4113_guard as
select
  (select count(*)::bigint from public.food_meal_items) meal_items,
  (select count(*)::bigint from public.user_beverage_entries) beverage_entries,
  (select md5(string_agg(concat_ws('|',id,user_id,entry_date,consumed_at,beverage_kind,display_name,volume_ml,hydration_ml,source_mode,catalog_blend_id,user_blend_id,ingredients_snapshot,composition_known,energy_after,digestion_after,notes),E'\n' order by id)) from public.user_beverage_entries) beverage_hash;

-- -----------------------------------------------------------------------------
-- 1. RENDEMENT / POIDS FINAL DES RECETTES
-- -----------------------------------------------------------------------------
create table if not exists public.recipe_yield_profiles (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  final_weight_g numeric not null check (final_weight_g > 0),
  weight_basis text not null default 'measured'
    check (weight_basis in ('measured','estimated')),
  preparation_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_yield_profiles enable row level security;
drop policy if exists "recipe yield admin" on public.recipe_yield_profiles;
create policy "recipe yield admin" on public.recipe_yield_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.recipe_yield_profiles to authenticated;

create or replace function public.mt_admin_save_recipe_yield(
  p_recipe_id uuid,
  p_final_weight_g numeric default null,
  p_weight_basis text default 'measured',
  p_preparation_method text default null,
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if not exists(select 1 from public.recipes where id=p_recipe_id) then raise exception 'Recette introuvable'; end if;
  if p_final_weight_g is null then
    delete from public.recipe_yield_profiles where recipe_id=p_recipe_id;
    return jsonb_build_object('status','recipe_yield_removed','recipe_id',p_recipe_id);
  end if;
  if p_final_weight_g<=0 then raise exception 'Poids final invalide'; end if;
  if p_weight_basis not in ('measured','estimated') then raise exception 'Base de poids invalide'; end if;
  insert into public.recipe_yield_profiles(recipe_id,final_weight_g,weight_basis,preparation_method,notes,updated_at)
  values(p_recipe_id,p_final_weight_g,p_weight_basis,nullif(btrim(p_preparation_method),''),nullif(btrim(p_notes),''),now())
  on conflict(recipe_id) do update set
    final_weight_g=excluded.final_weight_g,
    weight_basis=excluded.weight_basis,
    preparation_method=excluded.preparation_method,
    notes=excluded.notes,
    updated_at=now();
  return jsonb_build_object('status','recipe_yield_saved','recipe_id',p_recipe_id,'final_weight_g',p_final_weight_g,'weight_basis',p_weight_basis);
end;
$$;
revoke all on function public.mt_admin_save_recipe_yield(uuid,numeric,text,text,text) from public,anon;
grant execute on function public.mt_admin_save_recipe_yield(uuid,numeric,text,text,text) to authenticated;

-- Étend la réponse V411.2 sans changer la nutrition déjà calculée.
create or replace function public.mt_get_recipe_nutrition(p_recipe_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare out_json jsonb;
begin
  if not public.mt_recipe_access_allowed(p_recipe_id) then return null; end if;
  select jsonb_strip_nulls(jsonb_build_object(
    'kind','recipe_snapshot','immutable',false,'snapshot_scope','recipe_reference',
    'recipe_id',s.recipe_id,'servings',s.servings,'serving_label',s.serving_label,
    'reference_mass_g',round(s.total_mass_g/s.servings,2),
    'final_weight_g',y.final_weight_g,
    'portion_weight_g',case when y.final_weight_g is not null then round(y.final_weight_g/s.servings,2) end,
    'yield',case when y.recipe_id is not null then jsonb_build_object(
      'final_weight_g',y.final_weight_g,
      'weight_basis',y.weight_basis,
      'preparation_method',y.preparation_method,
      'notes',y.notes,
      'scope','Le poids final répartit les nutriments calculés des ingrédients sur le plat préparé ; aucun facteur de rétention micronutritionnelle n’est inventé.'
    ) end,
    'core',jsonb_build_object(
      'kcal',s.kcal_per_serving,'protein_g',s.protein_per_serving_g,'fat_g',s.fat_per_serving_g,
      'carbs_g',s.carbs_per_serving_g,'fiber_g',s.fiber_per_serving_g,'salt_g',s.salt_per_serving_g,
      'energy_kj',s.energy_kj_per_serving
    ),
    'core_per_100g_finished',case when y.final_weight_g is not null and y.final_weight_g>0 then jsonb_strip_nulls(jsonb_build_object(
      'kcal',case when s.kcal_total is not null then round(s.kcal_total*100/y.final_weight_g,2) end,
      'protein_g',case when s.protein_total_g is not null then round(s.protein_total_g*100/y.final_weight_g,2) end,
      'fat_g',case when s.fat_total_g is not null then round(s.fat_total_g*100/y.final_weight_g,2) end,
      'carbs_g',case when s.carbs_total_g is not null then round(s.carbs_total_g*100/y.final_weight_g,2) end,
      'fiber_g',case when s.fiber_total_g is not null then round(s.fiber_total_g*100/y.final_weight_g,2) end,
      'salt_g',case when s.salt_total_g is not null then round(s.salt_total_g*100/y.final_weight_g,3) end
    )) end,
    'core_coverage',s.core_coverage,
    'nutrition_extra',s.nutrition_extra_per_serving,
    'micronutrients',s.micronutrients_per_serving,
    'provenance',s.provenance,
    'calculation_version',s.calculation_version,'calculated_at',s.calculated_at,
    'nutrition_disclaimer',case when y.weight_basis='measured' then
      'Valeurs estimées depuis les ingrédients structurés. Le poids final mesuré affine le poids d’une portion et le repère pour 100 g préparés ; les pertes/rétentions liées à la cuisson ne sont pas inventées.'
    else
      'Valeurs estimées depuis les ingrédients structurés. Le poids final est lui-même estimé ; les pertes/rétentions liées à la cuisson ne sont pas inventées.'
    end
  )) into out_json
  from public.recipe_nutrition_snapshots s
  left join public.recipe_yield_profiles y on y.recipe_id=s.recipe_id
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
    'yield',(select to_jsonb(y) from public.recipe_yield_profiles y where y.recipe_id=p_recipe_id),
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

-- -----------------------------------------------------------------------------
-- 2. SNAPSHOT NUTRITIONNEL DES BOISSONS QUANTIFIÉES
-- -----------------------------------------------------------------------------
alter table public.user_beverage_entries
  add column if not exists composition_quantified boolean not null default false,
  add column if not exists nutrition_snapshot jsonb,
  add column if not exists nutrition_snapshot_version text,
  add column if not exists nutrition_snapshot_calculated_at timestamptz;

create or replace function public.mt_botanical_ingredient_nutrition_reference(p_ingredient_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare r public.botanical_ingredient_nutrition_refs%rowtype;
declare i public.botanical_ingredients%rowtype;
begin
  select * into r from public.botanical_ingredient_nutrition_refs where ingredient_id=p_ingredient_id and nutrition_verified=true;
  if not found then return null; end if;
  select * into i from public.botanical_ingredients where id=p_ingredient_id and enabled=true;
  if not found then return null; end if;
  if r.nutrition_source_kind='ciqual' then
    return public.mt_nutrition_reference(r.ciqual_code,null)
      || jsonb_build_object('ingredient_id',p_ingredient_id,'ingredient_name',i.display_name,'botanical_source_label',r.source_label);
  end if;
  return jsonb_build_object(
    'kind','botanical_product_reference','ingredient_id',p_ingredient_id,'ingredient_name',i.display_name,
    'reference_kind','product_label','nutrition_basis','100g','source_label',r.source_label,
    'reference_100g',jsonb_build_object(
      'kcal_100g',r.custom_kcal_100g,'protein_100g',r.custom_protein_100g,'fat_100g',r.custom_fat_100g,
      'carbs_100g',r.custom_carbs_100g,'fiber_100g',r.custom_fiber_100g,'salt_100g',r.custom_salt_100g,
      'nutrition_extra_100g',coalesce(r.custom_nutrition_extra_100g,'{}'::jsonb),
      'micronutrients_100g',coalesce(r.custom_micronutrients_100g,'{}'::jsonb)
    )
  );
end;
$$;
revoke all on function public.mt_botanical_ingredient_nutrition_reference(uuid) from public,anon;
grant execute on function public.mt_botanical_ingredient_nutrition_reference(uuid) to authenticated;

create or replace function public.mt_get_botanical_blend_reference_items(p_blend_id uuid)
returns jsonb
language sql stable security definer set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient_id',i.id,
    'display_name',i.display_name,
    'quantity_g',ri.mass_equivalent_g,
    'quantity_value',ri.quantity_value,
    'quantity_unit',ri.quantity_unit,
    'standardization_basis',ri.standardization_basis,
    'included_in_reference',ri.included_in_reference,
    'has_nutrition_reference',r.ingredient_id is not null
  ) order by ri.ingredient_id),'[]'::jsonb)
  from public.botanical_blend_nutrition_recipe_items ri
  join public.botanical_ingredients i on i.id=ri.ingredient_id
  left join public.botanical_ingredient_nutrition_refs r on r.ingredient_id=i.id and r.nutrition_verified=true
  join public.botanical_blends b on b.id=ri.blend_id and b.enabled=true
  where ri.blend_id=p_blend_id and ri.included_in_reference=true;
$$;
revoke all on function public.mt_get_botanical_blend_reference_items(uuid) from public,anon;
grant execute on function public.mt_get_botanical_blend_reference_items(uuid) to authenticated;

create or replace function public.mt_calculate_botanical_beverage_nutrition(p_items jsonb)
returns jsonb
language sql stable security definer set search_path=public
as $$
with inp as (
  select
    nullif(x->>'ingredient_id','')::uuid ingredient_id,
    nullif(replace(x->>'quantity_g',',','.'),'')::numeric quantity_g
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x
  where nullif(x->>'ingredient_id','') is not null
    and nullif(replace(x->>'quantity_g',',','.'),'') is not null
    and replace(x->>'quantity_g',',','.')::numeric>0
), refs as (
  select inp.*,public.mt_botanical_ingredient_nutrition_reference(inp.ingredient_id) ref
  from inp
), valid as (
  select * from refs where ref is not null
), counts as (
  select (select count(*) from inp)::int total_items,(select count(*) from valid)::int documented_items
), vals as (
  select ingredient_id,quantity_g,ref,
    nullif(ref->'reference_100g'->>'kcal_100g','')::numeric kcal100,
    nullif(ref->'reference_100g'->>'protein_100g','')::numeric protein100,
    nullif(ref->'reference_100g'->>'fat_100g','')::numeric fat100,
    nullif(ref->'reference_100g'->>'carbs_100g','')::numeric carbs100,
    nullif(ref->'reference_100g'->>'fiber_100g','')::numeric fiber100,
    nullif(ref->'reference_100g'->>'salt_100g','')::numeric salt100
  from valid
), core as (
  select
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.kcal100)=c.total_items then round(sum(v.kcal100*v.quantity_g/100),2) end kcal,
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.protein100)=c.total_items then round(sum(v.protein100*v.quantity_g/100),2) end protein_g,
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.fat100)=c.total_items then round(sum(v.fat100*v.quantity_g/100),2) end fat_g,
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.carbs100)=c.total_items then round(sum(v.carbs100*v.quantity_g/100),2) end carbs_g,
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.fiber100)=c.total_items then round(sum(v.fiber100*v.quantity_g/100),2) end fiber_g,
    case when c.total_items>0 and c.documented_items=c.total_items and count(v.salt100)=c.total_items then round(sum(v.salt100*v.quantity_g/100),3) end salt_g,
    round(coalesce(sum(v.quantity_g),0),2) reference_mass_g,
    c.total_items,c.documented_items,
    count(v.kcal100)::int kcal_n,count(v.protein100)::int protein_n,count(v.fat100)::int fat_n,count(v.carbs100)::int carbs_n,count(v.fiber100)::int fiber_n,count(v.salt100)::int salt_n
  from counts c left join vals v on true
  group by c.total_items,c.documented_items
), extra_keys as (
  select distinct k key
  from vals v cross join lateral jsonb_object_keys(coalesce(v.ref->'reference_100g'->'nutrition_extra_100g','{}'::jsonb)) k
  where left(k,1)<>'_'
), extra_values as (
  select k.key,v.ingredient_id,v.quantity_g,
    public.mt_nutrition_extra_num(v.ref->'reference_100g'->'nutrition_extra_100g',k.key) * v.quantity_g/100 value,
    coalesce(v.ref->'reference_100g'->'nutrition_extra_100g'->k.key->>'unit',
      case when k.key like '%_mg' then 'mg' when k.key like '%_ug' then 'µg' when k.key='energy_kj' then 'kJ' else 'g' end) unit
  from extra_keys k cross join vals v
), extra_agg as (
  select key,count(*) total,count(value) documented,sum(value) filter(where value is not null) val,max(unit) unit
  from extra_values group by key
), extra_obj as (
  select coalesce(jsonb_object_agg(key,jsonb_strip_nulls(jsonb_build_object(
    'status',case when documented=0 then 'undocumented' when documented=total then 'complete' else 'partial' end,
    'value',case when documented=total then round(val,4) end,
    'partial_value',case when documented>0 and documented<total then round(val,4) end,
    'unit',unit
  ))),'{}'::jsonb) value from extra_agg
), micro_keys as (
  select distinct k key
  from vals v cross join lateral jsonb_object_keys(coalesce(v.ref->'reference_100g'->'micronutrients_100g','{}'::jsonb)) k
  where left(k,1)<>'_'
), micro_values as (
  select k.key,v.ingredient_id,v.quantity_g,
    public.mt_nutrition_json_num(v.ref->'reference_100g'->'micronutrients_100g',k.key) * v.quantity_g/100 value,
    coalesce(v.ref->'reference_100g'->'micronutrients_100g'->k.key->>'unit',
      case when k.key like '%_ug' then 'µg' when k.key like '%_mg' then 'mg' else 'g' end) unit
  from micro_keys k cross join vals v
), micro_agg as (
  select key,count(*) total,count(value) documented,sum(value) filter(where value is not null) val,max(unit) unit
  from micro_values group by key
), micro_obj as (
  select coalesce(jsonb_object_agg(key,jsonb_strip_nulls(jsonb_build_object(
    'status',case when documented=0 then 'undocumented' when documented=total then 'complete' else 'partial' end,
    'value',case when documented=total then round(val,4) end,
    'partial_value',case when documented>0 and documented<total then round(val,4) end,
    'unit',unit
  ))),'{}'::jsonb) value from micro_agg
), provenance as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient_id',ingredient_id,
    'ingredient_name',ref->>'ingredient_name',
    'quantity_g',quantity_g,
    'source_label',coalesce(ref->>'source_label',ref->>'botanical_source_label'),
    'reference_kind',ref->>'reference_kind'
  ) order by ref->>'ingredient_name'),'[]'::jsonb) value from vals
)
select case when c.total_items=0 then jsonb_build_object('status','empty') else jsonb_build_object(
  'kind','beverage_consumption_snapshot',
  'immutable',false,
  'snapshot_scope','quantities_entered',
  'reference_mass_g',c.reference_mass_g,
  'core',jsonb_strip_nulls(jsonb_build_object('kcal',c.kcal,'protein_g',c.protein_g,'fat_g',c.fat_g,'carbs_g',c.carbs_g,'fiber_g',c.fiber_g,'salt_g',c.salt_g,'energy_kj',case when c.kcal is not null then round(c.kcal*4.184,1) end)),
  'core_coverage',jsonb_build_object(
    'kcal',case when c.kcal_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.kcal_n>0 then 'partial' else 'undocumented' end,
    'protein_g',case when c.protein_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.protein_n>0 then 'partial' else 'undocumented' end,
    'fat_g',case when c.fat_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.fat_n>0 then 'partial' else 'undocumented' end,
    'carbs_g',case when c.carbs_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.carbs_n>0 then 'partial' else 'undocumented' end,
    'fiber_g',case when c.fiber_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.fiber_n>0 then 'partial' else 'undocumented' end,
    'salt_g',case when c.salt_n=c.total_items and c.documented_items=c.total_items then 'complete' when c.salt_n>0 then 'partial' else 'undocumented' end
  ),
  'nutrition_extra',(select value from extra_obj),
  'micronutrients',(select value from micro_obj),
  'provenance',(select value from provenance),
  'calculation_version','MT_BEVERAGE_ACTUAL_V1',
  'nutrition_disclaimer','Calcul fondé sur les quantités réellement saisies et les références nutritionnelles disponibles. Une donnée absente reste non documentée ; aucun zéro n’est inventé.'
) end
from core c;
$$;
revoke all on function public.mt_calculate_botanical_beverage_nutrition(jsonb) from public,anon;
grant execute on function public.mt_calculate_botanical_beverage_nutrition(jsonb) to authenticated;

-- Vérifications de non-régression historique.
do $final_guard$
declare g mt_v4113_guard%rowtype; current_hash text;
begin
  select * into g from mt_v4113_guard;
  if (select count(*) from public.food_meal_items)<>g.meal_items then raise exception 'Ancien repas modifié.'; end if;
  if (select count(*) from public.user_beverage_entries)<>g.beverage_entries then raise exception 'Nombre d’anciennes boissons modifié.'; end if;
  select md5(string_agg(concat_ws('|',id,user_id,entry_date,consumed_at,beverage_kind,display_name,volume_ml,hydration_ml,source_mode,catalog_blend_id,user_blend_id,ingredients_snapshot,composition_known,energy_after,digestion_after,notes),E'\n' order by id)) into current_hash from public.user_beverage_entries;
  if current_hash is distinct from g.beverage_hash then raise exception 'Contenu historique des boissons modifié.'; end if;
end
$final_guard$;

commit;

select jsonb_pretty(jsonb_build_object(
  'status','v411_3_precision_reelle_backend_pret',
  'recipe_final_weight_ready',to_regclass('public.recipe_yield_profiles') is not null,
  'recipe_yield_rpc_ready',to_regprocedure('public.mt_admin_save_recipe_yield(uuid,numeric,text,text,text)') is not null,
  'actual_beverage_calculator_ready',to_regprocedure('public.mt_calculate_botanical_beverage_nutrition(jsonb)') is not null,
  'blend_reference_items_ready',to_regprocedure('public.mt_get_botanical_blend_reference_items(uuid)') is not null,
  'historical_meals_rewritten',false,
  'historical_beverages_rewritten',false,
  'policy','Les portions génériques restent des estimations tant qu’un poids réel n’est pas saisi. Aucun facteur de cuisson non documenté n’est inventé.'
)) as result;
