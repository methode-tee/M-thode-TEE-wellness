-- V391 — Smoothies et desserts adaptables Méthode Tee
-- À exécuter après V376. Idempotent : peut être relancé sans doublon.
-- Les compositions restent indicatives : aucune valeur nutritionnelle n'est
-- inventée pour un mélange dont les quantités réelles ne sont pas connues.

with seed(name,display,aliases,contexts,categories,typical,optional,profile,priority) as (values
  ('Smoothie fruits rouges et yaourt grec','Smoothie fruits rouges & yaourt grec',array['smoothie fruits rouges','smoothie framboise myrtille'],array['breakfast','snack'],array['fruit','dairy_protein','composite_dish'],
    '["framboises","myrtilles","yaourt grec","lait d’amande"]'::jsonb,'["vanille","graines de chia"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,18),
  ('Smoothie banane amande et avoine','Smoothie banane, amande & avoine',array['smoothie banane amande','smoothie banane avoine'],array['breakfast','snack'],array['fruit','wholegrain','composite_dish'],
    '["banane","lait d’amande","flocons d’avoine"]'::jsonb,'["purée d’amandes","cannelle"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,20),
  ('Smoothie mangue coco','Smoothie mangue & coco',array['smoothie mangue coco','lassi mangue coco'],array['breakfast','snack'],array['fruit','composite_dish'],
    '["mangue","lait de coco"]'::jsonb,'["yaourt grec","citron vert","gingembre"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,20),
  ('Smoothie ananas coco et gingembre','Smoothie ananas, coco & gingembre',array['smoothie ananas coco','smoothie ananas gingembre'],array['breakfast','snack'],array['fruit','composite_dish'],
    '["ananas","lait de coco","gingembre"]'::jsonb,'["citron vert","graines de chia"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Smoothie fraise skyr et vanille','Smoothie fraise, skyr & vanille',array['smoothie fraise skyr','smoothie fraise yaourt'],array['breakfast','snack'],array['fruit','dairy_protein','composite_dish'],
    '["fraises","skyr","lait"]'::jsonb,'["vanille","amandes"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Smoothie cacao banane et amande','Smoothie cacao, banane & amande',array['smoothie cacao banane','smoothie chocolat banane'],array['breakfast','snack'],array['fruit','composite_dish'],
    '["banane","lait d’amande","cacao non sucré"]'::jsonb,'["purée d’amandes","flocons d’avoine"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"smoothie","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Verrine de yaourt grec aux fruits rouges','Verrine grecque aux fruits rouges',array['verrine fruits rouges','verrine yaourt grec'],array['breakfast','snack','dessert'],array['fruit','dairy_protein','composite_dish'],
    '["yaourt grec","framboises","myrtilles"]'::jsonb,'["amandes","vanille","menthe"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"verrine","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,18),
  ('Bowl yaourt pomme et cannelle','Bowl yaourt, pomme & cannelle',array['bowl pomme cannelle','yaourt pomme cannelle'],array['breakfast','snack','dessert'],array['fruit','dairy_protein','composite_dish'],
    '["yaourt nature","pomme","cannelle"]'::jsonb,'["flocons d’avoine","noix"]'::jsonb,
    '{"adapter_family":"sweet_bowl","preparation_kind":"bowl","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Pudding coco et graines de chia','Pudding coco & graines de chia',array['chia pudding coco','pudding chia coco'],array['breakfast','snack','dessert'],array['nuts_seeds','composite_dish'],
    '["lait de coco","graines de chia"]'::jsonb,'["framboises","myrtilles","mangue","vanille"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"pudding","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,18),
  ('Pudding amande vanille et poire','Pudding amande, vanille & poire',array['pudding amande poire','chia pudding poire'],array['breakfast','snack','dessert'],array['fruit','nuts_seeds','composite_dish'],
    '["lait d’amande","graines de chia","poire"]'::jsonb,'["vanille","amandes"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"pudding","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Nice cream banane cacao','Glace minute banane & cacao',array['nice cream banane cacao','glace banane cacao','glace minute banane'],array['snack','dessert'],array['fruit','composite_dish'],
    '["banane congelée","cacao non sucré"]'::jsonb,'["purée d’amandes","yaourt grec"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"frozen_dessert","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,22),
  ('Compote pomme poire et cannelle','Compote pomme, poire & cannelle',array['compote pomme poire','dessert pomme poire'],array['snack','dessert'],array['fruit','composite_dish'],
    '["pomme","poire","cannelle"]'::jsonb,'["vanille","citron"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"compote","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24),
  ('Pomme rôtie yaourt et amandes','Pomme rôtie, yaourt & amandes',array['pomme rotie yaourt','pomme au four yaourt'],array['snack','dessert'],array['fruit','dairy_protein','nuts_seeds','composite_dish'],
    '["pomme","yaourt nature","amandes"]'::jsonb,'["cannelle","vanille"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"baked_fruit","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24),
  ('Crème coco mangue et citron vert','Crème coco, mangue & citron vert',array['creme coco mangue','dessert mangue coco'],array['snack','dessert'],array['fruit','composite_dish'],
    '["mangue","yaourt coco","citron vert"]'::jsonb,'["graines de chia","menthe"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"cream","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24),
  ('Bouchées dattes amandes et cacao','Bouchées dattes, amandes & cacao',array['energy balls dattes','boules dattes cacao','bouchees dattes amandes'],array['snack','dessert'],array['fruit','nuts_seeds','composite_dish'],
    '["dattes","amandes","cacao non sucré"]'::jsonb,'["noix de coco","vanille"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"energy_bite","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24),
  ('Salade de fruits agrumes et menthe','Salade de fruits, agrumes & menthe',array['salade de fruits agrumes','salade fruits menthe'],array['breakfast','snack','dessert'],array['fruit','composite_dish'],
    '["orange","pamplemousse","menthe"]'::jsonb,'["grenade","citron vert"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"fruit_salad","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24),
  ('Écorces glacées yaourt et fruits rouges','Éclats glacés de yaourt & fruits rouges',array['bark yaourt fruits rouges','yaourt glace fruits rouges','eclats glaces yaourt'],array['snack','dessert'],array['fruit','dairy_protein','composite_dish'],
    '["yaourt grec","framboises","myrtilles"]'::jsonb,'["pistaches","vanille"]'::jsonb,
    '{"adapter_family":"sweet_dish","preparation_kind":"frozen_dessert","sweet_preparation":true,"do_not_auto_suggest_vegetables":true}'::jsonb,24)
)
insert into public.food_dictionary(
  canonical_name,display_name,aliases,meal_contexts,categories,
  typical_components,optional_components,adapter_profile,priority,source,enabled
)
select name,display,aliases,contexts,categories,typical,optional,profile,priority,
  'Méthode Tee — catalogue sucré',true
from seed
on conflict(normalized_name) do update set
  display_name=excluded.display_name,
  aliases=excluded.aliases,
  meal_contexts=excluded.meal_contexts,
  categories=excluded.categories,
  typical_components=excluded.typical_components,
  optional_components=excluded.optional_components,
  adapter_profile=public.food_dictionary.adapter_profile||excluded.adapter_profile,
  priority=excluded.priority,
  source=excluded.source,
  enabled=true,
  updated_at=now();

select adapter_profile->>'preparation_kind' as preparation_kind,count(*) as entries
from public.food_dictionary
where enabled and coalesce(adapter_profile->>'sweet_preparation','false')='true'
group by adapter_profile->>'preparation_kind'
order by preparation_kind;

notify pgrst,'reload schema';
