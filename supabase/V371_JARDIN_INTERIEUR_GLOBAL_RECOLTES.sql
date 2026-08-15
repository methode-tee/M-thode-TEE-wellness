-- V371 — TON JARDIN INTÉRIEUR · progression globale + vraies récoltes
-- À exécuter UNE FOIS dans Supabase SQL Editor AVANT de tester le patch V371.
--
-- IMPORTANT : ce patch ne modifie AUCUNE animation du Jardin.
-- Il remplace uniquement la logique de progression, de niveaux et de récompenses.

begin;

-- 1) Niveaux du Jardin : Semence → Racines → Pousse → Feuillage → Floraison → Alchimiste
alter table public.member_profiles
  add column if not exists garden_claimed_rewards jsonb not null default '[]'::jsonb;

create or replace function public.mt_normalize_member_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare p integer;
begin
  if public.mt_request_is_trusted_writer() then return new; end if;
  p := greatest(0, coalesce(new.points,0));
  new.points := p;
  if p < 250 then
    new.level := 'semence'; new.level_label := 'Semence'; new.badge := '🌱';
  elsif p < 500 then
    new.level := 'racines'; new.level_label := 'Racines'; new.badge := '🌱';
  elsif p < 1500 then
    new.level := 'pousse'; new.level_label := 'Pousse'; new.badge := '🌿';
  elsif p < 4000 then
    new.level := 'feuillage'; new.level_label := 'Feuillage'; new.badge := '🌿';
  elsif p < 8000 then
    new.level := 'floraison'; new.level_label := 'Floraison'; new.badge := '🌸';
  else
    new.level := 'alchimiste'; new.level_label := 'Alchimiste'; new.badge := '✶';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mt_normalize_member_level on public.member_profiles;
create trigger trg_mt_normalize_member_level
before insert or update on public.member_profiles
for each row execute function public.mt_normalize_member_level();

-- Recalcule immédiatement les libellés existants sans modifier les XP.
-- SQL Editor est un writer de confiance : on écrit donc explicitement les champs.
update public.member_profiles
set points=greatest(0,coalesce(points,0)),
    level=case when coalesce(points,0)<250 then 'semence' when points<500 then 'racines' when points<1500 then 'pousse' when points<4000 then 'feuillage' when points<8000 then 'floraison' else 'alchimiste' end,
    level_label=case when coalesce(points,0)<250 then 'Semence' when points<500 then 'Racines' when points<1500 then 'Pousse' when points<4000 then 'Feuillage' when points<8000 then 'Floraison' else 'Alchimiste' end,
    badge=case when coalesce(points,0)<250 then '🌱' when points<500 then '🌱' when points<1500 then '🌿' when points<4000 then '🌿' when points<8000 then '🌸' else '✶' end,
    updated_at=now();

-- 2) Ledger XP : chaque geste ne peut créditer qu'une seule fois la même récompense XP.
create table if not exists public.garden_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  event_ref text not null,
  event_date date null,
  points integer not null check (points > 0 and points <= 500),
  created_at timestamptz not null default now(),
  unique(user_id,event_key,event_ref)
);
create index if not exists garden_xp_events_user_date_idx
  on public.garden_xp_events(user_id,event_date desc);
alter table public.garden_xp_events enable row level security;
drop policy if exists "garden_xp_events read own" on public.garden_xp_events;
create policy "garden_xp_events read own" on public.garden_xp_events
for select to authenticated using (auth.uid()=user_id);
revoke insert,update,delete on public.garden_xp_events from authenticated;
grant select on public.garden_xp_events to authenticated;

create or replace function public.garden_record_xp(
  p_user uuid,
  p_event_key text,
  p_event_ref text,
  p_event_date date,
  p_points integer
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare inserted_count integer := 0;
begin
  if p_user is null or p_points is null or p_points <= 0 then return 0; end if;
  insert into public.garden_xp_events(user_id,event_key,event_ref,event_date,points)
  values(p_user,p_event_key,p_event_ref,p_event_date,least(500,p_points))
  on conflict(user_id,event_key,event_ref) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return 0; end if;

  insert into public.member_profiles(user_id,points)
  values(p_user,least(500,p_points))
  on conflict(user_id) do update
    set points = greatest(0,coalesce(public.member_profiles.points,0)) + excluded.points,
        updated_at = now();
  return least(500,p_points);
end;
$$;
revoke all on function public.garden_record_xp(uuid,text,text,date,integer) from public,authenticated;

-- 3) XP quotidiens globaux — valeurs fixes côté serveur, anti-farming.
create or replace function public.garden_award_daily(
  action_key text,
  target_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  pts integer := 0;
  ok boolean := false;
  total_items integer := 0;
  done_items integer := 0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if target_date < current_date-1 or target_date > current_date+1 then return 0; end if;

  case action_key
    when 'journal' then
      pts := 5;
      select exists(
        select 1 from public.daily_activity d
        where d.user_id=uid and d.activity_date=target_date and coalesce(d.has_journal,false)=true
      ) into ok;
    when 'hydration' then
      pts := 5;
      select exists(
        select 1 from public.daily_activity d
        where d.user_id=uid and d.activity_date=target_date and coalesce(d.hydration_liters,0)>=2
      ) into ok;
    when 'personal_tracker' then
      pts := 3;
      select exists(
        select 1 from public.user_tracker_entries t
        where t.user_id=uid and t.entry_date=target_date
      ) into ok;
    when 'community_journey' then
      pts := 5;
      select count(*) into total_items
      from public.community_journey_items i
      where i.journey_date=target_date and i.is_active=true and coalesce(i.status,'published')<>'archived';
      select count(*) into done_items
      from public.community_journey_completions c
      join public.community_journey_items i on i.id=c.journey_item_id
      where c.user_id=uid and c.journey_date=target_date and c.completed=true
        and i.journey_date=target_date and i.is_active=true and coalesce(i.status,'published')<>'archived';
      ok := total_items>0 and done_items>=total_items;
    else
      return 0;
  end case;

  if not ok then return 0; end if;
  return public.garden_record_xp(uid,'daily_'||action_key,target_date::text,target_date,pts);
end;
$$;
grant execute on function public.garden_award_daily(text,date) to authenticated;

-- 4) XP d'un contenu de protocole : respecte réellement xp_points de l'admin (fallback 5).
create or replace function public.garden_award_protocol_content(
  target_protocol uuid,
  target_content uuid
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); pts integer:=0; done boolean:=false;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select least(100,greatest(1,coalesce(nullif(c.xp_points,0),5)))
    into pts from public.protocol_contents c
    where c.id=target_content and c.protocol_id=target_protocol and c.active=true;
  if pts is null then return 0; end if;
  select exists(
    select 1 from public.protocol_progress p
    where p.user_id=uid and p.protocol_id=target_protocol
      and coalesce(p.completed_content,'[]'::jsonb) ? target_content::text
  ) into done;
  if not done then return 0; end if;
  return public.garden_record_xp(uid,'protocol_content',target_content::text,current_date,pts);
end;
$$;
grant execute on function public.garden_award_protocol_content(uuid,uuid) to authenticated;

-- 5) XP d'une journée de protocole + streak + fin réelle du protocole.
create or replace function public.garden_award_protocol_day(
  target_protocol uuid,
  target_date date
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  p public.protocol_progress%rowtype;
  awarded integer:=0;
  n integer:=0;
  completed_count integer:=0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from public.protocol_progress
   where user_id=uid and protocol_id=target_protocol limit 1;
  if not found then return 0; end if;
  if not (coalesce(p.completed_days,'[]'::jsonb) ? target_date::text) then return 0; end if;

  n := public.garden_record_xp(uid,'protocol_day',target_protocol::text||':'||target_date::text,target_date,10);
  awarded := awarded+n;

  if coalesce(p.streak,0)>0 and mod(p.streak,7)=0 then
    n := public.garden_record_xp(uid,'protocol_streak',target_protocol::text||':streak:'||p.streak::text,target_date,50);
    awarded := awarded+n;
  end if;

  select count(distinct value) into completed_count
  from jsonb_array_elements_text(coalesce(p.completed_days,'[]'::jsonb));
  if coalesce(p.certificate_unlocked,false)=true and completed_count>=greatest(1,coalesce(p.total_days,1)) then
    n := public.garden_record_xp(uid,'protocol_complete',target_protocol::text,target_date,100);
    awarded := awarded+n;
  end if;
  return awarded;
end;
$$;
grant execute on function public.garden_award_protocol_day(uuid,date) to authenticated;

-- 6) Catalogue et récoltes réelles du Jardin.
alter table public.protocols add column if not exists garden_exclusive boolean not null default false;
alter table public.protocols add column if not exists garden_reward_key text null;
alter table public.user_protocols add column if not exists source text null;
alter table public.user_protocols add column if not exists reward_key text null;

create table if not exists public.garden_reward_catalog (
  reward_key text primary key,
  min_xp integer not null,
  reward_type text not null check(reward_type in('content','collection','protocol','protocol_choice')),
  title text not null,
  detail text null,
  protocol_id uuid null references public.protocols(id) on delete set null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.garden_reward_items (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null references public.garden_reward_catalog(reward_key) on delete cascade,
  sort_order integer not null default 10,
  type text not null default 'document',
  title text not null,
  description text null,
  content_text text null,
  file_url text null,
  active boolean not null default true,
  unique(reward_key,sort_order)
);

create table if not exists public.garden_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null references public.garden_reward_catalog(reward_key),
  selected_protocol_id uuid null references public.protocols(id) on delete set null,
  claimed_at timestamptz not null default now(),
  unique(user_id,reward_key)
);

alter table public.garden_reward_catalog enable row level security;
alter table public.garden_reward_items enable row level security;
alter table public.garden_reward_claims enable row level security;
drop policy if exists "garden reward catalog admin" on public.garden_reward_catalog;
create policy "garden reward catalog admin" on public.garden_reward_catalog for all to authenticated
using(public.is_admin()) with check(public.is_admin());
drop policy if exists "garden reward items admin" on public.garden_reward_items;
create policy "garden reward items admin" on public.garden_reward_items for all to authenticated
using(public.is_admin()) with check(public.is_admin());
drop policy if exists "garden reward claims read own" on public.garden_reward_claims;
create policy "garden reward claims read own" on public.garden_reward_claims for select to authenticated
using(auth.uid()=user_id);
revoke insert,update,delete on public.garden_reward_claims from authenticated;
grant select on public.garden_reward_claims to authenticated;

-- 7) Mini-protocole exclusif 3 jours : vrai protocole, invisible avant récolte.
insert into public.protocols(
 id,slug,title,subtitle,category,emoji,short_description,long_description,
 price_cents,duration_label,total_days,level_label,certificate_enabled,premium_positioning,
 active,garden_exclusive,garden_reward_key
) values(
 '37100000-0000-4000-8000-000000001500'::uuid,
 'jardin-3-jours-retrouver-ton-rythme',
 '3 jours pour retrouver ton rythme',
 'Récolte du Jardin',
 'pharmacie_vegetale','✶',
 'Trois jours exclusifs pour revenir à tes repères, nourrir ton rythme et ancrer ce qui te fait du bien.',
 'Une expérience réservée au Jardin intérieur. Trois jours courts et concrets pour observer, ajuster et repartir avec un repère simple à conserver.',
 0,'3 jours',3,'Récolte du Jardin',false,'garden_reward',true,true,'feuillage'
)
on conflict(id) do update set
 slug=excluded.slug,title=excluded.title,subtitle=excluded.subtitle,short_description=excluded.short_description,
 long_description=excluded.long_description,duration_label=excluded.duration_label,total_days=3,
 garden_exclusive=true,garden_reward_key='feuillage',active=true;

insert into public.protocol_contents(
 id,protocol_id,type,title,description,content_text,sort_order,active,day_number,access_level,xp_points,downloadable
) values
('37100000-0000-4000-8000-000000001501'::uuid,'37100000-0000-4000-8000-000000001500'::uuid,'journal_private','Jour 1 — Revenir à soi','Observer avant de vouloir corriger.','Aujourd’hui, ne cherche pas à tout optimiser. Observe simplement ton énergie, ta faim, ton niveau de tension et ce dont tu as réellement besoin.\n\nQuestion du jour : quel signal de ton corps mérite davantage d’attention aujourd’hui ?',10,true,1,'protocol',10,false),
('37100000-0000-4000-8000-000000001502'::uuid,'37100000-0000-4000-8000-000000001500'::uuid,'checklist','Jour 2 — Nourrir son rythme','Créer une journée plus soutenante sans rigidité.','Choisis trois gestes réalistes : une hydratation régulière, un repas qui te nourrit vraiment et un moment de mouvement ou de récupération adapté à ta journée.\n\nLe but n’est pas la perfection : c’est de rendre ton rythme plus lisible.',20,true,2,'protocol',10,false),
('37100000-0000-4000-8000-000000001503'::uuid,'37100000-0000-4000-8000-000000001500'::uuid,'routine','Jour 3 — Ancrer ce qui fait du bien','Transformer une bonne journée en repère durable.','Reprends les deux jours précédents et choisis un seul geste que tu souhaites conserver. Écris-le de façon concrète : quand, comment et dans quelle version minimale tu peux le tenir même pendant une journée chargée.\n\nTon rythme n’a pas besoin d’être parfait pour devenir stable.',30,true,3,'protocol',10,false)
on conflict(id) do update set
 title=excluded.title,description=excluded.description,content_text=excluded.content_text,
 sort_order=excluded.sort_order,active=true,day_number=excluded.day_number,access_level='protocol',xp_points=excluded.xp_points;

-- 8) Les cinq récompenses définitives.
insert into public.garden_reward_catalog(reward_key,min_xp,reward_type,title,detail,protocol_id,active) values
('racines',250,'content','Secret du Jardin — fiche Pharmacopée exclusive','Une fiche privée autour d’une plante et de son intégration au quotidien.',null,true),
('pousse',500,'content','Rituel signature TEE','15 minutes pour revenir à soi et retrouver un repère simple.',null,true),
('feuillage',1500,'protocol','Mini-protocole exclusif · 3 jours','3 jours pour retrouver ton rythme.','37100000-0000-4000-8000-000000001500'::uuid,true),
('floraison',4000,'collection','Collection privée — L’Herbier de Tee','Une récolte composée de quatre contenus exclusifs.',null,true),
('alchimiste',8000,'protocol_choice','Le choix de l’Alchimiste','Un protocole complet Méthode TEE offert au choix.',null,true)
on conflict(reward_key) do update set
 min_xp=excluded.min_xp,reward_type=excluded.reward_type,title=excluded.title,detail=excluded.detail,
 protocol_id=excluded.protocol_id,active=true,updated_at=now();

-- Contenus immédiatement utilisables dans Bibliothèque après récolte.
insert into public.garden_reward_items(reward_key,sort_order,type,title,description,content_text) values
('racines',10,'guide_plantes','Secret du Jardin n°1 — Ortie & minéralité végétale','Une fiche Pharmacopée réservée au Jardin intérieur.','L’ortie est traditionnellement utilisée comme plante alimentaire et de tisane. Ses feuilles apportent naturellement différents minéraux et composés végétaux.\n\nRituel simple : 1 à 2 cuillères à café de feuilles sèches dans une grande tasse, infusion 7 à 10 minutes, puis filtrer. Commence léger et observe comment tu la tolères.\n\nÀ retenir : une plante ne remplace ni une alimentation variée ni un traitement. En cas de grossesse, de maladie rénale, de traitement diurétique ou de doute médical, demande conseil à un professionnel de santé.'),
('pousse',10,'routine','Rituel signature TEE — 15 minutes pour revenir à soi','Un rituel court à refaire quand tu as besoin de retrouver tes repères.','3 minutes — Pose ton téléphone et bois quelques gorgées d’eau tranquillement.\n\n5 minutes — Respire, étire-toi ou marche doucement sans chercher la performance.\n\n5 minutes — Demande-toi : « De quoi ai-je réellement besoin maintenant ? » puis note une réponse simple.\n\n2 minutes — Choisis un seul geste pour la suite de ta journée.\n\nLe rituel est volontairement court : l’objectif est de revenir à toi, pas d’ajouter une nouvelle obligation.'),
('floraison',10,'guide_plantes','L’Herbier de Tee — Infusion d’ancrage','Une préparation végétale simple pour créer un temps de pause.','Prépare une infusion douce avec une plante que tu connais et tolères bien, par exemple mélisse ou verveine. Installe-toi quelques minutes sans écran. L’intérêt du rituel est autant dans la pause que dans la boisson elle-même.'),
('floraison',20,'recette','L’Herbier de Tee — Assiette d’équilibre','Une trame souple pour construire un repas sans rigidité.','Compose ton assiette autour de quatre repères : une source de protéines, un végétal ou fruit, une source d’énergie adaptée à ta faim et une matière grasse de qualité. Les quantités restent personnelles : observe surtout satiété, énergie et digestion.'),
('floraison',30,'routine','L’Herbier de Tee — Rituel de récupération','Un retour au calme à adapter après une journée dense ou sportive.','Hydrate-toi, relâche les tensions quelques minutes, puis choisis une action de récupération réaliste : repas nourrissant, douche tiède, mobilité douce, respiration ou coucher plus calme. Garde seulement ce qui correspond à ton terrain.'),
('floraison',40,'document','L’Herbier de Tee — Bilan d’alignement','Quatre questions pour observer ce qui soutient réellement ton équilibre.','1. Qu’est-ce qui m’a donné de l’énergie cette semaine ?\n2. Qu’est-ce qui m’en a pris ?\n3. Quel repère a été facile à tenir ?\n4. Quel geste minimal ai-je envie de conserver la semaine prochaine ?')
on conflict(reward_key,sort_order) do update set
 type=excluded.type,title=excluded.title,description=excluded.description,content_text=excluded.content_text,active=true;

-- 9) Récolter = vraie délivrance. Les anciens faux claimed_rewards ne comptent pas ici.
create or replace function public.garden_claim_reward(
  target_reward_key text,
  selected_protocol uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  mail text:=coalesce(auth.jwt()->>'email','');
  xp integer:=0;
  reward public.garden_reward_catalog%rowtype;
  chosen public.protocols%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(points,0) into xp from public.member_profiles where user_id=uid;
  select * into reward from public.garden_reward_catalog where reward_key=target_reward_key and active=true;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if xp < reward.min_xp then raise exception 'NOT_ENOUGH_XP'; end if;
  if exists(select 1 from public.garden_reward_claims where user_id=uid and reward_key=target_reward_key) then
    return jsonb_build_object('ok',true,'already_claimed',true,'reward_key',reward.reward_key,'reward_type',reward.reward_type,'title',reward.title);
  end if;

  if reward.reward_type='protocol' then
    if reward.protocol_id is null then raise exception 'REWARD_PROTOCOL_MISSING'; end if;
    insert into public.user_protocols(user_id,user_email,protocol_id,status,unlocked,source,reward_key,purchased_at)
    values(uid,mail,reward.protocol_id,'active',true,'garden_reward',reward.reward_key,now())
    on conflict(user_id,protocol_id) do update set status='active',unlocked=true,source='garden_reward',reward_key=reward.reward_key;
    selected_protocol := reward.protocol_id;
  elsif reward.reward_type='protocol_choice' then
    if selected_protocol is null then raise exception 'PROTOCOL_CHOICE_REQUIRED'; end if;
    select * into chosen from public.protocols
      where id=selected_protocol and active=true and coalesce(garden_exclusive,false)=false and coalesce(price_cents,0)>0;
    if not found then raise exception 'PROTOCOL_NOT_ELIGIBLE'; end if;
    if exists(select 1 from public.user_protocols where user_id=uid and protocol_id=selected_protocol and status='active' and unlocked is distinct from false) then
      raise exception 'PROTOCOL_ALREADY_OWNED';
    end if;
    insert into public.user_protocols(user_id,user_email,protocol_id,status,unlocked,source,reward_key,purchased_at)
    values(uid,mail,selected_protocol,'active',true,'garden_reward',reward.reward_key,now())
    on conflict(user_id,protocol_id) do update set status='active',unlocked=true,source='garden_reward',reward_key=reward.reward_key;
  end if;

  insert into public.garden_reward_claims(user_id,reward_key,selected_protocol_id)
  values(uid,reward.reward_key,selected_protocol)
  on conflict(user_id,reward_key) do nothing;

  insert into public.member_profiles(user_id,points,garden_claimed_rewards)
  values(uid,xp,jsonb_build_array(reward.reward_key))
  on conflict(user_id) do update set
    garden_claimed_rewards=(
      select coalesce(jsonb_agg(distinct value),'[]'::jsonb)
      from jsonb_array_elements(
        coalesce(public.member_profiles.garden_claimed_rewards,'[]'::jsonb) || jsonb_build_array(reward.reward_key)
      )
    ),
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'reward_key',reward.reward_key,
    'reward_type',reward.reward_type,
    'title',reward.title,
    'protocol_id',selected_protocol
  );
end;
$$;
grant execute on function public.garden_claim_reward(text,uuid) to authenticated;

-- 10) Une seule petite lecture pour retrouver toutes les récoltes de contenu dans Bibliothèque.
create or replace function public.garden_my_rewards()
returns table(
  item_id uuid,
  reward_key text,
  reward_title text,
  type text,
  title text,
  description text,
  content_text text,
  file_url text,
  sort_order integer,
  claimed_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select i.id,i.reward_key,c.title,i.type,i.title,i.description,i.content_text,i.file_url,i.sort_order,cl.claimed_at
  from public.garden_reward_claims cl
  join public.garden_reward_catalog c on c.reward_key=cl.reward_key and c.active=true
  join public.garden_reward_items i on i.reward_key=cl.reward_key and i.active=true
  where cl.user_id=auth.uid()
  order by cl.claimed_at desc,i.sort_order asc;
$$;
grant execute on function public.garden_my_rewards() to authenticated;

notify pgrst,'reload schema';
commit;
