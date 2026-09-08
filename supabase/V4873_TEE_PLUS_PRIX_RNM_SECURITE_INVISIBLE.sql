-- MÉTHODE TEE — V487.3 · TEE+ PRIX RNM + SÉCURITÉ PHYTO INVISIBLE
-- Additif. Aucun cron, aucune API IA externe, aucun service d'observabilité payant.
-- Les outils détaillés ne lisent/écrivent qu'après action explicite de l'utilisateur.
begin;

-- ---------------------------------------------------------------------------
-- A. SÉCURITÉ PHYTOTHÉRAPIE — profil privé + règles conservatrices
-- ---------------------------------------------------------------------------
create table if not exists public.mt_phyto_user_profile(
  user_id uuid primary key references auth.users(id) on delete cascade,
  regular_medication boolean not null default false,
  anticoagulants boolean not null default false,
  sedatives boolean not null default false,
  hypertension boolean not null default false,
  pregnancy boolean not null default false,
  breastfeeding boolean not null default false,
  caffeine_sensitive boolean not null default false,
  allergy_asteraceae boolean not null default false,
  hormone_sensitive boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.mt_phyto_user_profile enable row level security;
drop policy if exists "phyto profile owner" on public.mt_phyto_user_profile;
create policy "phyto profile owner" on public.mt_phyto_user_profile for all to authenticated using(auth.uid()=user_id or public.is_admin()) with check(auth.uid()=user_id or public.is_admin());

create table if not exists public.mt_phyto_rules(
  id bigint generated always as identity primary key,
  plant_key text not null,
  display_name text not null,
  aliases text[] not null default '{}',
  trigger_key text not null,
  severity text not null default 'verify' check(severity in('caution','verify','block_auto')),
  message text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(plant_key,trigger_key)
);
alter table public.mt_phyto_rules enable row level security;
drop policy if exists "phyto rules read" on public.mt_phyto_rules;
create policy "phyto rules read" on public.mt_phyto_rules for select to authenticated using(enabled or public.is_admin());
drop policy if exists "phyto rules admin" on public.mt_phyto_rules;
create policy "phyto rules admin" on public.mt_phyto_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.mt_phyto_rules(plant_key,display_name,aliases,trigger_key,severity,message) values
('millepertuis','Millepertuis',array['hypericum'], 'regular_medication','block_auto','Traitement régulier renseigné : cette plante ne doit pas être suggérée automatiquement. Une vérification professionnelle est nécessaire.'),
('reglisse','Réglisse',array['glycyrrhiza'], 'hypertension','block_auto','Hypertension renseignée : ne pas proposer automatiquement cette plante sans vérification professionnelle.'),
('valeriane','Valériane',array['valeriana'], 'sedatives','verify','Traitement sédatif renseigné : vérifier la compatibilité avant utilisation.'),
('passiflore','Passiflore',array['passiflora'], 'sedatives','verify','Traitement sédatif renseigné : vérifier la compatibilité avant utilisation.'),
('sauge officinale','Sauge officinale',array['sauge'], 'hormone_sensitive','verify','Situation hormono-sensible renseignée : vérifier cette plante avant utilisation.'),
('sauge officinale','Sauge officinale',array['sauge'], 'pregnancy','block_auto','Grossesse renseignée : cette plante ne doit pas être suggérée automatiquement sans vérification professionnelle.'),
('mate','Maté',array['yerba mate'], 'caffeine_sensitive','caution','Sensibilité forte à la caféine renseignée : prudence avec cette plante stimulante.'),
('the vert','Thé vert',array['camellia sinensis'], 'caffeine_sensitive','caution','Sensibilité forte à la caféine renseignée : prudence avec cette boisson/plante stimulante.'),
('ginkgo','Ginkgo',array['ginkgo biloba'], 'anticoagulants','verify','Traitement anticoagulant/antiagrégant renseigné : vérifier la compatibilité avant utilisation.'),
('curcuma','Curcuma',array['curcuma longa'], 'anticoagulants','verify','Traitement anticoagulant/antiagrégant renseigné : vérifier l’usage concentré ou complémentaire avant utilisation.'),
('ginseng','Ginseng',array['panax ginseng'], 'hypertension','verify','Hypertension renseignée : vérifier la compatibilité avant utilisation.'),
('ashwagandha','Ashwagandha',array['withania somnifera'], 'pregnancy','block_auto','Grossesse renseignée : cette plante ne doit pas être suggérée automatiquement sans vérification professionnelle.')
on conflict(plant_key,trigger_key) do update set display_name=excluded.display_name,aliases=excluded.aliases,severity=excluded.severity,message=excluded.message,enabled=true,updated_at=now();

create or replace function public.mt_phyto_save_profile(p_flags jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.mt_phyto_user_profile(user_id,regular_medication,anticoagulants,sedatives,hypertension,pregnancy,breastfeeding,caffeine_sensitive,allergy_asteraceae,hormone_sensitive,updated_at)
 values(u,coalesce((p_flags->>'regular_medication')::boolean,false),coalesce((p_flags->>'anticoagulants')::boolean,false),coalesce((p_flags->>'sedatives')::boolean,false),coalesce((p_flags->>'hypertension')::boolean,false),coalesce((p_flags->>'pregnancy')::boolean,false),coalesce((p_flags->>'breastfeeding')::boolean,false),coalesce((p_flags->>'caffeine_sensitive')::boolean,false),coalesce((p_flags->>'allergy_asteraceae')::boolean,false),coalesce((p_flags->>'hormone_sensitive')::boolean,false),now())
 on conflict(user_id) do update set regular_medication=excluded.regular_medication,anticoagulants=excluded.anticoagulants,sedatives=excluded.sedatives,hypertension=excluded.hypertension,pregnancy=excluded.pregnancy,breastfeeding=excluded.breastfeeding,caffeine_sensitive=excluded.caffeine_sensitive,allergy_asteraceae=excluded.allergy_asteraceae,hormone_sensitive=excluded.hormone_sensitive,updated_at=now();
 return jsonb_build_object('status','saved');
end $$;
grant execute on function public.mt_phyto_save_profile(jsonb) to authenticated;

create or replace function public.mt_phyto_safety_check(p_plant text)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare u uuid:=auth.uid(); p public.mt_phyto_user_profile%rowtype; q text:=public.food_normalize(p_plant); matches jsonb; highest text;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into p from public.mt_phyto_user_profile where user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object('plant',r.display_name,'trigger',r.trigger_key,'severity',r.severity,'message',r.message) order by case r.severity when 'block_auto' then 1 when 'verify' then 2 else 3 end,r.id),'[]'::jsonb),
        min(case r.severity when 'block_auto' then '1_block_auto' when 'verify' then '2_verify' else '3_caution' end)
 into matches,highest
 from public.mt_phyto_rules r
 where r.enabled and (public.food_normalize(r.plant_key)=q or public.food_normalize(r.display_name)=q or exists(select 1 from unnest(r.aliases) a where public.food_normalize(a)=q))
 and case r.trigger_key
   when 'regular_medication' then coalesce(p.regular_medication,false)
   when 'anticoagulants' then coalesce(p.anticoagulants,false)
   when 'sedatives' then coalesce(p.sedatives,false)
   when 'hypertension' then coalesce(p.hypertension,false)
   when 'pregnancy' then coalesce(p.pregnancy,false)
   when 'breastfeeding' then coalesce(p.breastfeeding,false)
   when 'caffeine_sensitive' then coalesce(p.caffeine_sensitive,false)
   when 'allergy_asteraceae' then coalesce(p.allergy_asteraceae,false)
   when 'hormone_sensitive' then coalesce(p.hormone_sensitive,false)
   else false end;
 return jsonb_build_object('plant',p_plant,'status',case when highest like '1_%' then 'block_auto' when highest like '2_%' then 'verify' when highest like '3_%' then 'caution' else 'no_profile_flag_triggered' end,'headline',case when highest like '1_%' then 'Vérification nécessaire avant toute suggestion' when highest like '2_%' then 'Compatibilité à vérifier' when highest like '3_%' then 'Prudence recommandée' else 'Aucun garde-fou de ton profil n’a été déclenché' end,'matches',matches,'clearance',false);
end $$;
grant execute on function public.mt_phyto_safety_check(text) to authenticated;

-- ---------------------------------------------------------------------------
-- B. PLANIFICATEUR ADAPTATIF — préférences + catalogue existant
-- ---------------------------------------------------------------------------
create table if not exists public.mt_planner_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 pantry_terms text[] not null default '{}', excluded_terms text[] not null default '{}',
 weekly_budget_eur numeric, servings integer not null default 1 check(servings between 1 and 8),
 restaurant_day integer check(restaurant_day between 0 and 6), use_leftovers boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.mt_planner_preferences enable row level security;
drop policy if exists "planner owner" on public.mt_planner_preferences;
create policy "planner owner" on public.mt_planner_preferences for all to authenticated using(auth.uid()=user_id or public.is_admin()) with check(auth.uid()=user_id or public.is_admin());

create or replace function public.mt_planner_recipe_catalog()
returns table(recipe_id uuid,title text,subtitle text,meal_type text,mood text,ingredients text[])
language sql stable security definer set search_path=public as $$
 select r.id,r.title,r.subtitle,r.meal_type,r.mood,
   coalesce(array_agg(distinct i.ingredient_name) filter(where nullif(btrim(i.ingredient_name),'') is not null),'{}'::text[])
 from public.recipes r
 left join public.recipe_nutrition_items i on i.recipe_id=r.id and i.included_in_reference=true
 where r.active=true and (coalesce(r.is_premium,false)=false or public.mt_recipe_access_allowed(r.id))
 group by r.id,r.title,r.subtitle,r.meal_type,r.mood,r.sort_order
 order by r.sort_order,r.title
 limit 500;
$$;
revoke all on function public.mt_planner_recipe_catalog() from public,anon;
grant execute on function public.mt_planner_recipe_catalog() to authenticated;

-- ---------------------------------------------------------------------------
-- E. INTERNATIONALISATION — préférences + champs de catalogue futurs
-- ---------------------------------------------------------------------------
create table if not exists public.mt_locale_preferences(user_id uuid primary key references auth.users(id) on delete cascade,locale text not null default 'fr-FR',region text not null default 'FR',food_locale text not null default 'fr-FR',updated_at timestamptz not null default now());
alter table public.mt_locale_preferences enable row level security;drop policy if exists "locale owner" on public.mt_locale_preferences;create policy "locale owner" on public.mt_locale_preferences for all to authenticated using(auth.uid()=user_id or public.is_admin()) with check(auth.uid()=user_id or public.is_admin());
alter table public.food_dictionary add column if not exists localized_names jsonb not null default '{}'::jsonb;alter table public.food_dictionary add column if not exists localized_aliases jsonb not null default '{}'::jsonb;alter table public.food_dictionary add column if not exists source_region text;

-- ---------------------------------------------------------------------------
-- F. QA / SCALABILITÉ — invisible pour l'utilisatrice, sans télémétrie payante
-- ---------------------------------------------------------------------------
create or replace function public.mt_v4871_healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'status','ok',
    'phyto_rules',(select count(*) from public.mt_phyto_rules where enabled),
    'planner_recipes',(select count(*) from public.recipes where active),
    'external_ai_api_required',false,
    'automatic_server_telemetry',false
  );
$$;
grant execute on function public.mt_v4871_healthcheck() to authenticated;

commit;



-- ===========================================================================
-- MÉTHODE TEE — V487.2 · COUCHE PRIX RNM + PRIX ADMINISTRÉS
-- Additif, sans API runtime. On stocke uniquement les références utiles/courantes,
-- pas tout l'historique RNM : coût Supabase faible et prévisible.
-- ===========================================================================
begin;

create table if not exists public.mt_price_sources(
  code text primary key,
  label text not null,
  source_kind text not null check(source_kind in('official_public','manual','future_public')),
  license_label text,
  attribution text,
  source_url text,
  country_code text not null default 'FR',
  market_stage text,
  priority integer not null default 100,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.mt_price_sources enable row level security;
drop policy if exists "price sources read" on public.mt_price_sources;
create policy "price sources read" on public.mt_price_sources for select to authenticated using(enabled or public.is_admin());
drop policy if exists "price sources admin" on public.mt_price_sources;
create policy "price sources admin" on public.mt_price_sources for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.mt_price_sources(code,label,source_kind,license_label,attribution,source_url,country_code,market_stage,priority,enabled) values
('TEE_ADMIN','Méthode TEE · prix administré','manual','Donnée administrée Méthode TEE','Méthode TEE',null,'FR','detail',10,true),
('RNM_DETAIL_FR','RNM FranceAgriMer · stade détail','official_public','Licence Ouverte / Open Licence 2.0','FranceAgriMer — Réseau des Nouvelles des Marchés','https://rnm.franceagrimer.fr/','FR','detail',20,true)
on conflict(code) do update set
 label=excluded.label,source_kind=excluded.source_kind,license_label=excluded.license_label,
 attribution=excluded.attribution,source_url=excluded.source_url,country_code=excluded.country_code,
 market_stage=excluded.market_stage,priority=excluded.priority,enabled=true,updated_at=now();

create table if not exists public.mt_food_price_reference(
  id uuid primary key default gen_random_uuid(),
  source_code text not null references public.mt_price_sources(code) on delete restrict,
  food_dictionary_id uuid references public.food_dictionary(id) on delete cascade,
  ciqual_code text,
  match_term text,
  source_item_key text not null,
  source_item_label text not null,
  country_code text not null default 'FR',
  region_code text,
  price_eur numeric not null check(price_eur>0),
  price_basis text not null check(price_basis in('kg','100g','l','100ml','unit','package')),
  eur_per_kg numeric,
  eur_per_l numeric,
  unit_price_eur numeric,
  unit_weight_g numeric,
  density_g_ml numeric,
  observed_on date not null default current_date,
  confidence text not null default 'reference' check(confidence in('official_detail','manual_verified','manual_estimate','reference')),
  verified boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  check(food_dictionary_id is not null or nullif(btrim(ciqual_code),'') is not null or nullif(btrim(match_term),'') is not null)
);
create index if not exists mt_food_price_dictionary_idx on public.mt_food_price_reference(food_dictionary_id,country_code,observed_on desc);
create index if not exists mt_food_price_ciqual_idx on public.mt_food_price_reference(ciqual_code,country_code,observed_on desc);
create index if not exists mt_food_price_term_idx on public.mt_food_price_reference(match_term,country_code,observed_on desc);
create index if not exists mt_food_price_source_idx on public.mt_food_price_reference(source_code,country_code,observed_on desc);

alter table public.mt_food_price_reference enable row level security;
drop policy if exists "food price admin" on public.mt_food_price_reference;
create policy "food price admin" on public.mt_food_price_reference for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Administration simple : on pourra utiliser cette RPC via SQL pour RNM ou les cas
-- culturels/manquants. Aucun prix n'est inventé automatiquement.
create or replace function public.mt_admin_upsert_food_price_v1(
  p_source_code text,
  p_source_item_label text,
  p_price_eur numeric,
  p_price_basis text,
  p_food_dictionary_id uuid default null,
  p_ciqual_code text default null,
  p_match_term text default null,
  p_country_code text default 'FR',
  p_region_code text default null,
  p_observed_on date default current_date,
  p_unit_weight_g numeric default null,
  p_density_g_ml numeric default null,
  p_verified boolean default true,
  p_confidence text default 'manual_verified',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_basis text:=lower(trim(coalesce(p_price_basis,'')));
  v_key text:=public.food_normalize(coalesce(p_source_item_label,''));
  v_match text:=nullif(public.food_normalize(coalesce(p_match_term,'')),'');
  v_kg numeric:=null;
  v_l numeric:=null;
  v_unit numeric:=null;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if not exists(select 1 from public.mt_price_sources where code=p_source_code and enabled) then
    raise exception 'Source prix inconnue : %',p_source_code;
  end if;
  if coalesce(p_price_eur,0)<=0 then raise exception 'Prix invalide'; end if;
  if v_basis not in ('kg','100g','l','100ml','unit','package') then raise exception 'Base prix invalide'; end if;
  if p_food_dictionary_id is null and nullif(btrim(p_ciqual_code),'') is null and v_match is null then
    raise exception 'Relie ce prix à food_dictionary, CIQUAL ou un terme';
  end if;

  if v_basis='kg' then v_kg:=p_price_eur;
  elsif v_basis='100g' then v_kg:=p_price_eur*10;
  elsif v_basis='l' then
    v_l:=p_price_eur;
    if coalesce(p_density_g_ml,0)>0 then v_kg:=p_price_eur/p_density_g_ml; end if;
  elsif v_basis='100ml' then
    v_l:=p_price_eur*10;
    if coalesce(p_density_g_ml,0)>0 then v_kg:=v_l/p_density_g_ml; end if;
  else
    v_unit:=p_price_eur;
    if coalesce(p_unit_weight_g,0)>0 then v_kg:=p_price_eur*1000/p_unit_weight_g; end if;
  end if;

  select id into v_id
  from public.mt_food_price_reference
  where source_code=p_source_code
    and country_code=upper(coalesce(nullif(trim(p_country_code),''),'FR'))
    and coalesce(region_code,'')=coalesce(nullif(trim(p_region_code),'') ,'')
    and source_item_key=v_key
    and coalesce(food_dictionary_id::text,'')=coalesce(p_food_dictionary_id::text,'')
    and coalesce(ciqual_code,'')=coalesce(nullif(btrim(p_ciqual_code),'') ,'')
    and coalesce(match_term,'')=coalesce(v_match,'')
  order by observed_on desc,updated_at desc
  limit 1;

  if v_id is null then
    insert into public.mt_food_price_reference(
      source_code,food_dictionary_id,ciqual_code,match_term,source_item_key,source_item_label,
      country_code,region_code,price_eur,price_basis,eur_per_kg,eur_per_l,unit_price_eur,
      unit_weight_g,density_g_ml,observed_on,confidence,verified,note,updated_at
    ) values(
      p_source_code,p_food_dictionary_id,nullif(btrim(p_ciqual_code),''),v_match,v_key,p_source_item_label,
      upper(coalesce(nullif(trim(p_country_code),''),'FR')),nullif(trim(p_region_code),''),
      p_price_eur,v_basis,v_kg,v_l,v_unit,p_unit_weight_g,p_density_g_ml,
      coalesce(p_observed_on,current_date),coalesce(nullif(p_confidence,''),'reference'),coalesce(p_verified,false),p_note,now()
    ) returning id into v_id;
  else
    update public.mt_food_price_reference set
      source_item_label=p_source_item_label,price_eur=p_price_eur,price_basis=v_basis,
      eur_per_kg=v_kg,eur_per_l=v_l,unit_price_eur=v_unit,unit_weight_g=p_unit_weight_g,
      density_g_ml=p_density_g_ml,observed_on=coalesce(p_observed_on,current_date),
      confidence=coalesce(nullif(p_confidence,''),'reference'),verified=coalesce(p_verified,false),
      note=p_note,updated_at=now()
    where id=v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.mt_admin_upsert_food_price_v1(text,text,numeric,text,uuid,text,text,text,text,date,numeric,numeric,boolean,text,text) from public,anon;
grant execute on function public.mt_admin_upsert_food_price_v1(text,text,numeric,text,uuid,text,text,text,text,date,numeric,numeric,boolean,text,text) to authenticated;

create or replace function public.mt_food_price_resolve_v1(
  p_dictionary_id uuid default null,
  p_ciqual_code text default null,
  p_term text default null,
  p_country text default 'FR',
  p_region text default null
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with c as (
    select
      p.*,s.label source_label,s.attribution,s.license_label,s.priority source_priority,
      case
        when p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id then 1
        when nullif(btrim(p_ciqual_code),'') is not null and p.ciqual_code=p_ciqual_code then 2
        when nullif(public.food_normalize(coalesce(p_term,'')),'') is not null
             and p.match_term=public.food_normalize(p_term) then 3
        else 9
      end match_rank,
      case
        when nullif(btrim(p_region),'') is not null and p.region_code=p_region then 1
        when p.region_code is null then 2
        else 3
      end region_rank
    from public.mt_food_price_reference p
    join public.mt_price_sources s on s.code=p.source_code and s.enabled
    where p.country_code=upper(coalesce(nullif(trim(p_country),''),'FR'))
      and (
        (p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id)
        or (nullif(btrim(p_ciqual_code),'') is not null and p.ciqual_code=p_ciqual_code)
        or (nullif(public.food_normalize(coalesce(p_term,'')),'') is not null and p.match_term=public.food_normalize(p_term))
      )
  ), best as (
    select * from c
    order by match_rank,region_rank,verified desc,source_priority,observed_on desc,updated_at desc
    limit 1
  )
  select case when exists(select 1 from best) then (
    select jsonb_strip_nulls(jsonb_build_object(
      'reference_id',id,'source_code',source_code,'source_label',source_label,
      'attribution',attribution,'license',license_label,'source_item_label',source_item_label,
      'country_code',country_code,'region_code',region_code,'observed_on',observed_on,
      'age_days',(current_date-observed_on),'stale',(current_date-observed_on)>120,
      'confidence',confidence,'verified',verified,'price_eur',price_eur,'price_basis',price_basis,
      'eur_per_kg',eur_per_kg,'eur_per_l',eur_per_l,'unit_price_eur',unit_price_eur,
      'match_rank',match_rank
    )) from best
  ) else null end;
$$;
revoke all on function public.mt_food_price_resolve_v1(uuid,text,text,text,text) from public,anon;
grant execute on function public.mt_food_price_resolve_v1(uuid,text,text,text,text) to authenticated;

create or replace function public.mt_price_quote_terms_v1(
  p_terms text[],
  p_country text default 'FR',
  p_region text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  t text;
  h_dictionary_id uuid;
  h_code text;
  h_name text;
  pr jsonb;
  out_json jsonb:='[]'::jsonb;
begin
  foreach t in array coalesce(p_terms,'{}'::text[]) loop
    if nullif(btrim(t),'') is null then continue; end if;
    h_dictionary_id:=null;h_code:=null;h_name:=null;
    select f.dictionary_id,f.code,coalesce(f.display_name,f.name)
      into h_dictionary_id,h_code,h_name
    from public.search_foods_v4(t,5) f
    order by f.match_rank
    limit 1;
    pr:=public.mt_food_price_resolve_v1(h_dictionary_id,h_code,t,p_country,p_region);
    out_json:=out_json||jsonb_build_array(jsonb_build_object(
      'term',t,'food_name',coalesce(h_name,t),
      'dictionary_id',h_dictionary_id,'ciqual_code',h_code,'price',pr
    ));
  end loop;
  return out_json;
end;
$$;
revoke all on function public.mt_price_quote_terms_v1(text[],text,text) from public,anon;
grant execute on function public.mt_price_quote_terms_v1(text[],text,text) to authenticated;

create or replace function public.mt_recipe_cost_estimate_v1(
  p_recipe_id uuid,
  p_servings numeric default 1,
  p_country text default 'FR',
  p_region text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  profile_servings numeric;
  out_json jsonb;
begin
  if not public.mt_recipe_access_allowed(p_recipe_id) then return null; end if;
  select servings into profile_servings from public.recipe_nutrition_profiles where recipe_id=p_recipe_id;
  if coalesce(profile_servings,0)<=0 then
    return jsonb_build_object('recipe_id',p_recipe_id,'status','unstructured','items','[]'::jsonb,'coverage_pct',0);
  end if;

  with base as (
    select
      i.id,i.ingredient_name,i.ciqual_code,i.food_dictionary_id,
      (i.quantity_g/profile_servings*greatest(coalesce(p_servings,1),0.01))::numeric quantity_g
    from public.recipe_nutrition_items i
    where i.recipe_id=p_recipe_id and i.included_in_reference=true
    order by i.sort_order,i.id
  ), priced as (
    select b.*,public.mt_food_price_resolve_v1(b.food_dictionary_id,b.ciqual_code,b.ingredient_name,p_country,p_region) price
    from base b
  ), calc as (
    select p.*,
      case
        when nullif(p.price->>'eur_per_kg','') is not null
        then round(p.quantity_g/1000*(p.price->>'eur_per_kg')::numeric,4)
        else null::numeric
      end cost_eur
    from priced p
  )
  select jsonb_build_object(
    'recipe_id',p_recipe_id,'status','ok',
    'servings',p_servings,
    'total_estimated_eur',round(coalesce(sum(cost_eur),0),2),
    'total_items',count(*)::int,
    'priced_items',count(cost_eur)::int,
    'coverage_pct',case when count(*)=0 then 0 else round(count(cost_eur)::numeric/count(*)*100)::int end,
    'complete',(count(*)>0 and count(cost_eur)=count(*)),
    'items',coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'ingredient_name',ingredient_name,'dictionary_id',food_dictionary_id,'ciqual_code',ciqual_code,
      'quantity_g',round(quantity_g,2),'cost_eur',round(cost_eur,2),
      'source_label',price->>'source_label','source_code',price->>'source_code',
      'observed_on',price->>'observed_on','eur_per_kg',price->>'eur_per_kg'
    )) order by id),'[]'::jsonb)
  ) into out_json
  from calc;
  return out_json;
end;
$$;
revoke all on function public.mt_recipe_cost_estimate_v1(uuid,numeric,text,text) from public,anon;
grant execute on function public.mt_recipe_cost_estimate_v1(uuid,numeric,text,text) to authenticated;

create or replace function public.mt_recipe_cost_batch_v1(
  p_recipe_ids uuid[],
  p_servings numeric default 1,
  p_country text default 'FR',
  p_region text default null
)
returns table(recipe_id uuid,cost jsonb)
language sql
stable
security definer
set search_path=public
as $$
  select x.recipe_id,public.mt_recipe_cost_estimate_v1(x.recipe_id,p_servings,p_country,p_region)
  from (
    select u.recipe_id,u.ord
    from unnest(coalesce(p_recipe_ids,'{}'::uuid[])) with ordinality u(recipe_id,ord)
    where u.ord<=60
  ) x
  order by x.ord;
$$;
revoke all on function public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text) from public,anon;
grant execute on function public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text) to authenticated;

create or replace function public.mt_price_status_v1()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'price_reference_count',(select count(*) from public.mt_food_price_reference),
    'rnm_reference_count',(select count(*) from public.mt_food_price_reference where source_code='RNM_DETAIL_FR'),
    'manual_reference_count',(select count(*) from public.mt_food_price_reference where source_code='TEE_ADMIN'),
    'priced_dictionary_foods',(select count(distinct food_dictionary_id) from public.mt_food_price_reference where food_dictionary_id is not null),
    'latest_observed_on',(select max(observed_on) from public.mt_food_price_reference),
    'runtime_external_price_api',false
  );
$$;
revoke all on function public.mt_price_status_v1() from public,anon;
grant execute on function public.mt_price_status_v1() to authenticated;

create or replace function public.mt_v4872_healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'status','ok',
    'phyto_rules',(select count(*) from public.mt_phyto_rules where enabled),
    'planner_recipes',(select count(*) from public.recipes where active),
    'price_sources',(select count(*) from public.mt_price_sources where enabled),
    'price_references',(select count(*) from public.mt_food_price_reference),
    'rnm_source_ready',exists(select 1 from public.mt_price_sources where code='RNM_DETAIL_FR' and enabled),
    'external_ai_api_required',false,
    'runtime_external_price_api',false,
    'automatic_server_telemetry',false
  );
$$;
grant execute on function public.mt_v4872_healthcheck() to authenticated;

commit;



-- ===========================================================================
-- V487.3 · SÉCURITÉ PHYTO INVISIBLE À L'ÉCHELLE DE L'APP
-- ===========================================================================
begin;

create or replace function public.mt_phyto_active_rules_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  p public.mt_phyto_user_profile%rowtype;
  out_json jsonb;
begin
  if u is null then return '[]'::jsonb; end if;
  select * into p from public.mt_phyto_user_profile where user_id=u;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'plant_key',r.plant_key,'display_name',r.display_name,'aliases',r.aliases,
      'trigger_key',r.trigger_key,'severity',r.severity,'message',r.message
    )
    order by case r.severity when 'block_auto' then 1 when 'verify' then 2 else 3 end,r.id
  ),'[]'::jsonb)
  into out_json
  from public.mt_phyto_rules r
  where r.enabled
    and case r.trigger_key
      when 'regular_medication' then coalesce(p.regular_medication,false)
      when 'anticoagulants' then coalesce(p.anticoagulants,false)
      when 'sedatives' then coalesce(p.sedatives,false)
      when 'hypertension' then coalesce(p.hypertension,false)
      when 'pregnancy' then coalesce(p.pregnancy,false)
      when 'breastfeeding' then coalesce(p.breastfeeding,false)
      when 'caffeine_sensitive' then coalesce(p.caffeine_sensitive,false)
      when 'allergy_asteraceae' then coalesce(p.allergy_asteraceae,false)
      when 'hormone_sensitive' then coalesce(p.hormone_sensitive,false)
      else false
    end;

  return out_json;
end;
$$;
grant execute on function public.mt_phyto_active_rules_v1() to authenticated;

create or replace function public.mt_phyto_safety_check_text_v1(p_text text)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  q text:=' '||public.food_normalize(coalesce(p_text,''))||' ';
  rules jsonb:=public.mt_phyto_active_rules_v1();
  out_json jsonb:='[]'::jsonb;
  r jsonb;
  term text;
  terms text[];
  matched boolean;
  highest integer:=0;
begin
  if nullif(btrim(coalesce(p_text,'')),'') is null then
    return jsonb_build_object('status','clear','matches','[]'::jsonb,'highest_severity',null);
  end if;

  for r in select value from jsonb_array_elements(coalesce(rules,'[]'::jsonb))
  loop
    terms:=array[r->>'plant_key',r->>'display_name'];
    if jsonb_typeof(r->'aliases')='array' then
      terms:=terms||array(select jsonb_array_elements_text(r->'aliases'));
    end if;
    matched:=false;
    foreach term in array terms loop
      if nullif(public.food_normalize(coalesce(term,'')),'') is not null
         and position(' '||public.food_normalize(term)||' ' in q)>0 then
        matched:=true; exit;
      end if;
    end loop;
    if matched then
      out_json:=out_json||jsonb_build_array(r);
      highest:=greatest(highest,case r->>'severity' when 'block_auto' then 3 when 'verify' then 2 when 'caution' then 1 else 0 end);
    end if;
  end loop;

  return jsonb_build_object(
    'status',case highest when 3 then 'block_auto' when 2 then 'verify' when 1 then 'caution' else 'clear' end,
    'highest_severity',case highest when 3 then 'block_auto' when 2 then 'verify' when 1 then 'caution' else null end,
    'matches',out_json,'clearance',false
  );
end;
$$;
grant execute on function public.mt_phyto_safety_check_text_v1(text) to authenticated;

create or replace function public.mt_v4873_healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'status','ok',
    'phyto_rules',(select count(*) from public.mt_phyto_rules where enabled),
    'phyto_active_rules_rpc',to_regprocedure('public.mt_phyto_active_rules_v1()') is not null,
    'phyto_text_guard_rpc',to_regprocedure('public.mt_phyto_safety_check_text_v1(text)') is not null,
    'planner_recipes',(select count(*) from public.recipes where active),
    'price_sources',(select count(*) from public.mt_price_sources where enabled),
    'price_references',(select count(*) from public.mt_food_price_reference),
    'rnm_source_ready',exists(select 1 from public.mt_price_sources where code='RNM_DETAIL_FR' and enabled),
    'external_ai_api_required',false,
    'runtime_external_price_api',false,
    'automatic_server_telemetry',false
  );
$$;
grant execute on function public.mt_v4873_healthcheck() to authenticated;

commit;
