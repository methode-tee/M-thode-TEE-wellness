-- V392 — Bibliothèque boissons, plantes, fruits et mélanges — Méthode Tee
-- À exécuter une fois dans Supabase SQL Editor.
-- Idempotent : peut être relancé. N'altère ni CIQUAL, ni les repas, ni les achats.
--
-- Principes :
-- 1. Aucun nutriment n'est inventé pour une infusion.
-- 2. Les usages sont des repères traditionnels/informatifs, pas des allégations médicales.
-- 3. Les ingrédients sensibles restent recherchables mais ne sont jamais suggérés automatiquement.
-- 4. Une boisson dont la composition est inconnue peut être enregistrée, sans alimenter les repères botaniques.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.botanical_normalize(value text)
returns text language sql immutable parallel safe as $$
  select trim(regexp_replace(
    replace(replace(lower(unaccent(coalesce(value,''))), 'œ', 'oe'), 'æ', 'ae'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create table if not exists public.botanical_ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text generated always as (public.botanical_normalize(canonical_name)) stored,
  display_name text not null,
  latin_name text,
  aliases text[] not null default '{}',
  ingredient_kind text not null check (ingredient_kind in
    ('plant','spice','tea','dried_fruit','fresh_fruit','citrus_peel','other')),
  usable_parts text[] not null default '{}',
  preparation_forms text[] not null default '{}',
  flavor_tags text[] not null default '{}',
  pairing_tags text[] not null default '{}',
  traditional_context_tags text[] not null default '{}',
  caffeine_level text not null default 'none' check (caffeine_level in ('none','low','variable','present')),
  caution_level text not null default 'standard' check (caution_level in ('standard','notice','high')),
  caution_text text,
  composer_enabled boolean not null default true,
  enabled boolean not null default true,
  priority integer not null default 100,
  source_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_name)
);

create index if not exists botanical_ingredients_enabled_idx
  on public.botanical_ingredients(enabled,composer_enabled,priority,normalized_name);
create index if not exists botanical_ingredients_aliases_idx
  on public.botanical_ingredients using gin(aliases);
create index if not exists botanical_ingredients_pairing_idx
  on public.botanical_ingredients using gin(pairing_tags);

create table if not exists public.botanical_blends (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  intent_tags text[] not null default '{}',
  moment_tags text[] not null default '{}',
  preparation_text text not null,
  serving_note text,
  caution_text text,
  composer_enabled boolean not null default true,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.botanical_blend_ingredients (
  blend_id uuid not null references public.botanical_blends(id) on delete cascade,
  ingredient_id uuid not null references public.botanical_ingredients(id) on delete restrict,
  sort_order integer not null default 0,
  quantity_text text,
  optional boolean not null default false,
  primary key(blend_id,ingredient_id)
);

create table if not exists public.user_botanical_blends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  intent_tag text,
  notes text,
  ingredients_snapshot jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_botanical_blends_user_idx
  on public.user_botanical_blends(user_id,updated_at desc);

create table if not exists public.user_beverage_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  consumed_at timestamptz not null default now(),
  beverage_kind text not null check (beverage_kind in
    ('water','infusion','tea','coffee','juice','smoothie','milk_drink','other')),
  display_name text not null,
  volume_ml integer check (volume_ml is null or volume_ml between 1 and 5000),
  hydration_ml integer check (hydration_ml is null or hydration_ml between 0 and 5000),
  source_mode text not null default 'manual' check (source_mode in
    ('manual','catalog_blend','user_blend','composer')),
  catalog_blend_id uuid references public.botanical_blends(id) on delete set null,
  user_blend_id uuid references public.user_botanical_blends(id) on delete set null,
  ingredients_snapshot jsonb not null default '[]'::jsonb,
  composition_known boolean not null default false,
  energy_after smallint check (energy_after between 1 and 10),
  digestion_after smallint check (digestion_after between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_beverage_entries_user_date_idx
  on public.user_beverage_entries(user_id,entry_date desc,consumed_at desc);

create table if not exists public.user_beverage_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  caffeine_sensitive boolean not null default false,
  pregnancy_or_breastfeeding boolean not null default false,
  regular_medication boolean not null default false,
  preferred_intents text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS : catalogue lisible par les membres, catalogue modifiable uniquement par l'admin.
alter table public.botanical_ingredients enable row level security;
alter table public.botanical_blends enable row level security;
alter table public.botanical_blend_ingredients enable row level security;
alter table public.user_botanical_blends enable row level security;
alter table public.user_beverage_entries enable row level security;
alter table public.user_beverage_preferences enable row level security;

drop policy if exists "botanical ingredients read" on public.botanical_ingredients;
drop policy if exists "botanical ingredients admin" on public.botanical_ingredients;
create policy "botanical ingredients read" on public.botanical_ingredients
  for select to authenticated using(enabled or public.is_admin());
create policy "botanical ingredients admin" on public.botanical_ingredients
  for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "botanical blends read" on public.botanical_blends;
drop policy if exists "botanical blends admin" on public.botanical_blends;
create policy "botanical blends read" on public.botanical_blends
  for select to authenticated using(enabled or public.is_admin());
create policy "botanical blends admin" on public.botanical_blends
  for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "botanical blend ingredients read" on public.botanical_blend_ingredients;
drop policy if exists "botanical blend ingredients admin" on public.botanical_blend_ingredients;
create policy "botanical blend ingredients read" on public.botanical_blend_ingredients
  for select to authenticated using(exists(
    select 1 from public.botanical_blends b where b.id=blend_id and (b.enabled or public.is_admin())
  ));
create policy "botanical blend ingredients admin" on public.botanical_blend_ingredients
  for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "user botanical blends own" on public.user_botanical_blends;
create policy "user botanical blends own" on public.user_botanical_blends
  for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists "user beverage entries own" on public.user_beverage_entries;
create policy "user beverage entries own" on public.user_beverage_entries
  for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "user beverage preferences own" on public.user_beverage_preferences;
create policy "user beverage preferences own" on public.user_beverage_preferences
  for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

create or replace function public.botanical_touch()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists botanical_ingredients_touch on public.botanical_ingredients;
create trigger botanical_ingredients_touch before update on public.botanical_ingredients
for each row execute function public.botanical_touch();
drop trigger if exists botanical_blends_touch on public.botanical_blends;
create trigger botanical_blends_touch before update on public.botanical_blends
for each row execute function public.botanical_touch();
drop trigger if exists user_botanical_blends_touch on public.user_botanical_blends;
create trigger user_botanical_blends_touch before update on public.user_botanical_blends
for each row execute function public.botanical_touch();
drop trigger if exists user_beverage_entries_touch on public.user_beverage_entries;
create trigger user_beverage_entries_touch before update on public.user_beverage_entries
for each row execute function public.botanical_touch();
drop trigger if exists user_beverage_preferences_touch on public.user_beverage_preferences;
create trigger user_beverage_preferences_touch before update on public.user_beverage_preferences
for each row execute function public.botanical_touch();

-- Recherche courte : jamais de téléchargement global du catalogue.
create or replace function public.search_botanical_ingredients(p_query text, p_limit integer default 12)
returns table(
  id uuid, display_name text, latin_name text, ingredient_kind text,
  usable_parts text[], preparation_forms text[], flavor_tags text[], pairing_tags text[],
  traditional_context_tags text[], caffeine_level text, caution_level text,
  caution_text text, composer_enabled boolean, match_rank integer
)
language sql stable security invoker set search_path=public as $$
  with q as (
    select public.botanical_normalize(left(coalesce(p_query,''),100)) value
  ), ranked as (
    select i.*,
      case
        when i.normalized_name=q.value then 0
        when exists(select 1 from unnest(i.aliases) a where public.botanical_normalize(a)=q.value) then 1
        when i.normalized_name like q.value||'%' then 2
        when exists(select 1 from unnest(i.aliases) a where public.botanical_normalize(a) like q.value||'%') then 3
        else 8
      end + greatest(0,least(10,i.priority/20)) as rank_value
    from public.botanical_ingredients i cross join q
    where i.enabled and length(q.value)>=2 and (
      i.normalized_name like '%'||q.value||'%'
      or public.botanical_normalize(coalesce(i.display_name,'')) like '%'||q.value||'%'
      or public.botanical_normalize(coalesce(i.latin_name,'')) like '%'||q.value||'%'
      or exists(select 1 from unnest(i.aliases) a where public.botanical_normalize(a) like '%'||q.value||'%')
    )
  )
  select id,display_name,latin_name,ingredient_kind,usable_parts,preparation_forms,
    flavor_tags,pairing_tags,traditional_context_tags,caffeine_level,caution_level,
    caution_text,composer_enabled,rank_value
  from ranked order by rank_value,display_name
  limit greatest(1,least(coalesce(p_limit,12),20));
$$;

-- Résumé journalier compact : utilisable par Mon Équilibre sans lire toutes les boissons.
create or replace function public.beverage_day_summary(target_date date default current_date)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'entry_count',count(*),
    'hydration_ml',coalesce(sum(hydration_ml),0),
    'infusion_count',count(*) filter(where beverage_kind in ('infusion','tea')),
    'fruit_beverage_count',count(*) filter(where beverage_kind in ('juice','smoothie')),
    'known_composition_count',count(*) filter(where composition_known),
    'energy_after',round(avg(energy_after)::numeric,1),
    'digestion_after',round(avg(digestion_after)::numeric,1),
    'last_entry_at',max(consumed_at)
  ) from public.user_beverage_entries
  where user_id=auth.uid() and entry_date=target_date;
$$;

grant execute on function public.search_botanical_ingredients(text,integer) to authenticated;
grant execute on function public.beverage_day_summary(date) to authenticated;

-- Les privilèges SQL et la RLS se complètent : la RLS conserve ensuite le filtrage par utilisateur/admin.
grant insert,select,update,delete on public.botanical_ingredients to authenticated;
grant insert,select,update,delete on public.botanical_blends to authenticated;
grant insert,select,update,delete on public.botanical_blend_ingredients to authenticated;
grant insert,select,update,delete on public.user_botanical_blends to authenticated;
grant insert,select,update,delete on public.user_beverage_entries to authenticated;
grant insert,select,update,delete on public.user_beverage_preferences to authenticated;

-- Catalogue initial documenté et extensible.
-- Les URL servent à l'administration/traçabilité ; elles ne sont pas affichées comme promesse de santé.
with seed(canonical,display,latin,aliases,kind,parts,forms,flavors,pairings,contexts,caffeine,caution,caution_text,composer,priority,sources) as (values
 ('Camomille matricaire','Camomille matricaire','Matricaria chamomilla',array['camomille allemande','matricaire'], 'plant',array['fleur'],array['infusion'],array['floral','doux'],array['pomme','citron','miel'],array['soir','rituel calme'],'none','notice','Prudence en cas d’allergie aux Astéracées ou de traitement anticoagulant.',true,10,'["https://www.nccih.nih.gov/health/chamomile"]'::jsonb),
 ('Menthe poivrée','Menthe poivrée','Mentha x piperita',array['peppermint','menthe'], 'plant',array['feuille'],array['infusion','fraîche'],array['frais','mentholé'],array['citron','gingembre','hibiscus'],array['après repas','fraîcheur'],'none','notice','Peut ne pas convenir en cas de reflux. Prudence chez le jeune enfant.',true,10,'["https://www.ema.europa.eu/en/medicines/herbal/menthae-piperitae-folium"]'::jsonb),
 ('Mélisse','Mélisse','Melissa officinalis',array['lemon balm'], 'plant',array['feuille'],array['infusion'],array['citronné','doux'],array['camomille','verveine','pomme'],array['soir','pause'],'none','standard',null,true,10,'["https://www.ema.europa.eu/en/medicines/herbal/melissae-folium"]'::jsonb),
 ('Verveine citronnée','Verveine citronnée','Aloysia citrodora',array['verveine odorante','verveine'], 'plant',array['feuille'],array['infusion'],array['citronné','herbacé'],array['mélisse','menthe','pêche'],array['soir','après repas'],'none','standard',null,true,10,'[]'::jsonb),
 ('Citronnelle','Citronnelle','Cymbopogon citratus',array['lemongrass'], 'plant',array['feuille','tige'],array['infusion'],array['citronné','herbacé'],array['gingembre','citron vert','menthe'],array['fraîcheur','après repas'],'none','notice','Éviter les usages très concentrés et prolongés sans avis professionnel.',true,15,'[]'::jsonb),
 ('Fenouil','Fenouil','Foeniculum vulgare',array['graine de fenouil','fenouil doux'], 'spice',array['graine'],array['infusion','concassé'],array['anisé','doux'],array['menthe','gingembre','citron'],array['après repas'],'none','notice','Éviter les usages concentrés/prolongés pendant la grossesse sans avis professionnel.',true,15,'["https://www.ema.europa.eu/en/medicines/herbal/foeniculi-dulcis-fructus"]'::jsonb),
 ('Gingembre','Gingembre','Zingiber officinale',array['ginger'], 'spice',array['rhizome'],array['infusion','frais','séché'],array['piquant','chaud'],array['citron','pomme','cannelle','curcuma'],array['matin','après repas','réconfort'],'none','notice','Prudence à forte dose avec les traitements anticoagulants ou avant une chirurgie.',true,10,'["https://www.nccih.nih.gov/health/ginger"]'::jsonb),
 ('Hibiscus','Hibiscus','Hibiscus sabdariffa',array['bissap','karkadé','oseille de guinée'], 'plant',array['calice'],array['infusion chaude','infusion froide'],array['acidulé','fruité'],array['menthe','orange','ananas','cannelle'],array['boisson fraîche','fruité'],'none','notice','Peut influencer la tension ou la glycémie chez certaines personnes ; prudence avec les traitements concernés.',true,10,'[]'::jsonb),
 ('Rooibos','Rooibos','Aspalathus linearis',array['thé rouge'], 'tea',array['feuille'],array['infusion'],array['rond','boisé','doux'],array['vanille','orange','cannelle','cacao'],array['soir','gourmandise'],'none','standard',null,true,10,'[]'::jsonb),
 ('Thé vert','Thé vert','Camellia sinensis',array['green tea','sencha'], 'tea',array['feuille'],array['infusion'],array['végétal','astringent'],array['menthe','citron','jasmin'],array['matin','journée'],'present','notice','Contient de la caféine. Espacer de certains médicaments et éviter tard le soir si sensible.',true,10,'["https://www.nccih.nih.gov/health/green-tea"]'::jsonb),
 ('Thé noir','Thé noir','Camellia sinensis',array['black tea','earl grey'], 'tea',array['feuille'],array['infusion'],array['corsé','tannique'],array['bergamote','citron','épices'],array['matin','journée'],'present','notice','Contient de la caféine. Éviter tard le soir si sensible.',true,12,'[]'::jsonb),
 ('Tilleul','Tilleul','Tilia spp.',array['fleur de tilleul'], 'plant',array['inflorescence'],array['infusion'],array['floral','miellé'],array['camomille','mélisse','pomme'],array['soir','pause'],'none','standard',null,true,12,'[]'::jsonb),
 ('Lavande vraie','Lavande vraie','Lavandula angustifolia',array['lavande'], 'plant',array['fleur'],array['infusion'],array['floral','aromatique'],array['citron','mélisse','pêche'],array['soir','aromatique'],'none','notice','Employer une petite quantité alimentaire ; l’huile essentielle n’est pas interchangeable avec la fleur.',true,20,'["https://www.nccih.nih.gov/health/lavender"]'::jsonb),
 ('Thym','Thym','Thymus vulgaris',array['thyme'], 'plant',array['feuille','sommité'],array['infusion'],array['aromatique','chaud'],array['citron','miel','gingembre'],array['hiver','aromatique'],'none','notice','Éviter les préparations très concentrées pendant la grossesse sans avis professionnel.',true,15,'[]'::jsonb),
 ('Romarin','Romarin','Salvia rosmarinus',array['rosemary'], 'plant',array['feuille'],array['infusion'],array['résineux','aromatique'],array['citron','orange','gingembre'],array['après repas','aromatique'],'none','notice','Éviter les préparations concentrées en cas de grossesse ou d’antécédents convulsifs sans avis professionnel.',true,20,'[]'::jsonb),
 ('Sauge officinale','Sauge officinale','Salvia officinalis',array['sauge'], 'plant',array['feuille'],array['infusion'],array['aromatique','amer'],array['citron','thym','pomme'],array['aromatique'],'none','notice','Déconseillée en usage concentré/prolongé pendant la grossesse, l’allaitement ou en cas d’antécédents convulsifs.',true,25,'[]'::jsonb),
 ('Cannelle de Ceylan','Cannelle de Ceylan','Cinnamomum verum',array['cannelle'], 'spice',array['écorce'],array['infusion','décoction'],array['chaud','doux','épicé'],array['pomme','orange','rooibos','cacao'],array['réconfort','gourmandise'],'none','standard','Préférer un usage culinaire ; éviter les doses élevées prolongées.',true,10,'[]'::jsonb),
 ('Cardamome','Cardamome','Elettaria cardamomum',array['cardamome verte'], 'spice',array['graine','gousse'],array['infusion','concassé'],array['épicé','citronné'],array['gingembre','cannelle','thé noir','poire'],array['réconfort','après repas'],'none','standard',null,true,12,'[]'::jsonb),
 ('Clou de girofle','Clou de girofle','Syzygium aromaticum',array['girofle'], 'spice',array['bouton floral'],array['infusion'],array['puissant','chaud'],array['orange','cannelle','pomme'],array['réconfort'],'none','notice','Employer en petite quantité alimentaire ; prudence avec les anticoagulants.',true,20,'[]'::jsonb),
 ('Curcuma','Curcuma','Curcuma longa',array['turmeric'], 'spice',array['rhizome'],array['infusion','frais','poudre'],array['terreux','épicé'],array['gingembre','citron','poivre'],array['réconfort'],'none','notice','Prudence en cas de maladie biliaire, traitement anticoagulant/anticancéreux/immunosuppresseur.',true,20,'["https://www.anses.fr/fr/content/des-effets-indesirables-lies-la-consommation-de-complements-alimentaires-contenant-du"]'::jsonb),
 ('Ortie','Ortie','Urtica dioica',array['ortie piquante'], 'plant',array['feuille'],array['infusion'],array['végétal','herbacé'],array['menthe','citron','pomme'],array['journée','végétal'],'none','notice','Prudence avec les traitements diurétiques, la tension, le diabète ou une maladie rénale.',true,20,'["https://www.ema.europa.eu/en/medicines/herbal/urticae-herba"]'::jsonb),
 ('Pissenlit','Pissenlit','Taraxacum officinale',array['dent de lion'], 'plant',array['feuille','racine'],array['infusion','décoction'],array['amer','terreux'],array['citron','menthe','gingembre'],array['après repas'],'none','notice','Prudence en cas de calculs ou maladie biliaire, maladie rénale ou traitement diurétique.',true,25,'[]'::jsonb),
 ('Réglisse','Réglisse','Glycyrrhiza glabra',array['racine de réglisse'], 'plant',array['racine'],array['décoction'],array['sucré','boisé'],array['menthe','fenouil','gingembre'],array['aromatique'],'none','high','Peut provoquer des effets graves, notamment sur la tension et le rythme cardiaque. À éviter avec de nombreux traitements, pendant la grossesse et en cas d’hypertension.',false,80,'["https://www.nccih.nih.gov/health/licorice-root"]'::jsonb),
 ('Millepertuis','Millepertuis','Hypericum perforatum',array['st john wort','herbe de saint jean'], 'plant',array['sommité fleurie'],array['infusion'],array['herbacé','amer'],array[]::text[],array['information uniquement'],'none','high','Interactions nombreuses et parfois dangereuses avec les médicaments, dont contraceptifs, antidépresseurs, anticoagulants et traitements antiviraux.',false,100,'["https://www.nccih.nih.gov/health/st-johns-wort"]'::jsonb),
 ('Séné','Séné','Senna alexandrina',array['senna'], 'plant',array['feuille','fruit'],array['infusion'],array['amer'],array[]::text[],array['information uniquement'],'none','high','Laxatif stimulant : ne doit pas être suggéré comme boisson bien-être ordinaire. Usage ponctuel uniquement selon conseil adapté.',false,100,'["https://www.ema.europa.eu/en/medicines/herbal/sennae-folium"]'::jsonb),
 ('Fruit quatre côtés','Fruit quatre côtés','Tetrapleura tetraptera',array['4 côtés','quatre côtés','prekese','aidan fruit'], 'plant',array['fruit'],array['décoction'],array['aromatique','épicé'],array['gingembre','citronnelle'],array['usage culturel documenté'],'none','high','Identité et concentration à confirmer. Ne pas suggérer automatiquement ; éviter les décoctions concentrées et demander un avis professionnel en cas de grossesse, allaitement, maladie ou traitement.',false,90,'[]'::jsonb),
 ('Moringa','Moringa','Moringa oleifera',array['moringa oleifera'], 'plant',array['feuille'],array['infusion'],array['végétal','herbacé'],array['menthe','citron','gingembre'],array['végétal'],'none','notice','Prudence avec les traitements du diabète ou de la tension ; ne pas utiliser les racines.',true,30,'["https://www.nccih.nih.gov/health/moringa"]'::jsonb),
 ('Baobab','Baobab','Adansonia digitata',array['fruit du baobab','bouye'], 'fresh_fruit',array['pulpe de fruit'],array['boisson froide'],array['acidulé','fruité'],array['hibiscus','vanille','gingembre'],array['boisson fruitée'],'none','standard',null,true,20,'[]'::jsonb),
 ('Cynorrhodon','Cynorrhodon','Rosa canina',array['églantier','rosehip'], 'dried_fruit',array['faux-fruit'],array['infusion'],array['acidulé','fruité'],array['hibiscus','pomme','orange'],array['fruité'],'none','standard',null,true,15,'[]'::jsonb),
 ('Pomme séchée','Pomme séchée','Malus domestica',array['pomme déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['doux','fruité'],array['cannelle','camomille','gingembre'],array['gourmandise','fruité'],'none','standard',null,true,10,'[]'::jsonb),
 ('Poire séchée','Poire séchée','Pyrus communis',array['poire déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['doux','fruité'],array['cardamome','vanille','rooibos'],array['gourmandise','fruité'],'none','standard',null,true,15,'[]'::jsonb),
 ('Canneberge séchée','Canneberge séchée','Vaccinium macrocarpon',array['cranberry','cranberries'], 'dried_fruit',array['fruit'],array['infusion'],array['acidulé','fruité'],array['hibiscus','orange','pomme'],array['fruité'],'none','notice','Les fruits séchés peuvent contenir du sucre ajouté. Prudence avec la warfarine en consommation importante.',true,15,'["https://www.nccih.nih.gov/health/cranberry"]'::jsonb),
 ('Myrtille séchée','Myrtille séchée','Vaccinium myrtillus',array['myrtille déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['fruité','doux'],array['hibiscus','pomme','cannelle'],array['fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Framboise séchée','Framboise séchée','Rubus idaeus',array['framboise déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['acidulé','fruité'],array['hibiscus','pomme','menthe'],array['fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Fraise séchée','Fraise séchée','Fragaria x ananassa',array['fraise déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['fruité','doux'],array['hibiscus','vanille','rooibos'],array['gourmandise','fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Cassis séché','Cassis séché','Ribes nigrum',array['cassis déshydraté'], 'dried_fruit',array['fruit'],array['infusion'],array['acidulé','fruité'],array['pomme','hibiscus','menthe'],array['fruité'],'none','standard',null,true,15,'[]'::jsonb),
 ('Pêche séchée','Pêche séchée','Prunus persica',array['pêche déshydratée'], 'dried_fruit',array['fruit'],array['infusion'],array['fruité','doux'],array['verveine','vanille','rooibos'],array['gourmandise','fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Ananas séché','Ananas séché','Ananas comosus',array['ananas déshydraté'], 'dried_fruit',array['fruit'],array['infusion chaude','infusion froide'],array['tropical','fruité'],array['hibiscus','menthe','gingembre'],array['boisson fraîche','fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Mangue séchée','Mangue séchée','Mangifera indica',array['mangue déshydratée'], 'dried_fruit',array['fruit'],array['infusion chaude','infusion froide'],array['tropical','fruité'],array['hibiscus','citron vert','gingembre'],array['boisson fraîche','fruité'],'none','standard','Vérifier la présence éventuelle de sucre ajouté.',true,15,'[]'::jsonb),
 ('Écorce d’orange','Écorce d’orange','Citrus sinensis',array['zeste orange','peau orange'], 'citrus_peel',array['écorce'],array['infusion'],array['agrume','amer'],array['cannelle','rooibos','hibiscus','clou de girofle'],array['réconfort','fruité'],'none','standard','Utiliser une écorce alimentaire correctement lavée, idéalement non traitée.',true,10,'[]'::jsonb),
 ('Écorce de citron','Écorce de citron','Citrus limon',array['zeste citron','peau citron'], 'citrus_peel',array['écorce'],array['infusion'],array['agrume','frais'],array['gingembre','menthe','thym'],array['fraîcheur'],'none','standard','Utiliser une écorce alimentaire correctement lavée, idéalement non traitée.',true,10,'[]'::jsonb),
 ('Citron','Citron','Citrus limon',array['jus de citron','eau citronnée'], 'fresh_fruit',array['fruit','jus'],array['eau aromatisée','infusion'],array['acidulé','frais'],array['menthe','gingembre','thym','hibiscus'],array['eau aromatisée','fraîcheur'],'none','standard','L’acidité peut gêner en cas de reflux et affecter l’émail dentaire en prises fréquentes.',true,10,'[]'::jsonb),
 ('Orange','Orange','Citrus sinensis',array['jus orange'], 'fresh_fruit',array['fruit','jus'],array['eau aromatisée','infusion'],array['agrume','doux'],array['cannelle','hibiscus','rooibos'],array['fruité'],'none','standard',null,true,10,'[]'::jsonb)
)
insert into public.botanical_ingredients(
  canonical_name,display_name,latin_name,aliases,ingredient_kind,usable_parts,
  preparation_forms,flavor_tags,pairing_tags,traditional_context_tags,caffeine_level,
  caution_level,caution_text,composer_enabled,priority,source_urls
)
select canonical,display,latin,aliases,kind,parts,forms,flavors,pairings,contexts,caffeine,
  caution,caution_text,composer,priority,sources from seed
on conflict(normalized_name) do update set
  display_name=excluded.display_name,latin_name=excluded.latin_name,aliases=excluded.aliases,
  ingredient_kind=excluded.ingredient_kind,usable_parts=excluded.usable_parts,
  preparation_forms=excluded.preparation_forms,flavor_tags=excluded.flavor_tags,
  pairing_tags=excluded.pairing_tags,traditional_context_tags=excluded.traditional_context_tags,
  caffeine_level=excluded.caffeine_level,caution_level=excluded.caution_level,
  caution_text=excluded.caution_text,composer_enabled=excluded.composer_enabled,
  priority=excluded.priority,source_urls=excluded.source_urls,enabled=true,updated_at=now();

-- Mélanges de départ : les quantités restent culinaires et modulables.
insert into public.botanical_blends(slug,title,description,intent_tags,moment_tags,preparation_text,serving_note,caution_text,priority)
values
 ('menthe-gingembre-citron','Menthe, gingembre & citron','Une tasse fraîche et légèrement relevée.',array['digestion','fraîcheur'],array['après repas','journée'],'Infuser la menthe avec 2 à 3 fines lamelles de gingembre 5 à 7 minutes, puis ajouter un trait de citron.','Commencer léger et ajuster au goût.','Peut ne pas convenir en cas de reflux.',10),
 ('rooibos-pomme-cannelle','Rooibos, pomme & cannelle','Une boisson ronde sans caféine.',array['gourmandise','réconfort'],array['soir','collation'],'Infuser le rooibos avec quelques morceaux de pomme séchée et un petit morceau de cannelle 6 à 8 minutes.','Sans sucre ajouté par défaut.',null,10),
 ('hibiscus-ananas-menthe','Hibiscus, ananas & menthe','Une infusion fruitée à boire chaude ou refroidie.',array['fraîcheur','fruité'],array['journée'],'Infuser brièvement hibiscus et ananas séché, laisser tiédir puis ajouter la menthe.','Diluer davantage si le goût est trop acidulé.','Prudence en cas de traitement de la tension ou de la glycémie.',15),
 ('camomille-melisse-pomme','Camomille, mélisse & pomme','Un mélange floral et doux.',array['pause','soir'],array['soir'],'Infuser camomille, mélisse et quelques morceaux de pomme 5 minutes.','Une petite pincée de chaque plante suffit.','Prudence en cas d’allergie aux Astéracées ou de traitement anticoagulant.',15),
 ('verveine-peche-rooibos','Verveine, pêche & rooibos','Une tasse douce, fruitée et sans caféine.',array['gourmandise','soir'],array['soir','journée'],'Infuser la verveine, le rooibos et quelques morceaux de pêche séchée 6 minutes.','Vérifier que le fruit séché n’est pas fortement sucré.',null,15)
on conflict(slug) do update set
  title=excluded.title,description=excluded.description,intent_tags=excluded.intent_tags,
  moment_tags=excluded.moment_tags,preparation_text=excluded.preparation_text,
  serving_note=excluded.serving_note,caution_text=excluded.caution_text,
  priority=excluded.priority,enabled=true,updated_at=now();

-- Liaisons des mélanges au catalogue.
with links(blend_slug,ingredient_name,sort_order,quantity_text,optional) as (values
 ('menthe-gingembre-citron','Menthe poivrée',1,'1 petite pincée',false),
 ('menthe-gingembre-citron','Gingembre',2,'2 à 3 fines lamelles',false),
 ('menthe-gingembre-citron','Citron',3,'un trait après infusion',false),
 ('rooibos-pomme-cannelle','Rooibos',1,'1 cuillère à café',false),
 ('rooibos-pomme-cannelle','Pomme séchée',2,'quelques morceaux',false),
 ('rooibos-pomme-cannelle','Cannelle de Ceylan',3,'un petit morceau',false),
 ('hibiscus-ananas-menthe','Hibiscus',1,'1 petite cuillère',false),
 ('hibiscus-ananas-menthe','Ananas séché',2,'quelques morceaux',false),
 ('hibiscus-ananas-menthe','Menthe poivrée',3,'quelques feuilles',true),
 ('camomille-melisse-pomme','Camomille matricaire',1,'1 petite pincée',false),
 ('camomille-melisse-pomme','Mélisse',2,'1 petite pincée',false),
 ('camomille-melisse-pomme','Pomme séchée',3,'quelques morceaux',true),
 ('verveine-peche-rooibos','Verveine citronnée',1,'1 petite pincée',false),
 ('verveine-peche-rooibos','Pêche séchée',2,'quelques morceaux',false),
 ('verveine-peche-rooibos','Rooibos',3,'1 petite cuillère',false)
)
insert into public.botanical_blend_ingredients(blend_id,ingredient_id,sort_order,quantity_text,optional)
select b.id,i.id,l.sort_order,l.quantity_text,l.optional
from links l
join public.botanical_blends b on b.slug=l.blend_slug
join public.botanical_ingredients i on i.normalized_name=public.botanical_normalize(l.ingredient_name)
on conflict(blend_id,ingredient_id) do update set
  sort_order=excluded.sort_order,quantity_text=excluded.quantity_text,optional=excluded.optional;

-- Extension V392 : fruits frais, thés précis et plantes demandées.
-- Les fruits marqués « sucré » correspondent aux morceaux de mélange contenant du sucre ajouté.
with extra(canonical,display,latin,aliases,kind,forms,flavors,pairings,contexts,caffeine,caution,caution_text,composer,priority) as (values
 ('Banane','Banane','Musa spp.',array['banana'],'fresh_fruit',array['smoothie'],array['doux','crémeux'],array['fraise','mangue','cacao','lait'],array['smoothie'],'none','standard',null,true,5),
 ('Pomme','Pomme','Malus domestica',array['apple'],'fresh_fruit',array['smoothie','eau aromatisée','jus'],array['doux','fruité'],array['cannelle','citron','gingembre','framboise'],array['smoothie','boisson fruitée'],'none','standard',null,true,5),
 ('Fraise','Fraise','Fragaria x ananassa',array['strawberry'],'fresh_fruit',array['smoothie','eau aromatisée'],array['fruité','acidulé'],array['banane','framboise','menthe','yaourt'],array['smoothie','boisson fruitée'],'none','standard',null,true,5),
 ('Framboise','Framboise','Rubus idaeus',array['raspberry'],'fresh_fruit',array['smoothie','eau aromatisée'],array['acidulé','fruité'],array['fraise','pomme','yaourt','menthe'],array['smoothie','boisson fruitée'],'none','standard',null,true,5),
 ('Myrtille','Myrtille','Vaccinium spp.',array['blueberry'],'fresh_fruit',array['smoothie'],array['fruité','doux'],array['banane','yaourt','cacao'],array['smoothie'],'none','standard',null,true,5),
 ('Mangue','Mangue','Mangifera indica',array['mango'],'fresh_fruit',array['smoothie','eau aromatisée'],array['tropical','doux'],array['fruit de la passion','citron vert','coco','ananas'],array['smoothie','boisson fruitée'],'none','standard',null,true,5),
 ('Ananas','Ananas','Ananas comosus',array['pineapple'],'fresh_fruit',array['smoothie','eau aromatisée'],array['tropical','acidulé'],array['mangue','menthe','gingembre','coco'],array['smoothie','boisson fruitée'],'none','standard',null,true,5),
 ('Papaye','Papaye','Carica papaya',array['papaya'],'fresh_fruit',array['smoothie'],array['tropical','doux'],array['citron vert','mangue','coco'],array['smoothie'],'none','standard',null,true,7),
 ('Fruit de la passion','Fruit de la passion','Passiflora edulis',array['maracuja','passion'],'fresh_fruit',array['smoothie','eau aromatisée'],array['tropical','acidulé'],array['mangue','orange','coco'],array['smoothie','boisson fruitée'],'none','standard',null,true,7),
 ('Poire','Poire','Pyrus communis',array['pear'],'fresh_fruit',array['smoothie','eau aromatisée'],array['doux','fruité'],array['vanille','cardamome','pomme'],array['smoothie','boisson fruitée'],'none','standard',null,true,7),
 ('Pêche','Pêche','Prunus persica',array['peach'],'fresh_fruit',array['smoothie','eau aromatisée'],array['doux','fruité'],array['verveine','framboise','vanille'],array['smoothie','boisson fruitée'],'none','standard',null,true,7),
 ('Abricot','Abricot','Prunus armeniaca',array['apricot'],'fresh_fruit',array['smoothie'],array['fruité','doux'],array['pêche','amande','orange'],array['smoothie'],'none','standard',null,true,8),
 ('Kiwi','Kiwi','Actinidia deliciosa',array['kiwifruit'],'fresh_fruit',array['smoothie','eau aromatisée'],array['acidulé','frais'],array['pomme','banane','menthe'],array['smoothie','boisson fruitée'],'none','standard',null,true,7),
 ('Pastèque','Pastèque','Citrullus lanatus',array['watermelon'],'fresh_fruit',array['smoothie','eau aromatisée'],array['frais','doux'],array['menthe','citron vert','fraise'],array['boisson fruitée'],'none','standard',null,true,7),
 ('Melon','Melon','Cucumis melo',array['cantaloup'],'fresh_fruit',array['smoothie','eau aromatisée'],array['doux','frais'],array['menthe','citron','pastèque'],array['boisson fruitée'],'none','standard',null,true,8),
 ('Raisin','Raisin','Vitis vinifera',array['grape'],'fresh_fruit',array['smoothie','eau aromatisée'],array['doux','fruité'],array['pomme','citron','menthe'],array['boisson fruitée'],'none','standard',null,true,8),
 ('Cerise','Cerise','Prunus avium',array['cherry'],'fresh_fruit',array['smoothie','eau aromatisée'],array['fruité','doux'],array['cacao','vanille','fraise'],array['smoothie'],'none','standard',null,true,8),
 ('Groseille','Groseille','Ribes rubrum',array['redcurrant'],'fresh_fruit',array['smoothie','eau aromatisée'],array['acidulé','fruité'],array['fraise','pomme','menthe'],array['boisson fruitée'],'none','standard',null,true,9),
 ('Aronia','Aronia','Aronia melanocarpa',array['baie aronia'],'fresh_fruit',array['smoothie'],array['astringent','fruité'],array['pomme','framboise','banane'],array['smoothie'],'none','standard',null,true,10),
 ('Coco','Coco','Cocos nucifera',array['noix de coco'],'fresh_fruit',array['smoothie','boisson végétale'],array['crémeux','tropical'],array['mangue','ananas','banane','cacao'],array['smoothie','gourmand'],'none','standard',null,true,7),
 ('Thé vert China Chun Mee','Thé vert China Chun Mee','Camellia sinensis',array['chun mee'],'tea',array['infusion'],array['végétal','astringent'],array['citron','jasmin','menthe'],array['journée','énergie'],'present','notice','Contient de la caféine ; éviter tard le soir si sensible.',true,10),
 ('Thé vert China Sencha','Thé vert China Sencha','Camellia sinensis',array['china sencha','sencha'],'tea',array['infusion'],array['végétal','frais'],array['citron','jasmin','pêche'],array['journée','énergie'],'present','notice','Contient de la caféine ; éviter tard le soir si sensible.',true,10),
 ('Thé blanc Pai Mu Tan','Thé blanc Pai Mu Tan','Camellia sinensis',array['pai mu tan','bai mu dan'],'tea',array['infusion'],array['floral','doux'],array['pêche','poire','rose'],array['journée'],'present','notice','Contient de la caféine, même si son intensité varie.',true,10),
 ('Thé blanc Mao Feng','Thé blanc Mao Feng','Camellia sinensis',array['mao feng'],'tea',array['infusion'],array['floral','doux'],array['mangue','pêche','jasmin'],array['journée'],'present','notice','Contient de la caféine, même si son intensité varie.',true,10),
 ('China Jasmin Dragon Pearls','China Jasmin Dragon Pearls','Camellia sinensis',array['jasmine dragon pearls','perles de jasmin'],'tea',array['infusion'],array['jasmin','floral'],array['poire','pêche','citron'],array['journée'],'present','notice','Contient de la caféine ; éviter tard le soir si sensible.',true,10),
 ('Maté','Maté','Ilex paraguariensis',array['yerba mate'],'tea',array['infusion'],array['végétal','amer'],array['citron','menthe','orange'],array['journée','énergie'],'present','notice','Contient de la caféine ; déconseillé tard le soir et en cas de sensibilité.',true,15),
 ('Bardane','Bardane','Arctium lappa',array['racine de bardane'],'plant',array['décoction'],array['terreux','amer'],array['pissenlit','cannelle'],array['tradition'],'none','notice','Prudence en cas de grossesse, allergie aux Astéracées, diabète ou traitement diurétique.',true,30),
 ('Feuille de framboisier','Feuille de framboisier','Rubus idaeus',array['feuilles de framboisier'],'plant',array['infusion'],array['herbacé','doux'],array['mélisse','pomme'],array['tradition','confort menstruel'],'none','notice','Grossesse : demander un avis professionnel avant utilisation.',true,20),
 ('Achillée millefeuille','Achillée millefeuille','Achillea millefolium',array['achillée'],'plant',array['infusion'],array['amer','aromatique'],array['mélisse','camomille'],array['tradition'],'none','notice','Éviter pendant la grossesse et en cas d’allergie aux Astéracées.',true,25),
 ('Calendula','Calendula','Calendula officinalis',array['souci officinal'],'plant',array['infusion'],array['floral','doux'],array['camomille','mélisse'],array['tradition'],'none','notice','Prudence en cas d’allergie aux Astéracées ; éviter pendant la grossesse sans avis.',true,25),
 ('Feuille de bouleau','Feuille de bouleau','Betula spp.',array['bouleau'],'plant',array['infusion'],array['herbacé'],array['ortie','citron'],array['tradition'],'none','notice','Éviter en cas d’insuffisance rénale/cardiaque ou d’allergie au bouleau sans avis.',true,30),
 ('Prêle','Prêle','Equisetum arvense',array['queue de cheval'],'plant',array['infusion'],array['herbacé'],array['ortie','citron'],array['tradition'],'none','notice','Éviter l’usage prolongé et en cas de maladie rénale ; prudence avec les diurétiques.',true,30),
 ('Anis vert','Anis vert','Pimpinella anisum',array['anis'],'spice',array['infusion'],array['anisé','doux'],array['fenouil','cannelle'],array['après repas'],'none','notice','Prudence en cas d’allergie aux Apiacées ou de grossesse.',true,18),
 ('Badiane','Badiane','Illicium verum',array['anis étoilé'],'spice',array['infusion'],array['anisé','épicé'],array['cannelle','orange'],array['gourmand'],'none','notice','Utiliser uniquement de la badiane alimentaire identifiée ; ne pas donner aux nourrissons.',true,20),
 ('Verveine officinale','Verveine officinale','Verbena officinalis',array['verveine entière'],'plant',array['infusion'],array['herbacé','amer'],array['mélisse','citron'],array['tradition'],'none','notice','Éviter pendant la grossesse sans avis professionnel.',true,25),
 ('Feuille d’olivier','Feuille d’olivier','Olea europaea',array['feuilles olivier'],'plant',array['infusion'],array['amer','herbacé'],array['citron','romarin'],array['tradition'],'none','notice','Prudence avec les traitements de la tension ou du diabète.',true,30),
 ('Fève de cacao concassée','Fève de cacao concassée','Theobroma cacao',array['cacao nibs','grué de cacao'],'other',array['infusion','boisson'],array['cacao','amer'],array['banane','coco','cannelle'],array['gourmand'],'low','notice','Peut contenir des stimulants ; éviter tard le soir si sensible.',true,15),
 ('Valériane','Valériane','Valeriana officinalis',array['racine de valériane'],'plant',array['infusion'],array['terreux','amer'],array['mélisse','lavande'],array['soir'],'none','high','Peut provoquer une somnolence et interagir avec des sédatifs ; grossesse/allaitement : sécurité inconnue.',false,80),
 ('Passiflore','Passiflore','Passiflora incarnata',array['fleur de passiflore'],'plant',array['infusion'],array['herbacé'],array['mélisse','lavande'],array['soir'],'none','high','Peut provoquer somnolence, vertiges ou confusion ; éviter pendant la grossesse.',false,80),
 ('Millepertuis','Millepertuis','Hypericum perforatum',array['saint john wort'],'plant',array['infusion'],array['amer'],array[]::text[],array['tradition'],'none','high','Interactions nombreuses et parfois graves avec les médicaments ; jamais suggéré automatiquement.',false,100),
 ('Fleurs de houblon','Fleurs de houblon','Humulus lupulus',array['houblon'],'plant',array['infusion'],array['amer'],array['mélisse'],array['soir'],'none','high','Effet sédatif possible et interactions ; demander conseil en cas de traitement, grossesse ou allaitement.',false,80),
 ('Ananas séché sucré','Ananas séché (avec sucre)','Ananas comosus',array['ananas sucre'],'dried_fruit',array['infusion'],array['tropical','sucré'],array['hibiscus','menthe'],array['gourmand'],'none','notice','Contient du sucre ajouté : le distinguer de l’ananas frais.',true,20),
 ('Mangue séchée sucrée','Mangue séchée (avec sucre)','Mangifera indica',array['mangue sucre'],'dried_fruit',array['infusion'],array['tropical','sucré'],array['thé blanc','hibiscus'],array['gourmand'],'none','notice','Contient du sucre ajouté : le distinguer de la mangue fraîche.',true,20),
 ('Papaye séchée sucrée','Papaye séchée (avec sucre)','Carica papaya',array['papaye sucre'],'dried_fruit',array['infusion'],array['tropical','sucré'],array['mangue','hibiscus'],array['gourmand'],'none','notice','Contient du sucre ajouté : le distinguer de la papaye fraîche.',true,20),
 ('Fleurs de bleuet','Fleurs de bleuet','Centaurea cyanus',array['bleuet fleur'],'plant',array['infusion'],array['floral'],array['thé blanc','mangue'],array['décoratif'],'none','notice','Usage alimentaire en petite quantité ; prudence en cas d’allergie aux Astéracées.',true,25)
)
insert into public.botanical_ingredients(canonical_name,display_name,latin_name,aliases,ingredient_kind,usable_parts,preparation_forms,flavor_tags,pairing_tags,traditional_context_tags,caffeine_level,caution_level,caution_text,composer_enabled,priority)
select canonical,display,latin,aliases,kind,array['partie alimentaire'],forms,flavors,pairings,contexts,caffeine,caution,caution_text,composer,priority from extra
on conflict(normalized_name) do update set display_name=excluded.display_name,latin_name=excluded.latin_name,aliases=excluded.aliases,ingredient_kind=excluded.ingredient_kind,preparation_forms=excluded.preparation_forms,flavor_tags=excluded.flavor_tags,pairing_tags=excluded.pairing_tags,traditional_context_tags=excluded.traditional_context_tags,caffeine_level=excluded.caffeine_level,caution_level=excluded.caution_level,caution_text=excluded.caution_text,composer_enabled=excluded.composer_enabled,priority=excluded.priority,enabled=true,updated_at=now();

-- Complément de fruits courants et tropicaux. Le catalogue reste extensible :
-- il couvre largement les saisies usuelles sans prétendre figer tous les cultivars du monde.
with more_fruits(canonical,latin,aliases,flavors,pairings,forms,priority) as (values
 ('Orange','Citrus sinensis',array['orange douce'],array['agrume','doux'],array['carotte','gingembre','fraise'],array['smoothie','eau aromatisée','jus'],5),
 ('Citron vert','Citrus aurantiifolia',array['lime'],array['agrume','acidulé'],array['mangue','menthe','pastèque'],array['smoothie','eau aromatisée'],5),
 ('Pamplemousse','Citrus paradisi',array['grapefruit'],array['agrume','amer'],array['orange','romarin','fraise'],array['eau aromatisée','jus'],10),
 ('Mandarine','Citrus reticulata',array['clémentine','clementine'],array['agrume','doux'],array['pomme','cannelle','mangue'],array['smoothie','eau aromatisée'],7),
 ('Prune','Prunus domestica',array['plum'],array['fruité','acidulé'],array['pomme','cannelle','poire'],array['smoothie'],9),
 ('Mirabelle','Prunus domestica subsp. syriaca',array[]::text[],array['fruité','doux'],array['poire','vanille'],array['smoothie'],10),
 ('Figue fraîche','Ficus carica',array['figue'],array['doux','miellé'],array['poire','cannelle','yaourt'],array['smoothie'],9),
 ('Datte','Phoenix dactylifera',array['dattes'],array['doux','caramélisé'],array['banane','cacao','boisson amande'],array['smoothie'],9),
 ('Grenade','Punica granatum',array['pomegranate'],array['acidulé','fruité'],array['orange','framboise','menthe'],array['eau aromatisée','jus'],9),
 ('Litchi','Litchi chinensis',array['lychee'],array['floral','doux'],array['framboise','citron vert','jasmin'],array['smoothie','eau aromatisée'],10),
 ('Goyave','Psidium guajava',array['guava'],array['tropical','fruité'],array['fraise','citron vert','mangue'],array['smoothie'],10),
 ('Corossol','Annona muricata',array['graviola'],array['crémeux','tropical'],array['ananas','citron vert','coco'],array['smoothie'],12),
 ('Fruit du dragon','Selenicereus undatus',array['pitaya','dragon fruit'],array['doux','frais'],array['mangue','citron vert','framboise'],array['smoothie'],11),
 ('Kaki','Diospyros kaki',array['persimmon'],array['doux','fruité'],array['orange','cannelle','poire'],array['smoothie'],10),
 ('Nectarine','Prunus persica var. nucipersica',array[]::text[],array['fruité','doux'],array['framboise','verveine','citron'],array['smoothie','eau aromatisée'],9),
 ('Mûre','Rubus fruticosus',array['blackberry'],array['fruité','acidulé'],array['pomme','framboise','menthe'],array['smoothie','eau aromatisée'],9),
 ('Cassis','Ribes nigrum',array['blackcurrant'],array['acidulé','intense'],array['pomme','myrtille','menthe'],array['smoothie','eau aromatisée'],9),
 ('Canneberge fraîche','Vaccinium macrocarpon',array['cranberry','canneberge'],array['acidulé'],array['pomme','orange','framboise'],array['smoothie','eau aromatisée'],10),
 ('Carambole','Averrhoa carambola',array['star fruit'],array['acidulé','frais'],array['ananas','citron vert','menthe'],array['eau aromatisée'],12),
 ('Ramboutan','Nephelium lappaceum',array['rambutan'],array['doux','floral'],array['litchi','citron vert'],array['smoothie'],14)
)
insert into public.botanical_ingredients(canonical_name,display_name,latin_name,aliases,ingredient_kind,usable_parts,preparation_forms,flavor_tags,pairing_tags,traditional_context_tags,caffeine_level,caution_level,composer_enabled,priority)
select canonical,canonical,latin,aliases,'fresh_fruit',array['fruit'],forms,flavors,pairings,array['smoothie','boisson fruitée'],'none','standard',true,priority from more_fruits
on conflict(normalized_name) do update set latin_name=excluded.latin_name,aliases=excluded.aliases,preparation_forms=excluded.preparation_forms,flavor_tags=excluded.flavor_tags,pairing_tags=excluded.pairing_tags,composer_enabled=true,enabled=true,updated_at=now();

-- Bases usuelles pour smoothies : elles sont proposées comme ingrédients culinaires,
-- sans convertir automatiquement leur volume en hydratation.
with bases(canonical,display,aliases,kind,forms,flavors,pairings,contexts,priority) as (values
 ('Boisson d’amande','Boisson à l’amande',array['lait amande','boisson amande'],'other',array['smoothie'],array['doux'],array['banane','fraise','cacao'],array['smoothie','gourmand'],12),
 ('Boisson de coco','Boisson de coco',array['lait coco','boisson coco'],'other',array['smoothie'],array['crémeux','tropical'],array['mangue','ananas','banane'],array['smoothie','gourmand'],12),
 ('Yaourt grec','Yaourt grec',array['yogourt grec'],'other',array['smoothie'],array['crémeux'],array['fraise','framboise','myrtille'],array['smoothie','gourmand'],12),
 ('Eau','Eau',array['eau plate'],'other',array['eau aromatisée','infusion','smoothie'],array['neutre'],array[]::text[],array['hydratation'],1)
)
insert into public.botanical_ingredients(canonical_name,display_name,aliases,ingredient_kind,usable_parts,preparation_forms,flavor_tags,pairing_tags,traditional_context_tags,caffeine_level,caution_level,composer_enabled,priority)
select canonical,display,aliases,kind,array['aliment'],forms,flavors,pairings,contexts,'none','standard',true,priority from bases
on conflict(normalized_name) do update set display_name=excluded.display_name,aliases=excluded.aliases,preparation_forms=excluded.preparation_forms,flavor_tags=excluded.flavor_tags,pairing_tags=excluded.pairing_tags,traditional_context_tags=excluded.traditional_context_tags,composer_enabled=true,enabled=true,updated_at=now();

-- Recettes culinaires déterministes. Plusieurs profils sont prévus afin que
-- « une autre idée » ne retombe pas toujours sur épinard/courgette ou le même fruit.
with recipes(slug,title,description,intents,moments,preparation,serving,caution,priority) as (values
 ('smoothie-banane-fraise','Smoothie banane–fraise','Crémeux et fruité.',array['gourmand','energy'],array['matin','collation'],'Mixer la banane et les fraises avec 150 à 200 ml de boisson d’amande ou d’eau. Ajuster la texture sans ajouter automatiquement de sucre.','1 verre',null,4),
 ('smoothie-mangue-passion-coco','Smoothie mangue–passion–coco','Une composition tropicale.',array['gourmand','energy'],array['matin','collation'],'Mixer la mangue avec la pulpe du fruit de la passion et un peu de boisson de coco. Ajouter de l’eau si nécessaire.','1 verre',null,4),
 ('smoothie-myrtille-framboise-yaourt','Smoothie myrtille–framboise','Fruité, acidulé et crémeux.',array['gourmand','energy'],array['matin','collation'],'Mixer les myrtilles et les framboises avec le yaourt grec et un trait d’eau.','1 verre',null,5),
 ('smoothie-banane-cacao-coco','Smoothie banane–cacao','Une option gourmande au cacao.',array['gourmand','energy'],array['matin','collation'],'Mixer la banane avec la boisson de coco et une petite quantité de fève de cacao concassée finement.','1 verre','Le cacao peut contenir des stimulants : éviter tard le soir si sensible.',6),
 ('eau-pasteque-menthe-citron','Eau fraîche pastèque–menthe','Une boisson fruitée non sucrée.',array['hydration','gourmand'],array['journée'],'Écraser quelques cubes de pastèque et des feuilles de menthe dans de l’eau fraîche, puis ajouter un trait de citron.','1 grand verre',null,5),
 ('eau-pomme-framboise','Eau pomme–framboise','Une eau aromatisée douce et acidulée.',array['hydration','gourmand'],array['journée'],'Ajouter de fines tranches de pomme et quelques framboises à une carafe d’eau. Laisser infuser au frais.','1 carafe',null,6),
 ('eau-ananas-gingembre-menthe','Eau ananas–gingembre–menthe','Une association tropicale et fraîche.',array['hydration','gourmand'],array['journée'],'Ajouter quelques morceaux d’ananas, une fine lamelle de gingembre et de la menthe à de l’eau fraîche.','1 carafe',null,6),
 ('pai-mu-tan-mangue-orange','Pai Mu Tan mangue–orange','Thé blanc fruité.',array['gourmand','energy'],array['matin','après-midi'],'Infuser le thé blanc selon son emballage avec un peu de mangue séchée et d’écorce d’orange.','1 tasse','Contient de la caféine.',8),
 ('sencha-jasmin-fraise','Sencha jasmin–fraise','Thé vert floral et fruité.',array['gourmand','energy'],array['matin','après-midi'],'Infuser brièvement le Sencha avec quelques perles de jasmin, puis ajouter une fraise coupée après infusion.','1 tasse','Contient de la caféine ; éviter tard le soir si sensible.',8),
 ('rooibos-pomme-cacao','Rooibos pomme–cacao','Rituel chaud gourmand sans thé.',array['gourmand','calm'],array['soir','collation'],'Infuser le rooibos avec quelques morceaux de pomme séchée et une petite pincée de cacao concassé.','1 tasse','Le cacao peut contenir un peu de stimulants.',9),
 ('citronnelle-melisse-verveine','Citronnelle–mélisse–verveine','Rituel aromatique sans caféine.',array['calm','digestive_comfort'],array['soir','après repas'],'Infuser une petite pincée de citronnelle, mélisse et verveine pendant 5 à 7 minutes.','1 tasse','Repère de confort uniquement ; ne traite pas l’insomnie ni un trouble digestif.',8),
 ('fenouil-anis-camomille','Fenouil–anis–camomille','Mélange aromatique après repas.',array['digestive_comfort'],array['après repas'],'Infuser de petites quantités de fenouil et d’anis avec la camomille pendant 5 minutes.','1 tasse','Éviter en cas d’allergie aux Apiacées/Astéracées ; grossesse : demander conseil.',10),
 ('framboisier-melisse-pomme','Framboisier–mélisse–pomme','Rituel chaud doux.',array['menstrual_comfort','calm'],array['journée','soir'],'Infuser une petite pincée de feuille de framboisier et de mélisse avec quelques morceaux de pomme séchée.','1 tasse','Ne traite pas une douleur ou un trouble du cycle. Grossesse : demander un avis professionnel.',11),
 ('hibiscus-mangue-passion','Hibiscus mangue–passion','Infusion fruitée acidulée, chaude ou froide.',array['gourmand','hydration'],array['journée'],'Infuser l’hibiscus avec un peu de mangue séchée, laisser tiédir puis ajouter du fruit de la passion.','1 grand verre','La mangue séchée sucrée apporte du sucre ajouté.',8),
 ('orange-cannelle-romarin','Orange–cannelle–romarin','Infusion aromatique et épicée.',array['gourmand'],array['journée'],'Infuser une petite écorce d’orange, un court morceau de cannelle et très peu de romarin pendant 5 minutes.','1 tasse',null,10)
)
insert into public.botanical_blends(slug,title,description,intent_tags,moment_tags,preparation_text,serving_note,caution_text,composer_enabled,priority,enabled)
select slug,title,description,intents,moments,preparation,serving,caution,true,priority,true from recipes
on conflict(slug) do update set title=excluded.title,description=excluded.description,intent_tags=excluded.intent_tags,moment_tags=excluded.moment_tags,preparation_text=excluded.preparation_text,serving_note=excluded.serving_note,caution_text=excluded.caution_text,composer_enabled=true,priority=excluded.priority,enabled=true,updated_at=now();

with recipe_links(blend_slug,ingredient_name,sort_order,quantity_text,optional) as (values
 ('smoothie-banane-fraise','Banane',1,'1 petite banane',false),('smoothie-banane-fraise','Fraise',2,'une poignée',false),('smoothie-banane-fraise','Boisson d’amande',3,'150 à 200 ml',true),('smoothie-banane-fraise','Eau',4,'selon texture',true),
 ('smoothie-mangue-passion-coco','Mangue',1,'une demi-mangue',false),('smoothie-mangue-passion-coco','Fruit de la passion',2,'1 fruit',false),('smoothie-mangue-passion-coco','Boisson de coco',3,'150 ml',true),
 ('smoothie-myrtille-framboise-yaourt','Myrtille',1,'une poignée',false),('smoothie-myrtille-framboise-yaourt','Framboise',2,'une poignée',false),('smoothie-myrtille-framboise-yaourt','Yaourt grec',3,'1 portion',true),
 ('smoothie-banane-cacao-coco','Banane',1,'1 petite banane',false),('smoothie-banane-cacao-coco','Fève de cacao concassée',2,'1 petite cuillère',false),('smoothie-banane-cacao-coco','Boisson de coco',3,'150 ml',true),
 ('eau-pasteque-menthe-citron','Pastèque',1,'quelques cubes',false),('eau-pasteque-menthe-citron','Menthe poivrée',2,'quelques feuilles',false),('eau-pasteque-menthe-citron','Citron',3,'un trait',true),('eau-pasteque-menthe-citron','Eau',4,'un grand verre',true),
 ('eau-pomme-framboise','Pomme',1,'quelques tranches',false),('eau-pomme-framboise','Framboise',2,'quelques fruits',false),('eau-pomme-framboise','Eau',3,'une carafe',true),
 ('eau-ananas-gingembre-menthe','Ananas',1,'quelques morceaux',false),('eau-ananas-gingembre-menthe','Gingembre',2,'une fine lamelle',false),('eau-ananas-gingembre-menthe','Menthe poivrée',3,'quelques feuilles',true),('eau-ananas-gingembre-menthe','Eau',4,'une carafe',true),
 ('pai-mu-tan-mangue-orange','Thé blanc Pai Mu Tan',1,'dose habituelle',false),('pai-mu-tan-mangue-orange','Mangue séchée sucrée',2,'quelques morceaux',true),('pai-mu-tan-mangue-orange','Écorce d’orange',3,'un petit morceau',true),
 ('sencha-jasmin-fraise','Thé vert China Sencha',1,'dose habituelle',false),('sencha-jasmin-fraise','China Jasmin Dragon Pearls',2,'quelques perles',true),('sencha-jasmin-fraise','Fraise',3,'1 fruit',true),
 ('rooibos-pomme-cacao','Rooibos',1,'1 cuillère',false),('rooibos-pomme-cacao','Pomme séchée',2,'quelques morceaux',false),('rooibos-pomme-cacao','Fève de cacao concassée',3,'une pincée',true),
 ('citronnelle-melisse-verveine','Citronnelle',1,'une pincée',false),('citronnelle-melisse-verveine','Mélisse',2,'une pincée',false),('citronnelle-melisse-verveine','Verveine citronnée',3,'une pincée',true),
 ('fenouil-anis-camomille','Fenouil',1,'une petite pincée',false),('fenouil-anis-camomille','Anis vert',2,'une petite pincée',false),('fenouil-anis-camomille','Camomille matricaire',3,'une pincée',true),
 ('framboisier-melisse-pomme','Feuille de framboisier',1,'une pincée',false),('framboisier-melisse-pomme','Mélisse',2,'une pincée',false),('framboisier-melisse-pomme','Pomme séchée',3,'quelques morceaux',true),
 ('hibiscus-mangue-passion','Hibiscus',1,'une petite cuillère',false),('hibiscus-mangue-passion','Mangue séchée sucrée',2,'quelques morceaux',true),('hibiscus-mangue-passion','Fruit de la passion',3,'un peu de pulpe',true),
 ('orange-cannelle-romarin','Écorce d’orange',1,'un petit morceau',false),('orange-cannelle-romarin','Cannelle de Ceylan',2,'un court bâton',false),('orange-cannelle-romarin','Romarin',3,'une petite pincée',true)
)
insert into public.botanical_blend_ingredients(blend_id,ingredient_id,sort_order,quantity_text,optional)
select b.id,i.id,l.sort_order,l.quantity_text,l.optional from recipe_links l join public.botanical_blends b on b.slug=l.blend_slug join public.botanical_ingredients i on i.normalized_name=public.botanical_normalize(l.ingredient_name)
on conflict(blend_id,ingredient_id) do update set sort_order=excluded.sort_order,quantity_text=excluded.quantity_text,optional=excluded.optional;

-- Suggestions : une composition uniquement si ses ingrédients sensibles sont absents.
create or replace function public.suggest_botanical_beverage(
  p_ingredient_ids uuid[], p_intent text default 'hydration',
  p_caffeine_sensitive boolean default false,
  p_pregnancy_or_breastfeeding boolean default false,
  p_regular_medication boolean default false
) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
  with available as (select unnest(coalesce(p_ingredient_ids,'{}'::uuid[])) id), candidates as (
    select b.id,b.title,b.preparation_text,b.caution_text,b.intent_tags,b.priority,
      count(*) filter(where bi.ingredient_id in(select id from available)) present_count,
      count(*) filter(where not bi.optional and bi.ingredient_id not in(select id from available)) missing_count,
      bool_or(i.caution_level='high') high_risk,
      bool_or(i.caffeine_level in('present','variable')) caffeinated,
      bool_or(i.caution_level='notice') notice_risk,
      array_agg(i.display_name order by bi.sort_order) filter(where not bi.optional and bi.ingredient_id not in(select id from available)) missing
    from botanical_blends b join botanical_blend_ingredients bi on bi.blend_id=b.id join botanical_ingredients i on i.id=bi.ingredient_id
    where b.enabled and b.composer_enabled group by b.id
  ), ranked as (
    select *, (present_count*30)-(missing_count*18)+case when p_intent=any(intent_tags) then 35 else 0 end-priority score
    from candidates where present_count>0 and missing_count<=2 and not high_risk
      and not(p_caffeine_sensitive and caffeinated)
      and not((p_pregnancy_or_breastfeeding or p_regular_medication) and notice_risk)
    order by score desc,title limit 1
  ) select jsonb_build_object('blend_id',id,'title',title,'reason',case when p_intent='energy' then 'Cette composition utilise ce que tu as pour une boisson tonique au goût, sans promesse médicale.' when p_intent='digestive_comfort' then 'Une composition culinaire simple pour un moment après repas ; elle ne traite pas un trouble digestif.' when p_intent='calm' then 'Une boisson sans stimulant proposée comme rituel de pause, pas comme traitement du sommeil.' when p_intent='menstrual_comfort' then 'Un rituel chaud et doux, sans prétendre agir sur les règles ou une douleur.' when p_intent='gourmand' then 'Une association fruitée ou aromatique cohérente avec une envie gourmande.' else 'Une façon simple et variée d’utiliser les ingrédients disponibles.' end,'preparation',preparation_text,'missing',coalesce(to_jsonb(missing),'[]'::jsonb),'caution',caution_text) into result from ranked;
  return result;
end $$;
grant execute on function public.suggest_botanical_beverage(uuid[],text,boolean,boolean,boolean) to authenticated;

-- Contrôle final à afficher dans SQL Editor.
select
  (select count(*) from public.botanical_ingredients where enabled) as ingredients_actifs,
  (select count(*) from public.botanical_ingredients where enabled and composer_enabled) as suggerables,
  (select count(*) from public.botanical_ingredients where enabled and not composer_enabled) as sensibles_exclus,
  (select count(*) from public.botanical_blends where enabled) as melanges_actifs;
