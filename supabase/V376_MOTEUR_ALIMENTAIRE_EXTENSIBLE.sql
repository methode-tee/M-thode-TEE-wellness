-- V376 — Moteur alimentaire extensible Méthode Tee
-- Exécuter une fois avant d'uploader les fichiers V376.
-- Idempotent : peut être relancé sans dupliquer les entrées.

create extension if not exists unaccent;

create or replace function public.food_normalize(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    replace(replace(lower(unaccent(coalesce(value,''))), 'œ', 'oe'), 'æ', 'ae'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create table if not exists public.food_dictionary (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text generated always as (public.food_normalize(canonical_name)) stored,
  display_name text not null,
  aliases text[] not null default '{}',
  country text,
  region text,
  culture text,
  ciqual_code text references public.ciqual_foods(code) on delete set null,
  enabled boolean not null default true,
  priority integer not null default 100,
  meal_contexts text[] not null default '{}',
  categories text[] not null default '{}',
  typical_components jsonb not null default '[]'::jsonb,
  optional_components jsonb not null default '[]'::jsonb,
  adapter_profile jsonb not null default '{}'::jsonb,
  source text not null default 'Méthode Tee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_name)
);

create index if not exists food_dictionary_enabled_priority_idx
  on public.food_dictionary(enabled, priority, normalized_name);
create index if not exists food_dictionary_aliases_idx
  on public.food_dictionary using gin(aliases);

alter table public.food_dictionary enable row level security;
drop policy if exists "food dictionary authenticated read" on public.food_dictionary;
drop policy if exists "food dictionary admin manage" on public.food_dictionary;
create policy "food dictionary authenticated read" on public.food_dictionary
  for select to authenticated using (enabled or public.is_admin());
create policy "food dictionary admin manage" on public.food_dictionary
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.food_dictionary_touch()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists food_dictionary_touch_trigger on public.food_dictionary;
create trigger food_dictionary_touch_trigger before update on public.food_dictionary
for each row execute function public.food_dictionary_touch();

-- Recherche compacte et classée. Les plats sans CIQUAL restent reconnaissables,
-- mais leurs macros restent nulles : aucune valeur n'est inventée.
create or replace function public.search_foods_v2(p_query text, p_limit integer default 10)
returns table(
  code text, name text, kcal_100g numeric, protein_100g numeric,
  fat_100g numeric, carbs_100g numeric, fiber_100g numeric, salt_100g numeric,
  source text, dictionary_id uuid, display_name text, country text,
  categories text[], adapter_profile jsonb, match_rank integer
)
language sql
stable
security invoker
set search_path=public
as $$
  with q as (select public.food_normalize(p_query) v,regexp_replace(public.food_normalize(p_query),'s$','') stem),
  ciqual_ranked as (
    select c.code,c.name,c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g,c.salt_100g,
      c.source,null::uuid dictionary_id,c.name display_name,null::text country,'{}'::text[] categories,'{}'::jsonb adapter_profile,
      case
        when public.food_normalize(c.name) in(q.v,q.stem) then 10
        when public.food_normalize(c.name) like q.stem||'%' then 20
        when public.food_normalize(c.name) like '% '||q.stem||'%' then 30
        when coalesce(c.source,'CIQUAL')='CIQUAL' and public.food_normalize(c.name) not like '%,%' then 40
        when coalesce(c.source,'CIQUAL')='CIQUAL' then 50
        else 70
      end match_rank
    from public.ciqual_foods c,q
    where length(q.v)>=3 and (
      public.food_normalize(c.name) like '%'||q.stem||'%'
      or public.food_normalize(c.search_text) like '%'||q.stem||'%'
    )
  ),
  dictionary_ranked as (
    select c.code,coalesce(c.name,d.display_name) name,c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g,c.salt_100g,
      d.source,d.id dictionary_id,d.display_name,d.country,d.categories,d.adapter_profile,
      case
        when d.normalized_name in(q.v,q.stem) then 10
        when d.normalized_name like q.stem||'%' then 25
        when exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) in(q.v,q.stem)) then 15
        when exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) like q.stem||'%') then 28
        else 65
      end + greatest(0,least(20,d.priority/20)) match_rank
    from public.food_dictionary d
    cross join q
    left join public.ciqual_foods c on c.code=d.ciqual_code
    where d.enabled and length(q.v)>=3 and (
      d.normalized_name like q.stem||'%'
      or exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) like q.stem||'%')
    )
  ), all_rows as (
    select * from ciqual_ranked
    union all
    select * from dictionary_ranked
  ), dedup as (
    select distinct on (coalesce(code,'dict:'||dictionary_id::text))
      code,name,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g,
      source,dictionary_id,display_name,country,categories,adapter_profile,match_rank
    from all_rows
    order by coalesce(code,'dict:'||dictionary_id::text),match_rank,(dictionary_id is null),name
  )
  select
    code,name,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g,
    source,dictionary_id,display_name,country,categories,adapter_profile,match_rank
  from dedup
  order by match_rank,name
  limit greatest(1,least(coalesce(p_limit,10),10));
$$;

-- Résolution ciblée d'une description. Une limite courte empêche tout chargement global.
create or replace function public.resolve_food_text(p_text text, p_limit integer default 12)
returns table(
  id uuid, canonical_name text, display_name text, country text,
  meal_contexts text[], categories text[], typical_components jsonb,
  optional_components jsonb, adapter_profile jsonb, ciqual_code text,
  confidence text
)
language sql
stable
security invoker
set search_path=public
as $$
  with q as (select public.food_normalize(left(coalesce(p_text,''),1000)) v), hits as (
    select d.*,
      case when q.v=d.normalized_name then 'exact'
           when q.v ~ ('(^| )'||regexp_replace(d.normalized_name,'([\\.\\+\\*\\?\\[\\]\\(\\)\\{\\}\\|\\^\\$])','\\\\\1','g')||'( |$)') then 'recognized'
           else 'alias' end confidence,
      length(d.normalized_name) hit_length
    from public.food_dictionary d cross join q
    where d.enabled and length(q.v)>=3 and (
      q.v ~ ('(^| )'||regexp_replace(d.normalized_name,'([\\.\\+\\*\\?\\[\\]\\(\\)\\{\\}\\|\\^\\$])','\\\\\1','g')||'( |$)')
      or exists(select 1 from unnest(d.aliases) a
        where length(public.food_normalize(a))>=3
        and q.v ~ ('(^| )'||regexp_replace(public.food_normalize(a),'([\\.\\+\\*\\?\\[\\]\\(\\)\\{\\}\\|\\^\\$])','\\\\\1','g')||'( |$)'))
    )
  )
  select id,canonical_name,display_name,country,meal_contexts,categories,
    typical_components,optional_components,adapter_profile,ciqual_code,confidence
  from hits order by priority asc,hit_length desc
  limit greatest(1,least(coalesce(p_limit,12),16));
$$;

grant execute on function public.search_foods_v2(text,integer) to authenticated;
grant execute on function public.resolve_food_text(text,integer) to authenticated;

-- Catalogue initial. L'admin peut ensuite l'enrichir sans nouvelle version iOS.
with seed(name,display,aliases,country,contexts,categories,typical,optional,profile,priority) as (values
  ('Œufs','Œufs',array['oeuf','oeufs','œuf','œufs'],null,array['breakfast','lunch','dinner'],array['protein'],jsonb_build_array('œuf'),'[]'::jsonb,'{}'::jsonb,15),
  ('Avocat','Avocat',array['avocat'],null,array['breakfast','lunch','snack','dinner'],array['fat_quality','fruit'],jsonb_build_array('avocat'),'[]'::jsonb,'{}'::jsonb,15),
  ('Pain complet','Pain complet',array['pain complet','pain integral','pain intégral'],null,array['breakfast','lunch','snack','dinner'],array['wholegrain','starch'],jsonb_build_array('pain complet'),'[]'::jsonb,'{}'::jsonb,15),
  ('Amandes','Amandes',array['amande','amandes'],null,array['breakfast','snack'],array['nuts_seeds','fat_quality'],jsonb_build_array('amande'),'[]'::jsonb,'{}'::jsonb,15),
  ('Noix de cajou','Noix de cajou',array['cajou','noix cajou','noix de cajou'],null,array['breakfast','snack'],array['nuts_seeds','fat_quality'],jsonb_build_array('noix de cajou'),'[]'::jsonb,'{}'::jsonb,15),
  ('Miel','Miel',array['miel'],null,array['breakfast','snack'],array['added_sugar'],jsonb_build_array('miel'),'[]'::jsonb,'{"small_quantity":true}'::jsonb,15),
  ('Muesli','Muesli',array['muesli','muesli golden vanilla'],null,array['breakfast','snack'],array['wholegrain','composite_dish'],jsonb_build_array('céréales','oléagineux','fruits secs'),jsonb_build_array('sucre ajouté'),'{"sweet_breakfast":true,"do_not_auto_suggest_vegetables":true}'::jsonb,20),
  ('Flocons d''avoine','Flocons d’avoine',array['avoine','flocon avoine','flocons avoine','porridge'],null,array['breakfast','snack'],array['wholegrain','starch'],jsonb_build_array('avoine'),'[]'::jsonb,'{"sweet_breakfast":true,"do_not_auto_suggest_vegetables":true}'::jsonb,15),
  ('Dattes Medjool','Dattes Medjool',array['datte medjool','dattes medjool'],null,array['breakfast','snack'],array['fruit'],jsonb_build_array('datte'),'[]'::jsonb,'{}'::jsonb,20),
  ('Dattes Deglet Nour','Dattes Deglet Nour',array['datte deglet nour','dattes deglet nour','deglet noor'],null,array['breakfast','snack'],array['fruit'],jsonb_build_array('datte'),'[]'::jsonb,'{}'::jsonb,20),
  ('Dattes Ajwa','Dattes Ajwa',array['datte ajwa','dattes ajwa'],null,array['breakfast','snack'],array['fruit'],jsonb_build_array('datte'),'[]'::jsonb,'{}'::jsonb,20),
  ('Dattes Sukkari','Dattes Sukkari',array['datte sukkari','dattes sukkari'],null,array['breakfast','snack'],array['fruit'],jsonb_build_array('datte'),'[]'::jsonb,'{}'::jsonb,20),
  ('Extrait de vanille','Extrait de vanille',array['extrait vanille'],null,array['breakfast','snack'],array['aromatic'],jsonb_build_array('vanille'),'[]'::jsonb,'{"small_quantity":true}'::jsonb,20),
  ('Gousse de vanille','Gousse de vanille',array['gousse vanille'],null,array['breakfast','snack'],array['aromatic'],jsonb_build_array('vanille'),'[]'::jsonb,'{"small_quantity":true}'::jsonb,20),
  ('Vanille en poudre','Vanille en poudre',array['poudre vanille'],null,array['breakfast','snack'],array['aromatic'],jsonb_build_array('vanille'),'[]'::jsonb,'{"small_quantity":true}'::jsonb,20),
  ('Sucre vanillé','Sucre vanillé',array['sucre vanille'],null,array['breakfast','snack'],array['added_sugar','aromatic'],jsonb_build_array('sucre','vanille'),'[]'::jsonb,'{"small_quantity":true}'::jsonb,20),
  ('Ndolè','Ndolè — Cameroun',array['ndole','ndolé','ndolè'],'Cameroun',array['lunch','dinner'],array['vegetable','composite_dish'],jsonb_build_array('feuilles','arachide'),jsonb_build_array('viande','poisson','crevettes'),'{"already_contains_vegetable":true,"protein_is_variable":true,"do_not_auto_suggest_vegetables":true,"composition_variable":true}'::jsonb,10),
  ('Poulet DG','Poulet DG — Cameroun',array['poulet dg'],'Cameroun',array['lunch','dinner'],array['protein','starch','vegetable','composite_dish'],jsonb_build_array('poulet','plantain','légumes'),jsonb_build_array('huile'),'{"already_contains_vegetable":true,"composite_complete":true}'::jsonb,10),
  ('Harira','Harira — Maroc',array['harira'],'Maroc',array['lunch','dinner'],array['protein','vegetable','composite_dish'],jsonb_build_array('tomate','légumineuses'),jsonb_build_array('viande','vermicelles'),'{"soup":true,"composition_variable":true,"do_not_auto_suggest_vegetables":true}'::jsonb,10),
  ('Ramen','Ramen — Japon',array['ramen'],'Japon',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('nouilles','bouillon'),jsonb_build_array('œuf','viande','légumes'),'{"soup":true,"composition_variable":true}'::jsonb,10),
  ('Pad thaï','Pad thaï — Thaïlande',array['pad thai','pad thaï'],'Thaïlande',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('nouilles de riz'),jsonb_build_array('œuf','crevettes','tofu','arachides'),'{"composition_variable":true}'::jsonb,10),
  ('Okok','Okok — Cameroun',array['okok','eru'],'Cameroun',array['lunch','dinner'],array['vegetable','composite_dish'],jsonb_build_array('feuilles'),jsonb_build_array('arachide','huile'),'{"already_contains_vegetable":true,"do_not_auto_suggest_vegetables":true,"composition_variable":true}'::jsonb,30),
  ('Achu','Achu / Taro sauce jaune — Cameroun',array['achu','taro sauce jaune'],'Cameroun',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('taro','sauce jaune'),jsonb_build_array('viande'),'{"composition_variable":true}'::jsonb,30),
  ('Mbongo tchobi','Mbongo tchobi — Cameroun',array['mbongo','mbongo tchobi'],'Cameroun',array['lunch','dinner'],array['protein','rich_sauce','composite_dish'],jsonb_build_array('épices','sauce noire'),jsonb_build_array('poisson','viande'),'{"composition_variable":true}'::jsonb,30),
  ('Mafé','Mafé — Sénégal',array['mafe','mafé'],'Sénégal',array['lunch','dinner'],array['rich_sauce','composite_dish'],jsonb_build_array('arachide'),jsonb_build_array('viande','légumes'),'{"composition_variable":true}'::jsonb,20),
  ('Thiéré','Thiéré — Sénégal',array['thiere','thiéré'],'Sénégal',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('mil'),jsonb_build_array('légumes','viande'),'{"composition_variable":true}'::jsonb,30),
  ('Domoda','Domoda — Sénégal',array['domoda'],'Sénégal',array['lunch','dinner'],array['rich_sauce','composite_dish'],jsonb_build_array('sauce tomate'),jsonb_build_array('viande','poisson'),'{"composition_variable":true}'::jsonb,30),
  ('Soupou kandja','Soupou kandja — Sénégal',array['soupou kandja','kandja'],'Sénégal',array['lunch','dinner'],array['vegetable','composite_dish'],jsonb_build_array('gombo'),jsonb_build_array('poisson','viande'),'{"already_contains_vegetable":true,"composition_variable":true}'::jsonb,30),
  ('Caldou','Caldou — Sénégal',array['caldou'],'Sénégal',array['lunch','dinner'],array['protein','composite_dish'],jsonb_build_array('poisson'),jsonb_build_array('riz','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Lakh','Lakh — Sénégal',array['lakh'],'Sénégal',array['breakfast','snack'],array['starch','composite_dish'],jsonb_build_array('mil'),jsonb_build_array('lait fermenté','sucre'),'{"sweet_breakfast":true,"composition_variable":true,"do_not_auto_suggest_vegetables":true}'::jsonb,30),
  ('Kedjenou','Kedjenou — Côte d’Ivoire',array['kedjenou'],'Côte d’Ivoire',array['lunch','dinner'],array['protein','vegetable','composite_dish'],jsonb_build_array('cuisson à l’étouffée'),jsonb_build_array('poulet','poisson'),'{"already_contains_vegetable":true,"composition_variable":true}'::jsonb,30),
  ('Foutou banane','Foutou banane — Côte d’Ivoire',array['foutou banane'],'Côte d’Ivoire',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('banane plantain'),'[]'::jsonb,'{}'::jsonb,30),
  ('Foutou igname','Foutou igname — Côte d’Ivoire',array['foutou igname'],'Côte d’Ivoire',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('igname'),'[]'::jsonb,'{}'::jsonb,30),
  ('Placali','Placali — Côte d’Ivoire',array['placali'],'Côte d’Ivoire',array['lunch','dinner'],array['starch'],jsonb_build_array('manioc'),'[]'::jsonb,'{}'::jsonb,30),
  ('Sauce graine','Sauce graine — Côte d’Ivoire',array['sauce graine'],'Côte d’Ivoire',array['lunch','dinner'],array['rich_sauce','composite_dish'],jsonb_build_array('graine de palme'),jsonb_build_array('viande','poisson'),'{"composition_variable":true}'::jsonb,30),
  ('Riz gras','Riz gras — Afrique de l’Ouest',array['riz gras'],'Afrique de l’Ouest',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('riz'),jsonb_build_array('viande','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Pounded yam','Pounded yam — Nigeria',array['pounded yam'],'Nigeria',array['lunch','dinner'],array['starch'],jsonb_build_array('igname'),'[]'::jsonb,'{}'::jsonb,30),
  ('Eba','Eba — Nigeria',array['eba'],'Nigeria',array['lunch','dinner'],array['starch'],jsonb_build_array('manioc'),'[]'::jsonb,'{}'::jsonb,30),
  ('Amala','Amala — Nigeria',array['amala'],'Nigeria',array['lunch','dinner'],array['starch'],jsonb_build_array('igname'),'[]'::jsonb,'{}'::jsonb,30),
  ('Akara','Akara — Nigeria',array['akara'],'Nigeria',array['breakfast','snack'],array['protein','fried','composite_dish'],jsonb_build_array('haricot'),'[]'::jsonb,'{}'::jsonb,30),
  ('Suya','Suya — Nigeria',array['suya'],'Nigeria',array['lunch','dinner'],array['protein','composite_dish'],jsonb_build_array('viande','épices'),'[]'::jsonb,'{}'::jsonb,30),
  ('Banku','Banku — Ghana',array['banku'],'Ghana',array['lunch','dinner'],array['starch'],jsonb_build_array('maïs','manioc'),'[]'::jsonb,'{}'::jsonb,30),
  ('Kenkey','Kenkey — Ghana',array['kenkey'],'Ghana',array['lunch','dinner'],array['starch'],jsonb_build_array('maïs'),'[]'::jsonb,'{}'::jsonb,30),
  ('Red red','Red red — Ghana',array['red red'],'Ghana',array['lunch','dinner'],array['protein','starch','composite_dish'],jsonb_build_array('haricots','plantain'),jsonb_build_array('huile'),'{"composite_complete":true}'::jsonb,30),
  ('Chorba frik','Chorba frik — Algérie',array['chorba frik'],'Algérie',array['lunch','dinner'],array['starch','vegetable','composite_dish'],jsonb_build_array('frik','tomate'),jsonb_build_array('viande'),'{"soup":true,"composition_variable":true}'::jsonb,30),
  ('Chakhchoukha','Chakhchoukha — Algérie',array['chakhchoukha'],'Algérie',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('galette','sauce'),jsonb_build_array('viande','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Rechta','Rechta — Algérie',array['rechta'],'Algérie',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('nouilles'),jsonb_build_array('poulet','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Mhadjeb','Mhadjeb / Mahjouba — Algérie',array['mhadjeb','mhajeb','mahjouba'],'Algérie',array['lunch','snack'],array['starch','vegetable','composite_dish'],jsonb_build_array('semoule','tomate','oignon'),'[]'::jsonb,'{"already_contains_vegetable":true}'::jsonb,30),
  ('Karantika','Karantika / Garantita — Algérie',array['karantika','garantita'],'Algérie',array['lunch','snack'],array['protein','composite_dish'],jsonb_build_array('pois chiche'),'[]'::jsonb,'{}'::jsonb,30),
  ('Rfissa','Rfissa — Maroc',array['rfissa'],'Maroc',array['lunch','dinner'],array['starch','protein','composite_dish'],jsonb_build_array('msemen','lentilles'),jsonb_build_array('poulet'),'{"composition_variable":true}'::jsonb,30),
  ('Bissara','Bissara — Maroc',array['bissara'],'Maroc',array['lunch','dinner'],array['protein','composite_dish'],jsonb_build_array('fèves','pois cassés'),'[]'::jsonb,'{"soup":true}'::jsonb,30),
  ('Msemen','Msemen — Maghreb',array['msemen'],'Maghreb',array['breakfast','snack'],array['starch','fat_quality','composite_dish'],jsonb_build_array('semoule','matière grasse'),'[]'::jsonb,'{"do_not_auto_suggest_vegetables":true}'::jsonb,30),
  ('Lablabi','Lablabi — Tunisie',array['lablabi'],'Tunisie',array['lunch','dinner'],array['protein','starch','composite_dish'],jsonb_build_array('pois chiches','pain'),jsonb_build_array('œuf','thon'),'{"soup":true,"composition_variable":true}'::jsonb,30),
  ('Brik','Brik — Tunisie',array['brik'],'Tunisie',array['lunch','dinner'],array['fried','composite_dish'],jsonb_build_array('feuille de brick'),jsonb_build_array('œuf','thon','pomme de terre'),'{"composition_variable":true}'::jsonb,30),
  ('Onigiri','Onigiri — Japon',array['onigiri'],'Japon',array['lunch','snack'],array['starch','composite_dish'],jsonb_build_array('riz'),jsonb_build_array('poisson','algue'),'{"composition_variable":true}'::jsonb,30),
  ('Udon','Udon — Japon',array['udon'],'Japon',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('nouilles'),jsonb_build_array('bouillon','protéine','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Soba','Soba — Japon',array['soba'],'Japon',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('nouilles de sarrasin'),jsonb_build_array('bouillon','garniture'),'{"composition_variable":true}'::jsonb,30),
  ('Yakisoba','Yakisoba — Japon',array['yakisoba'],'Japon',array['lunch','dinner'],array['starch','vegetable','composite_dish'],jsonb_build_array('nouilles','légumes'),jsonb_build_array('viande'),'{"composition_variable":true,"already_contains_vegetable":true}'::jsonb,30),
  ('Baozi','Baozi — Chine',array['baozi'],'Chine',array['lunch','snack'],array['starch','composite_dish'],jsonb_build_array('pain vapeur'),jsonb_build_array('viande','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Jiaozi','Jiaozi — Chine',array['jiaozi'],'Chine',array['lunch','dinner'],array['starch','composite_dish'],jsonb_build_array('pâte'),jsonb_build_array('viande','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Mapo tofu','Mapo tofu — Chine',array['mapo tofu'],'Chine',array['lunch','dinner'],array['protein','rich_sauce','composite_dish'],jsonb_build_array('tofu','sauce épicée'),jsonb_build_array('viande'),'{"composition_variable":true}'::jsonb,30),
  ('Curry vert','Curry vert — Thaïlande',array['curry vert','green curry'],'Thaïlande',array['lunch','dinner'],array['rich_sauce','composite_dish'],jsonb_build_array('lait de coco','pâte de curry'),jsonb_build_array('protéine','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Curry rouge','Curry rouge — Thaïlande',array['curry rouge','red curry'],'Thaïlande',array['lunch','dinner'],array['rich_sauce','composite_dish'],jsonb_build_array('lait de coco','pâte de curry'),jsonb_build_array('protéine','légumes'),'{"composition_variable":true}'::jsonb,30),
  ('Tom yum','Tom yum — Thaïlande',array['tom yum'],'Thaïlande',array['lunch','dinner'],array['composite_dish'],jsonb_build_array('bouillon','aromates'),jsonb_build_array('crevettes','poulet'),'{"soup":true,"composition_variable":true}'::jsonb,30),
  ('Mango sticky rice','Mango sticky rice — Thaïlande',array['mango sticky rice'],'Thaïlande',array['snack'],array['starch','fruit','added_sugar','composite_dish'],jsonb_build_array('riz gluant','mangue','lait de coco'),'[]'::jsonb,'{"sweet_breakfast":true,"do_not_auto_suggest_vegetables":true}'::jsonb,30)
)
insert into public.food_dictionary(canonical_name,display_name,aliases,country,meal_contexts,categories,typical_components,optional_components,adapter_profile,priority)
select name,display,aliases,country,contexts,categories,typical,optional,profile,priority from seed
on conflict(normalized_name) do update set
  display_name=excluded.display_name,aliases=excluded.aliases,country=excluded.country,
  meal_contexts=excluded.meal_contexts,categories=excluded.categories,
  typical_components=excluded.typical_components,optional_components=excluded.optional_components,
  adapter_profile=excluded.adapter_profile,priority=excluded.priority,enabled=true,updated_at=now();

-- Migration des aliments/plats déjà ajoutés auparavant uniquement dans
-- ciqual_foods. Toutes les lignes TEE-* deviennent immédiatement utilisables
-- par la recherche, la description libre et Adapter mon repas.
-- Les profils détaillés du catalogue initial ci-dessus restent prioritaires.
insert into public.food_dictionary(
  canonical_name,display_name,aliases,country,ciqual_code,enabled,priority,
  meal_contexts,categories,typical_components,optional_components,adapter_profile,source
)
select
  trim(split_part(c.name,'—',1)),
  c.name,
  array[trim(split_part(c.name,'—',1))],
  nullif(trim(split_part(c.name,'—',2)),''),
  c.code,true,80,
  case
    when public.food_normalize(c.name) ~ '(muesli|granola|avoine|porridge|datte|vanille)' then array['breakfast','snack']::text[]
    else array['lunch','dinner']::text[]
  end,
  case
    when public.food_normalize(c.name) ~ 'datte' then array['fruit']::text[]
    when public.food_normalize(c.name) ~ '(extrait de vanille|gousse de vanille|vanille en poudre)' then array['aromatic']::text[]
    when public.food_normalize(c.name) ~ 'sucre vanille' then array['added_sugar','aromatic']::text[]
    when public.food_normalize(c.name) ~ '(amande|noix|cajou|graine)' then array['nuts_seeds','fat_quality']::text[]
    when public.food_normalize(c.name) ~ '(oeuf|poulet|poisson|viande|boeuf)' then array['protein','composite_dish']::text[]
    else array['composite_dish']::text[]
  end,
  '[]'::jsonb,'[]'::jsonb,
  case
    when public.food_normalize(c.name) ~ '(muesli|granola|avoine|porridge)'
      then '{"sweet_breakfast":true,"do_not_auto_suggest_vegetables":true}'::jsonb
    when public.food_normalize(c.name) ~ '(datte|vanille|amande|noix|cajou|graine)'
      then '{}'::jsonb
    else '{"composition_variable":true,"do_not_auto_suggest_vegetables":true,"migrated_from_ciqual":true}'::jsonb
  end,
  coalesce(nullif(c.source,''),'Méthode Tee')
from public.ciqual_foods c
where c.code ilike 'TEE-%' or upper(coalesce(c.source,'')) like '%METHODE_TEE%'
on conflict(normalized_name) do update set
  ciqual_code=coalesce(public.food_dictionary.ciqual_code,excluded.ciqual_code),
  display_name=case when public.food_dictionary.display_name=public.food_dictionary.canonical_name then excluded.display_name else public.food_dictionary.display_name end,
  country=coalesce(public.food_dictionary.country,excluded.country),
  enabled=true,updated_at=now();

-- Relie automatiquement les entrées initiales lorsqu'un aliment CIQUAL/TEE du
-- même nom existe déjà. Aucun nutriment n'est créé par cette opération.
with matches as (
  select d.id,(select c.code from public.ciqual_foods c
    where public.food_normalize(c.name) like regexp_replace(d.normalized_name,'s$','')||'%'
    order by case when coalesce(c.source,'CIQUAL')='CIQUAL' then 0 else 1 end,length(c.name)
    limit 1) code
  from public.food_dictionary d where d.ciqual_code is null
)
update public.food_dictionary d set ciqual_code=m.code,updated_at=now()
from matches m where d.id=m.id and m.code is not null;

notify pgrst,'reload schema';
