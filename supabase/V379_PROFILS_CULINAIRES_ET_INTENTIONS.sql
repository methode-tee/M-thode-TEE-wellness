-- Méthode Tee V379
-- Profils culinaires utilisés par Adapter mon repas.
-- À exécuter après V376 puis V377. Migration idempotente.

-- Les plats sont classés par logique culinaire, jamais par origine géographique.
-- Le moteur conserve le nom et la structure du plat, puis adapte uniquement
-- le levier pertinent à l'intention choisie.

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"sweet_bowl","do_not_auto_suggest_vegetables":true}'::jsonb
where canonical_name in ('Muesli','Flocons d''avoine','Lakh');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"sweet_dish","do_not_auto_suggest_vegetables":true}'::jsonb
where canonical_name in ('Mango sticky rice');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"starch_side"}'::jsonb
where canonical_name in ('Foutou banane','Foutou igname','Placali','Pounded yam','Eba','Amala','Banku','Kenkey','Achu');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"soup","composition_variable":true}'::jsonb
where canonical_name in ('Harira','Chorba frik','Bissara','Lablabi','Tom yum');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"noodle_dish","composition_variable":true}'::jsonb
where canonical_name in ('Ramen','Pad thaï','Rechta','Udon','Soba','Yakisoba');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"sauce_dish","composition_variable":true}'::jsonb
where canonical_name in ('Ndolè','Okok','Mbongo tchobi','Mafé','Domoda','Soupou kandja','Sauce graine','Mapo tofu','Curry vert','Curry rouge');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"filled_dough","composition_variable":true}'::jsonb
where canonical_name in ('Mhadjeb','Baozi','Jiaozi','Onigiri','Brik');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"fried_snack"}'::jsonb
where canonical_name in ('Akara');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"protein_main"}'::jsonb
where canonical_name in ('Suya','Caldou');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"complete_composite","composite_complete":true}'::jsonb
where canonical_name in ('Poulet DG','Red red','Kedjenou','Rfissa');

update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"variable_composite","composition_variable":true}'::jsonb
where canonical_name in ('Thiéré','Riz gras','Chakhchoukha','Karantika');

-- Msemen peut être servi seul, sucré ou salé : aucune variante n'est supposée.
update public.food_dictionary set adapter_profile=adapter_profile||'{"adapter_family":"flatbread","composition_variable":true,"do_not_auto_suggest_vegetables":true}'::jsonb
where canonical_name='Msemen';

-- Profil générique pour burger/hamburger. La garniture est toujours confirmée
-- avant le conseil car elle peut être carnée, végétale ou absente.
insert into public.food_dictionary(
  canonical_name,display_name,aliases,country,meal_contexts,categories,
  typical_components,optional_components,adapter_profile,priority,source,enabled
) values (
  'Burger','Burger',array['burger','hamburger','cheeseburger'],null,
  array['lunch','dinner'],array['starch','composite_dish'],
  jsonb_build_array('pain'),jsonb_build_array('steak','poulet','poisson','galette végétale','fromage','salade','tomate','sauce'),
  '{"adapter_family":"burger","composition_variable":true}'::jsonb,20,'tee',true
)
on conflict(normalized_name) do update set
  aliases=excluded.aliases,categories=excluded.categories,
  typical_components=excluded.typical_components,optional_components=excluded.optional_components,
  adapter_profile=public.food_dictionary.adapter_profile||excluded.adapter_profile,
  enabled=true,updated_at=now();

-- Les plats non classés explicitement gardent une famille déterminée par leurs
-- catégories. Cela couvre aussi les futures entrées créées depuis l'admin.
update public.food_dictionary set adapter_profile=adapter_profile||jsonb_build_object(
  'adapter_family',case
    when 'fried'=any(categories) and 'composite_dish'=any(categories) then 'fried_snack'
    when 'protein'=any(categories) and not ('starch'=any(categories)) then 'protein_main'
    when 'composite_dish'=any(categories) then 'variable_composite'
    else 'general'
  end
)
where coalesce(adapter_profile->>'adapter_family','')='';

select adapter_profile->>'adapter_family' family,count(*) entries
from public.food_dictionary where enabled
group by adapter_profile->>'adapter_family' order by family;
