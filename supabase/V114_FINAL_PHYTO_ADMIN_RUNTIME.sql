-- MÉTHODE TEE — 1.1.4 FINAL : PHYTO + ADMIN VIVANT
begin;

create or replace function public.mt_botanical_high_safety_guard_v1()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.caution_level='high' then new.composer_enabled:=false; end if;
  new.updated_at:=now(); return new;
end; $$;
drop trigger if exists mt_botanical_high_safety_guard_v1 on public.botanical_ingredients;
create trigger mt_botanical_high_safety_guard_v1 before insert or update of caution_level,composer_enabled,caution_text,enabled on public.botanical_ingredients for each row execute function public.mt_botanical_high_safety_guard_v1();
update public.botanical_ingredients set composer_enabled=false,updated_at=now() where caution_level='high' and composer_enabled=true;

create or replace function public.mt_phyto_active_rules_v2()
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare u uuid:=auth.uid(); p public.mt_phyto_user_profile%rowtype; out_json jsonb;
begin
  if u is null then return '[]'::jsonb; end if;
  select * into p from public.mt_phyto_user_profile where user_id=u;
  with catalog_rules as (
    select 0::bigint ord,i.normalized_name plant_key,i.display_name,i.latin_name,
      array_remove(array_cat(coalesce(i.aliases,'{}'::text[]),array[i.canonical_name,i.latin_name]),null) aliases,
      'catalog'::text trigger_key,case i.caution_level when 'high' then 'block_auto' else 'caution' end severity,
      coalesce(nullif(btrim(i.caution_text),''),case i.caution_level when 'high' then 'Cette plante nécessite une vérification avant utilisation et n’est jamais proposée automatiquement.' else 'Une précaution est associée à cette plante. Vérifie qu’elle convient à ta situation.' end) message,
      'catalog'::text source,i.caution_level
    from public.botanical_ingredients i where i.enabled and i.caution_level in('notice','high')
  ), profile_rules as (
    select r.id ord,r.plant_key,r.display_name,null::text latin_name,r.aliases,r.trigger_key,r.severity,r.message,'profile'::text source,null::text caution_level
    from public.mt_phyto_rules r where r.enabled and case r.trigger_key
      when 'regular_medication' then coalesce(p.regular_medication,false)
      when 'anticoagulants' then coalesce(p.anticoagulants,false)
      when 'sedatives' then coalesce(p.sedatives,false)
      when 'hypertension' then coalesce(p.hypertension,false)
      when 'pregnancy' then coalesce(p.pregnancy,false)
      when 'breastfeeding' then coalesce(p.breastfeeding,false)
      when 'caffeine_sensitive' then coalesce(p.caffeine_sensitive,false)
      when 'allergy_asteraceae' then coalesce(p.allergy_asteraceae,false)
      when 'hormone_sensitive' then coalesce(p.hormone_sensitive,false) else false end
  ), all_rules as (select * from catalog_rules union all select * from profile_rules)
  select coalesce(jsonb_agg(jsonb_build_object('plant_key',plant_key,'display_name',display_name,'latin_name',latin_name,'aliases',aliases,'trigger_key',trigger_key,'severity',severity,'message',message,'source',source,'caution_level',caution_level) order by case severity when 'block_auto' then 1 when 'verify' then 2 else 3 end,display_name,ord),'[]'::jsonb) into out_json from all_rules;
  return out_json;
end; $$;
revoke all on function public.mt_phyto_active_rules_v2() from public,anon;
grant execute on function public.mt_phyto_active_rules_v2() to authenticated;

create table if not exists public.mt_admin_formula_voice_v1(
  formula_id text primary key,configured_enabled boolean not null default false,active boolean not null default false,
  dictionary_id uuid references public.food_dictionary(id) on delete set null,ciqual_code text,display_name text,aliases text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check(not configured_enabled or dictionary_id is not null or nullif(btrim(ciqual_code),'') is not null)
);
alter table public.mt_admin_formula_voice_v1 enable row level security;
drop policy if exists "formula voice admin" on public.mt_admin_formula_voice_v1;
create policy "formula voice admin" on public.mt_admin_formula_voice_v1 for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "formula voice active read" on public.mt_admin_formula_voice_v1;
create policy "formula voice active read" on public.mt_admin_formula_voice_v1 for select to authenticated using(active or public.is_admin());

create or replace function public.mt_admin_save_formula_voice_v1(p_formula_id text,p_payload jsonb,p_mode text default 'draft')
returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg boolean:=coalesce((p_payload->>'configured_enabled')::boolean,false); formula_enabled boolean:=coalesce((p_payload->>'formula_enabled')::boolean,true);
dict_id uuid:=nullif(p_payload->>'dictionary_id','')::uuid; code text:=nullif(btrim(p_payload->>'ciqual_code'),''); dname text:=nullif(btrim(p_payload->>'display_name'),'');
a text[]:=coalesce(array(select distinct btrim(value) from jsonb_array_elements_text(coalesce(p_payload->'aliases','[]'::jsonb)) where nullif(btrim(value),'') is not null),'{}'::text[]);
old_active boolean:=false;new_active boolean;
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
  if nullif(btrim(coalesce(p_formula_id,'')),'') is null then raise exception 'formula_id requis'; end if;
  select active into old_active from public.mt_admin_formula_voice_v1 where formula_id=p_formula_id; old_active:=coalesce(old_active,false);
  if cfg then
    if dict_id is null and code is null then raise exception 'Choisis une vraie fiche alimentaire pour Voice'; end if;
    if cardinality(a)=0 then raise exception 'Ajoute au moins un alias Voice'; end if;
    if dict_id is not null and not exists(select 1 from public.food_dictionary where id=dict_id and enabled) then raise exception 'La fiche TEE choisie est introuvable ou désactivée'; end if;
    if dict_id is null and code is not null and not exists(select 1 from public.ciqual_foods where code=code) then raise exception 'La référence alimentaire choisie est introuvable'; end if;
  end if;
  new_active:=case lower(coalesce(p_mode,'draft')) when 'publish' then cfg and formula_enabled when 'unpublish' then false else old_active end;
  insert into public.mt_admin_formula_voice_v1(formula_id,configured_enabled,active,dictionary_id,ciqual_code,display_name,aliases,updated_at)
  values(p_formula_id,cfg,new_active,dict_id,code,dname,a,now())
  on conflict(formula_id) do update set configured_enabled=excluded.configured_enabled,active=excluded.active,dictionary_id=excluded.dictionary_id,ciqual_code=excluded.ciqual_code,display_name=excluded.display_name,aliases=excluded.aliases,updated_at=now();
  return jsonb_build_object('formula_id',p_formula_id,'configured_enabled',cfg,'active',new_active,'dictionary_id',dict_id,'ciqual_code',code,'display_name',dname,'aliases',to_jsonb(a));
end; $$;

create or replace function public.mt_admin_get_formula_voice_v1(p_formula_id text)
returns jsonb language sql stable security definer set search_path=public as $$
select case when not public.is_admin() then '{}'::jsonb else coalesce((select jsonb_build_object('formula_id',v.formula_id,'configured_enabled',v.configured_enabled,'active',v.active,'dictionary_id',v.dictionary_id,'ciqual_code',v.ciqual_code,'display_name',v.display_name,'aliases',to_jsonb(v.aliases)) from public.mt_admin_formula_voice_v1 v where v.formula_id=p_formula_id),'{}'::jsonb) end; $$;

create or replace function public.mt_admin_deactivate_formula_voice_v1(p_formula_id text)
returns boolean language plpgsql security definer set search_path=public as $$
begin if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;update public.mt_admin_formula_voice_v1 set active=false,updated_at=now() where formula_id=p_formula_id;return true;end; $$;

revoke all on function public.mt_admin_save_formula_voice_v1(text,jsonb,text) from public,anon;
revoke all on function public.mt_admin_get_formula_voice_v1(text) from public,anon;
revoke all on function public.mt_admin_deactivate_formula_voice_v1(text) from public,anon;
grant execute on function public.mt_admin_save_formula_voice_v1(text,jsonb,text) to authenticated;
grant execute on function public.mt_admin_get_formula_voice_v1(text) to authenticated;
grant execute on function public.mt_admin_deactivate_formula_voice_v1(text) to authenticated;

create or replace function public.resolve_voice_named_compound_v1(p_phrase text,p_limit integer default 10)
returns table(dictionary_id uuid,code text,name text,display_name text,country text,categories text[],adapter_profile jsonb,family text,phrase_source text,match_rank integer)
language sql stable security invoker set search_path=public as $$
with q as (select public.food_normalize(p_phrase) strict_key,public.mt_voice_compound_loose_key_v1(p_phrase) loose_key),
base_hits as (
 select v.dictionary_id,v.ciqual_code code,v.canonical_name name,v.display_name,v.country,v.categories,v.adapter_profile,v.family,v.phrase_source,
 case when v.phrase_key=q.strict_key then 1 when v.loose_key=q.loose_key then 2 else 9 end r,
 case when v.source_kind='dictionary' then 0 else 1 end source_rank,v.priority
 from public.mt_voice_named_compounds_v1 v cross join q
 where length(q.strict_key)>=3 and (v.phrase_key=q.strict_key or v.loose_key=q.loose_key)
), admin_phrases as (
 select v.*,a alias,public.food_normalize(a) phrase_key,public.mt_voice_compound_loose_key_v1(a) loose_key
 from public.mt_admin_formula_voice_v1 v cross join lateral unnest(v.aliases) a where v.active
), admin_hits as (
 select coalesce(d.id,v.dictionary_id) dictionary_id,coalesce(d.ciqual_code,c.code,v.ciqual_code) code,
 coalesce(d.canonical_name,c.name,v.display_name) name,coalesce(d.display_name,c.name,v.display_name) display_name,d.country,
 coalesce(d.categories,'{}'::text[]) categories,coalesce(d.adapter_profile,'{}'::jsonb) adapter_profile,
 'admin_formula'::text family,'admin_formula'::text phrase_source,case when v.phrase_key=q.strict_key then 0 else 1 end r,-1 source_rank,coalesce(d.priority,0) priority
 from admin_phrases v cross join q left join public.food_dictionary d on d.id=v.dictionary_id and d.enabled left join public.ciqual_foods c on c.code=v.ciqual_code
 where length(q.strict_key)>=3 and (v.phrase_key=q.strict_key or v.loose_key=q.loose_key) and (d.id is not null or c.code is not null)
), all_hits as (select * from admin_hits union all select * from base_hits),
ranked as (select h.*,row_number() over(partition by coalesce(h.dictionary_id::text,'code:'||coalesce(h.code,'')) order by h.r,h.source_rank,h.priority,h.display_name) rn from all_hits h)
select h.dictionary_id,h.code,h.name,h.display_name,h.country,h.categories,h.adapter_profile,h.family,h.phrase_source,h.r::integer
from ranked h where h.rn=1 order by h.r,h.source_rank,h.priority,h.display_name limit greatest(1,least(coalesce(p_limit,10),20)); $$;
revoke all on function public.resolve_voice_named_compound_v1(text,integer) from public,anon;
grant execute on function public.resolve_voice_named_compound_v1(text,integer) to authenticated;

commit;

select jsonb_pretty(jsonb_build_object(
 'status','TEE_1_1_4_FINAL_PHYTO_ADMIN_RUNTIME_INSTALLED',
 'phyto',jsonb_build_object('v2_rpc',to_regprocedure('public.mt_phyto_active_rules_v2()') is not null,'catalog_notice_or_high',(select count(*) from public.botanical_ingredients where enabled and caution_level in('notice','high')),'high_still_auto_suggestable',(select count(*) from public.botanical_ingredients where enabled and caution_level='high' and composer_enabled),'high_missing_custom_text',(select count(*) from public.botanical_ingredients where enabled and caution_level='high' and nullif(btrim(coalesce(caution_text,'')),'') is null),'notice_missing_custom_text',(select count(*) from public.botanical_ingredients where enabled and caution_level='notice' and nullif(btrim(coalesce(caution_text,'')),'') is null)),
 'admin_runtime',jsonb_build_object('formula_voice_table',to_regclass('public.mt_admin_formula_voice_v1') is not null,'save_rpc',to_regprocedure('public.mt_admin_save_formula_voice_v1(text,jsonb,text)') is not null,'get_rpc',to_regprocedure('public.mt_admin_get_formula_voice_v1(text)') is not null,'deactivate_rpc',to_regprocedure('public.mt_admin_deactivate_formula_voice_v1(text)') is not null,'voice_resolver',to_regprocedure('public.resolve_voice_named_compound_v1(text,integer)') is not null,'active_admin_voice_aliases',(select coalesce(sum(cardinality(aliases)),0) from public.mt_admin_formula_voice_v1 where active)),
 'safety',jsonb_build_object('high_never_auto_suggested',(select count(*)=0 from public.botanical_ingredients where enabled and caution_level='high' and composer_enabled),'formula_voice_requires_real_food_identity',true,'formula_voice_exact_alias_only',true,'food_dictionary_remains_server_driven',true,'adapter_formulas_remain_server_driven',true,'botanical_catalog_server_driven',true),
 'github_change_required',true,'target_app_version','1.1.4','target_build',47
)) as tee_1_1_4_final_audit;
