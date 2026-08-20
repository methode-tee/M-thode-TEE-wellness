-- Méthode Tee V380
-- Enrichissement précis des 53 plats encore classés variable_composite.
-- À exécuter après V379. Migration idempotente.

with profiles(name,categories,typical,optional,family,extra) as (values
('Foufou de manioc',array['starch','composite_dish'],jsonb_build_array('manioc pilé'),jsonb_build_array('sauce','feuilles','viande','poisson'),'starch_side','{}'::jsonb),
('Riz gras',array['starch','vegetable','composite_dish'],jsonb_build_array('riz','tomate','oignon','matière grasse'),jsonb_build_array('viande','poisson','légumes'),'complete_composite','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Chakhchoukha',array['starch','vegetable','composite_dish'],jsonb_build_array('galette émiettée','sauce tomate','légumes'),jsonb_build_array('viande','pois chiches'),'complete_composite','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Dolma algérienne',array['vegetable','starch','composite_dish'],jsonb_build_array('légumes farcis','farce','sauce'),jsonb_build_array('viande hachée','riz','pois chiches'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Karantika',array['protein','starch','composite_dish'],jsonb_build_array('farine de pois chiche','eau','huile'),jsonb_build_array('œuf','cumin','harissa','pain'),'protein_main','{}'::jsonb),
('Karantika / Garantita',array['protein','starch','composite_dish'],jsonb_build_array('farine de pois chiche','eau','huile'),jsonb_build_array('œuf','cumin','harissa','pain'),'protein_main','{}'::jsonb),
('Mhadjeb / Mahjouba',array['starch','vegetable','composite_dish'],jsonb_build_array('galette de semoule','tomate','oignon'),jsonb_build_array('poivron','piment','huile'),'filled_dough','{"already_contains_vegetable":true,"composition_variable":true}'::jsonb),
('Achu / Taro sauce jaune',array['starch','rich_sauce','composite_dish'],jsonb_build_array('taro','sauce jaune','huile de palme','épices'),jsonb_build_array('viande','poisson'),'starch_side','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Beignets-haricots-bouillie',array['starch','protein','fried','composite_dish'],jsonb_build_array('beignets','haricots','bouillie de maïs'),jsonb_build_array('sucre','huile'),'complete_composite','{"composite_complete":true}'::jsonb),
('Eru',array['vegetable','rich_sauce','composite_dish'],jsonb_build_array('feuilles d''eru','waterleaf','huile de palme'),jsonb_build_array('écrevisses','poisson','viande','peau de bœuf'),'sauce_dish','{"composition_variable":true,"already_contains_vegetable":true,"protein_is_variable":true,"do_not_auto_suggest_vegetables":true}'::jsonb),
('Foufou de maïs',array['starch','composite_dish'],jsonb_build_array('farine de maïs'),jsonb_build_array('sauce','feuilles','viande','poisson'),'starch_side','{}'::jsonb),
('Koki de haricots',array['protein','rich_sauce','composite_dish'],jsonb_build_array('haricots','huile de palme'),jsonb_build_array('plantain','manioc','piment'),'protein_main','{}'::jsonb),
('Koki de maïs',array['starch','rich_sauce','composite_dish'],jsonb_build_array('maïs','huile de palme'),jsonb_build_array('feuilles','poisson fumé'),'variable_composite','{"composition_variable":true}'::jsonb),
('Kpem',array['vegetable','rich_sauce','composite_dish'],jsonb_build_array('feuilles de manioc','jus de noix de palme'),jsonb_build_array('poisson fumé','viande'),'sauce_dish','{"composition_variable":true,"already_contains_vegetable":true,"protein_is_variable":true}'::jsonb),
('Sanga',array['starch','vegetable','rich_sauce','composite_dish'],jsonb_build_array('maïs','feuilles de manioc','jus de noix de palme'),jsonb_build_array('sucre','poisson'),'complete_composite','{"composition_variable":true,"already_contains_vegetable":true}'::jsonb),
('Canard laqué',array['protein','rich_sauce','composite_dish'],jsonb_build_array('canard','laque sucrée-salée'),jsonb_build_array('crêpes','riz','concombre','cébette'),'protein_main','{}'::jsonb),
('Chow mein',array['starch','vegetable','composite_dish'],jsonb_build_array('nouilles sautées','légumes'),jsonb_build_array('poulet','bœuf','porc','crevettes','tofu'),'noodle_dish','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Jiaozi / raviolis chinois',array['starch','composite_dish'],jsonb_build_array('pâte','farce'),jsonb_build_array('porc','crevettes','tofu','chou','ciboule'),'filled_dough','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Soupe wonton',array['starch','protein','soup','composite_dish'],jsonb_build_array('bouillon','raviolis wonton'),jsonb_build_array('porc','crevettes','légumes','nouilles'),'soup','{"composition_variable":true}'::jsonb),
('Chikwangue / Kwanga',array['starch','composite_dish'],jsonb_build_array('manioc fermenté'),jsonb_build_array('sauce','poisson','viande','feuilles'),'starch_side','{}'::jsonb),
('Fumbwa',array['vegetable','rich_sauce','composite_dish'],jsonb_build_array('feuilles de fumbwa','arachide'),jsonb_build_array('poisson fumé','viande','huile de palme'),'sauce_dish','{"composition_variable":true,"already_contains_vegetable":true,"protein_is_variable":true}'::jsonb),
('Liboké',array['protein','vegetable','composite_dish'],jsonb_build_array('poisson ou viande','tomate','oignon','cuisson en feuille'),jsonb_build_array('piment','citron','herbes'),'protein_main','{"composition_variable":true,"already_contains_vegetable":true}'::jsonb),
('Makayabu',array['protein','salty','composite_dish'],jsonb_build_array('poisson salé'),jsonb_build_array('oignon','tomate','piment','manioc','plantain'),'protein_main','{}'::jsonb),
('Mikaté',array['starch','fried','added_sugar','composite_dish'],jsonb_build_array('farine','levure','friture'),jsonb_build_array('sucre'),'fried_snack','{"do_not_auto_suggest_vegetables":true}'::jsonb),
('Ntaba',array['protein','composite_dish'],jsonb_build_array('chèvre grillée','épices'),jsonb_build_array('oignon','piment','chikwangue','plantain'),'protein_main','{}'::jsonb),
('Pondu / Saka-saka',array['vegetable','rich_sauce','composite_dish'],jsonb_build_array('feuilles de manioc','huile de palme'),jsonb_build_array('poisson','viande','arachide'),'sauce_dish','{"composition_variable":true,"already_contains_vegetable":true,"protein_is_variable":true}'::jsonb),
('Alloco',array['starch','fried','composite_dish'],jsonb_build_array('banane plantain mûre','friture'),jsonb_build_array('piment','oignon','œuf','poisson'),'fried_snack','{}'::jsonb),
('Attiéké',array['starch','composite_dish'],jsonb_build_array('semoule de manioc fermentée'),jsonb_build_array('poisson','thon','poulet','tomate','oignon','huile'),'starch_side','{}'::jsonb),
('Garba',array['starch','protein','fried','vegetable','composite_dish'],jsonb_build_array('attiéké','thon frit','oignon','tomate'),jsonb_build_array('piment','huile'),'complete_composite','{"composite_complete":true,"already_contains_vegetable":true}'::jsonb),
('Groundnut soup',array['rich_sauce','vegetable','composite_dish'],jsonb_build_array('arachide','tomate','épices'),jsonb_build_array('poulet','viande','poisson','légumes'),'sauce_dish','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Kelewele',array['starch','fried','composite_dish'],jsonb_build_array('plantain épicé','friture'),jsonb_build_array('arachides'),'fried_snack','{}'::jsonb),
('Light soup',array['vegetable','soup','composite_dish'],jsonb_build_array('bouillon','tomate','épices'),jsonb_build_array('poisson','chèvre','poulet','bœuf'),'soup','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Waakye',array['protein','starch','composite_dish'],jsonb_build_array('riz','haricots'),jsonb_build_array('œuf','viande','poisson','gari','plantain','salade','sauce'),'complete_composite','{"composition_variable":true,"composite_complete":true}'::jsonb),
('Curry japonais',array['starch','vegetable','rich_sauce','composite_dish'],jsonb_build_array('riz','sauce curry','oignon','carotte','pomme de terre'),jsonb_build_array('bœuf','porc','poulet','tofu'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Gyudon',array['protein','starch','composite_dish'],jsonb_build_array('riz','bœuf','oignon','sauce soja-mirin'),jsonb_build_array('œuf','cébette','gingembre mariné'),'complete_composite','{"composite_complete":true}'::jsonb),
('Tempura',array['fried','composite_dish'],jsonb_build_array('pâte légère','friture'),jsonb_build_array('crevettes','poisson','légumes'),'fried_snack','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Tajine kefta',array['protein','vegetable','rich_sauce','composite_dish'],jsonb_build_array('kefta','tomate','oignon','épices'),jsonb_build_array('œuf','pain','semoule'),'sauce_dish','{"composition_variable":true,"already_contains_vegetable":true}'::jsonb),
('Egusi soup',array['protein','vegetable','rich_sauce','composite_dish'],jsonb_build_array('graines d''egusi','feuilles','huile'),jsonb_build_array('viande','poisson','écrevisses'),'sauce_dish','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Moi-moi / Moin-moin',array['protein','vegetable','composite_dish'],jsonb_build_array('haricots niébé','poivron','oignon'),jsonb_build_array('œuf','poisson','écrevisses','huile'),'protein_main','{"composition_variable":true}'::jsonb),
('Ogbono soup',array['vegetable','rich_sauce','composite_dish'],jsonb_build_array('graines d''ogbono','huile','feuilles'),jsonb_build_array('viande','poisson','écrevisses'),'sauce_dish','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Okra soup',array['vegetable','composite_dish'],jsonb_build_array('gombo','feuilles'),jsonb_build_array('viande','poisson','écrevisses','huile'),'sauce_dish','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Pepper soup',array['protein','soup','composite_dish'],jsonb_build_array('bouillon épicé','viande ou poisson'),jsonb_build_array('chèvre','poulet','poisson','abats'),'soup','{"composition_variable":true,"protein_is_variable":true}'::jsonb),
('Jollof rice',array['starch','vegetable','composite_dish'],jsonb_build_array('riz','tomate','oignon','épices'),jsonb_build_array('poulet','bœuf','poisson','légumes'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Thiéboudiène / Ceebu jën',array['protein','starch','vegetable','composite_dish'],jsonb_build_array('riz','poisson','légumes','tomate'),jsonb_build_array('huile','tamarin'),'complete_composite','{"composite_complete":true,"already_contains_vegetable":true}'::jsonb),
('Thiéré',array['starch','composite_dish'],jsonb_build_array('couscous de mil'),jsonb_build_array('sauce','légumes','viande','lait caillé'),'starch_side','{"composition_variable":true}'::jsonb),
('Yassa',array['protein','vegetable','rich_sauce','composite_dish'],jsonb_build_array('oignon','citron','moutarde','poulet ou poisson'),jsonb_build_array('riz','huile','olives'),'sauce_dish','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Khao pad',array['protein','starch','vegetable','composite_dish'],jsonb_build_array('riz sauté','œuf','légumes'),jsonb_build_array('poulet','porc','crevettes','tofu'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Som tam',array['vegetable','composite_dish'],jsonb_build_array('papaye verte','tomate','citron vert','piment'),jsonb_build_array('arachides','crevettes séchées','haricots longs'),'complete_composite','{"composition_variable":true,"already_contains_vegetable":true}'::jsonb),
('Tom kha gai',array['protein','rich_sauce','soup','composite_dish'],jsonb_build_array('poulet','lait de coco','galanga','citronnelle'),jsonb_build_array('champignons','piment','citron vert'),'soup','{"already_contains_vegetable":true}'::jsonb),
('Chakchouka',array['vegetable','composite_dish'],jsonb_build_array('tomate','poivron','oignon'),jsonb_build_array('œuf','merguez'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb),
('Fricassé tunisien',array['protein','starch','fried','vegetable','composite_dish'],jsonb_build_array('pain frit','thon','pomme de terre','œuf'),jsonb_build_array('harissa','olives','salade méchouia'),'complete_composite','{"composite_complete":true}'::jsonb),
('Kafteji',array['protein','vegetable','fried','composite_dish'],jsonb_build_array('légumes frits','œuf'),jsonb_build_array('foie','merguez','pain'),'complete_composite','{"composition_variable":true,"already_contains_vegetable":true}'::jsonb),
('Ojja',array['protein','vegetable','rich_sauce','composite_dish'],jsonb_build_array('tomate','poivron','œuf'),jsonb_build_array('merguez','crevettes','thon'),'complete_composite','{"composition_variable":true,"protein_is_variable":true,"already_contains_vegetable":true}'::jsonb)
)
update public.food_dictionary d set
  categories=p.categories,
  typical_components=p.typical,
  optional_components=p.optional,
  adapter_profile=d.adapter_profile||p.extra||jsonb_build_object('adapter_family',p.family),
  updated_at=now()
from profiles p where d.canonical_name=p.name;

-- Alias courts et orthographes réellement utilisés dans la recherche.
update public.food_dictionary set aliases=aliases||array['foufou manioc','fufu manioc'] where canonical_name='Foufou de manioc';
update public.food_dictionary set aliases=aliases||array['garantita','calentica'] where canonical_name in ('Karantika','Karantika / Garantita');
update public.food_dictionary set aliases=aliases||array['mhadjeb','mahjouba','mhajeb'] where canonical_name='Mhadjeb / Mahjouba';
update public.food_dictionary set aliases=aliases||array['achu','taro sauce jaune'] where canonical_name='Achu / Taro sauce jaune';
update public.food_dictionary set aliases=aliases||array['kwanga','chikwangue'] where canonical_name='Chikwangue / Kwanga';
update public.food_dictionary set aliases=aliases||array['pondu','saka saka','saka-saka'] where canonical_name='Pondu / Saka-saka';
update public.food_dictionary set aliases=aliases||array['moi moi','moin moin','moi-moi','moin-moin'] where canonical_name='Moi-moi / Moin-moin';
update public.food_dictionary set aliases=aliases||array['jiaozi','raviolis chinois'] where canonical_name='Jiaozi / raviolis chinois';
update public.food_dictionary set aliases=aliases||array['thieboudienne','ceebu jen','ceebu jën','tieboudienne'] where canonical_name='Thiéboudiène / Ceebu jën';

-- Résultat attendu : aucune des 53 lignes ne doit rester sans composants.
select
  adapter_profile->>'adapter_family' family,
  count(*) entries
from public.food_dictionary
where enabled
group by adapter_profile->>'adapter_family'
order by family;
