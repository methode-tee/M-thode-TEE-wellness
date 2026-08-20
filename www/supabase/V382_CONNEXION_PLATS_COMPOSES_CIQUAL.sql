-- Méthode Tee V382
-- Connecte automatiquement les plats composés CIQUAL à Adapter mon repas.
-- À exécuter après V376, V379 et V380. Migration idempotente.

with base as (
  select
    c.code,
    trim(regexp_replace(c.name,'[\n\r]+',' ','g')) clean_name,
    public.food_normalize(c.search_text) search_name,
    coalesce(c.kcal_100g,0) kcal,
    coalesce(c.protein_100g,0) protein,
    coalesce(c.fat_100g,0) fat,
    coalesce(c.carbs_100g,0) carbs,
    coalesce(c.fiber_100g,0) fiber,
    coalesce(c.salt_100g,0) salt,
    c.source
  from public.ciqual_foods c
  where public.food_normalize(c.search_text) like '%entrees et plats composes%'
), classified as (
  select b.*,
    array_remove(array[
      'composite_dish'::text,
      case when b.protein>=7 or b.search_name ~ '(boeuf|porc|poulet|dinde|canard|agneau|mouton|poisson|thon|saumon|crevette|crabe|oeuf|tofu|lentille|haricot|pois chiche)' then 'protein' end,
      case when b.carbs>=12 or b.search_name ~ '(riz|pates|nouille|semoule|couscous|pain|pomme de terre|patate|quinoa|boulgour|tortilla|pizza|quiche|tarte|crepe|galette)' then 'starch' end,
      case when b.fiber>=2.5 or b.search_name ~ '(legume|salade|tomate|carotte|courgette|poireau|epinard|chou|aubergine|poivron|champignon|crudite)' then 'vegetable' end,
      case when b.fat>=10 or b.search_name ~ '(creme|mayonnaise|bechamel|fromage|lardon|sauce)' then 'rich_sauce' end,
      case when b.search_name ~ '(frit|frite|beignet|nem|tempura|nugget|croquette|cordon bleu)' then 'fried' end
    ],null)::text[] categories
  from base b
), profiled as (
  select c.*,
    case
      when c.search_name ~ '(burger|hamburger|cheeseburger)' then 'burger'
      when c.search_name ~ '(nem|pate imperial|ravioli|samoussa|brick|feuillete)' then 'filled_dough'
      when c.search_name ~ '(soupe|potage|bouillon|veloute|bisque)' then 'soup'
      when c.search_name ~ '(nouille|spaghetti|tagliatelle|lasagne|cannelloni|pates)' then 'noodle_dish'
      when c.search_name ~ '(frit|frite|beignet|tempura|nugget|croquette)' then 'fried_snack'
      when 'protein'=any(c.categories) and ('starch'=any(c.categories) or 'vegetable'=any(c.categories)) then 'complete_composite'
      when 'protein'=any(c.categories) then 'protein_main'
      else 'variable_composite'
    end adapter_family,
    split_part(c.clean_name,',',1) short_name
  from classified c
)
insert into public.food_dictionary(
  canonical_name,display_name,aliases,country,ciqual_code,enabled,priority,
  meal_contexts,categories,typical_components,optional_components,
  adapter_profile,source
)
select
  p.clean_name,
  p.clean_name,
  array_remove(array[
    p.clean_name,
    p.short_name,
    trim(regexp_replace(p.short_name,' (au|aux|a la|à la|avec|de|du|des) .*$','','i'))
  ],'')::text[],
  null,
  p.code,
  true,
  60,
  array['lunch','dinner']::text[],
  p.categories,
  jsonb_build_array(p.short_name),
  '[]'::jsonb,
  jsonb_build_object(
    'adapter_family',p.adapter_family,
    'composition_variable',true,
    'ciqual_composite',true,
    'kcal_100g',p.kcal,
    'protein_100g',p.protein,
    'fat_100g',p.fat,
    'carbs_100g',p.carbs,
    'fiber_100g',p.fiber,
    'salt_100g',p.salt
  ),
  coalesce(p.source,'ANSES - Table Ciqual 2025')
from profiled p
on conflict(normalized_name) do update set
  ciqual_code=coalesce(public.food_dictionary.ciqual_code,excluded.ciqual_code),
  aliases=case when public.food_dictionary.priority<=30 then public.food_dictionary.aliases else excluded.aliases end,
  categories=case when public.food_dictionary.priority<=30 then public.food_dictionary.categories else excluded.categories end,
  adapter_profile=case when public.food_dictionary.priority<=30 then public.food_dictionary.adapter_profile else excluded.adapter_profile end,
  source=case when public.food_dictionary.priority<=30 then public.food_dictionary.source else excluded.source end,
  enabled=true,
  updated_at=now();

-- Profils génériques prioritaires lorsque la personne écrit seulement le nom
-- de la famille, sans préciser la variante CIQUAL exacte.
insert into public.food_dictionary(
  canonical_name,display_name,aliases,country,enabled,priority,meal_contexts,
  categories,typical_components,optional_components,adapter_profile,source
) values
('Cassoulet','Cassoulet',array['cassoulet'],null,true,20,array['lunch','dinner'],
 array['protein','starch','vegetable','composite_dish'],jsonb_build_array('haricots blancs','viande'),jsonb_build_array('porc','canard','oie','saucisse'),
 '{"adapter_family":"complete_composite","composition_variable":true,"composite_complete":true}'::jsonb,'Méthode Tee · ANSES CIQUAL 2025'),
('Couscous','Couscous',array['couscous'],null,true,20,array['lunch','dinner'],
 array['starch','vegetable','composite_dish'],jsonb_build_array('semoule','légumes','bouillon'),jsonb_build_array('poulet','mouton','poisson','pois chiches'),
 '{"adapter_family":"complete_composite","composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb,'Méthode Tee · ANSES CIQUAL 2025'),
('Nem','Nem / pâté impérial',array['nem','nems','pâté impérial','pate imperial'],null,true,20,array['lunch','snack','dinner'],
 array['starch','fried','composite_dish'],jsonb_build_array('galette de riz','farce','friture'),jsonb_build_array('poulet','porc','crevettes','crabe','légumes'),
 '{"adapter_family":"filled_dough","composition_variable":true,"protein_is_variable":true}'::jsonb,'Méthode Tee · ANSES CIQUAL 2025')
on conflict(normalized_name) do update set
  display_name=excluded.display_name,aliases=excluded.aliases,categories=excluded.categories,
  typical_components=excluded.typical_components,optional_components=excluded.optional_components,
  adapter_profile=excluded.adapter_profile,priority=excluded.priority,enabled=true,updated_at=now();

-- Alias génériques pour les familles dont CIQUAL possède plusieurs variantes.
update public.food_dictionary set aliases=(select array_agg(distinct a) from unnest(aliases||array['cassoulet']) a)
where ciqual_code in ('25002','25098','25099');

update public.food_dictionary set aliases=(select array_agg(distinct a) from unnest(aliases||array['couscous']) a)
where public.food_normalize(canonical_name) like 'couscous%';

update public.food_dictionary set aliases=(select array_agg(distinct a) from unnest(aliases||array['nem','nems','pâté impérial','pate imperial']) a)
where public.food_normalize(canonical_name) ~ '^(nem|pate imperial)';

-- Contrôle : nombre de plats CIQUAL désormais accessibles au moteur.
select
  count(*) filter(where adapter_profile->>'ciqual_composite'='true') ciqual_composites_connected,
  count(*) filter(where enabled) total_dictionary_entries
from public.food_dictionary;
