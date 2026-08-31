-- MÉTHODE TEE — complément cumulatif Scanner / XP — 30 août 2026
-- Base : ZIP 395(2). À exécuter APRÈS CORRECTIF_XP_SUPABASE_20260830.sql
-- déjà installé. Ne remplace pas ce rattrapage et ne remet aucun solde à zéro.
-- 1. Validations atomiques : succès et gains confirmés par le serveur.
-- 2. Compteur de protocole aligné sur les événements réellement crédités.
-- 3. Bonus collectif : mêmes cartes validables que celles visibles dans l'app.
-- 4. Réponse quotidienne distinguant « déjà attribué » et « pas encore éligible ».
-- Aucune écriture sur les achats, contenus, données Santé ou repas.
-- Réexécutable. Les signatures des anciennes RPC restent inchangées.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $preflight$
declare missing text;
begin
  if to_regprocedure('mt_xp_repair.sync_protocol(uuid,text)') is null
     or to_regprocedure('public.garden_record_xp(uuid,text,text,date,integer)') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid=to_regclass('public.protocol_progress')
         and tgname='mt_xp_protocol_saved_20260830' and tgenabled<>'D'
     ) then
    raise exception 'XP_COMPLEMENT_PREREQUIS : installer d’abord le correctif XP du 30 août 2026, révision texte/UUID';
  end if;
  select string_agg(v.t||'.'||v.c, ', ') into missing
  from (values
    ('protocol_progress','xp'),('protocol_progress','streak'),('protocol_progress','level_label'),
    ('protocol_progress','current_day'),('protocol_progress','total_days'),
    ('protocol_progress','certificate_unlocked'),('protocol_progress','updated_at'),
    ('protocol_progress','last_validated_at'),
    ('member_profiles','garden_claimed_rewards'),
    ('community_journey_items','validation_enabled'),('community_journey_items','status'),
    ('community_journey_items','journey_date'),('community_journey_items','is_active'),
    ('community_journey_completions','user_id'),('community_journey_completions','journey_item_id'),
    ('community_journey_completions','journey_date'),('community_journey_completions','completed')
  ) v(t,c)
  where not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name=v.t and column_name=v.c);
  if missing is not null then
    raise exception 'XP_COMPLEMENT_COLONNES_MANQUANTES : %', missing;
  end if;
end;
$preflight$;

lock table public.protocol_progress in share row exclusive mode;
lock table public.community_journey_completions in share row exclusive mode;

-- Le total global peut contenir un ancien solde sans historique : il reste intact.
-- Ce helper n'additionne que les événements identifiables de CE protocole.
create or replace function mt_xp_repair.protocol_credit_total(p_user uuid,p_protocol text)
returns integer language sql volatile set search_path='' as $$
  select coalesce(sum(e.points),0)::integer
  from public.garden_xp_events e
  where e.user_id=p_user and (
    (e.event_key='protocol_day'
      and e.event_ref=p_protocol||':'||right(e.event_ref,10)
      and mt_xp_repair.day_value(right(e.event_ref,10)) is not null)
    or (e.event_key='protocol_streak' and (
      (e.event_ref=p_protocol||':streak-date:'||right(e.event_ref,10)
        and mt_xp_repair.day_value(right(e.event_ref,10)) is not null)
      or e.event_ref=p_protocol||':streak:'||substring(e.event_ref from '[0-9]+$')
    ))
    or (e.event_key='protocol_complete' and e.event_ref=p_protocol)
    or (e.event_key='protocol_content' and exists (
      select 1 from public.protocol_contents c
      where c.id::text=e.event_ref and c.protocol_id::text=p_protocol
    ))
  );
$$;

create or replace function mt_xp_repair.sync_protocol_display(p_user uuid,p_protocol text)
returns void language plpgsql security definer set search_path='' as $$
declare total integer; label text;
begin
  total:=mt_xp_repair.protocol_credit_total(p_user,p_protocol);
  label:=case when total<250 then 'Semence' when total<500 then 'Racines'
    when total<1500 then 'Pousse' when total<4000 then 'Feuillage'
    when total<8000 then 'Floraison' else 'Alchimiste' end;
  update public.protocol_progress p set xp=total,level_label=label
  where p.user_id=p_user and p.protocol_id::text=p_protocol
    and (p.xp is distinct from total or p.level_label is distinct from label);
end;
$$;

-- Garde le trigger déjà installé, y compris pour les anciennes versions iOS.
-- La seconde UPDATE ne touche pas completed_days/content : pas de récursion.
create or replace function mt_xp_repair.on_protocol_saved()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.completed_days is not distinct from old.completed_days
    and new.completed_content is not distinct from old.completed_content then return new; end if;
  perform mt_xp_repair.sync_protocol(new.user_id,new.protocol_id::text);
  perform mt_xp_repair.sync_protocol_display(new.user_id,new.protocol_id::text);
  return new;
end;
$$;

create or replace function mt_xp_repair.profile_snapshot(p_user uuid)
returns jsonb language sql volatile set search_path='' as $$
  select jsonb_build_object(
    'user_id',p_user,
    'points',coalesce(m.points,0),
    'level',m.level,'level_label',m.level_label,'badge',m.badge,'updated_at',m.updated_at,
    'garden_claimed_rewards',coalesce(m.garden_claimed_rewards,'[]'::jsonb)
  )
  from (select p_user as user_id) u
  left join public.member_profiles m on m.user_id=u.user_id;
$$;

-- Nouvelle RPC au nom distinct : pas de surcharge UUID/texte ambiguë.
-- Ne crée pas d'accès/protocole : exige une progression existante de auth.uid().
-- Le verrou de ligne évite qu'un contenu et une journée s'écrasent mutuellement.
create or replace function public.garden_complete_protocol_action(
  target_protocol text, action_key text, target_content text default null,
  target_date date default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  p public.protocol_progress%rowtype;
  dates jsonb; contents jsonb;
  max_days integer; day_count integer; new_streak integer:=0;
  before_total integer; after_total integer;
  d date:=coalesce(target_date,current_date);
  last_day date; state text:='saved'; changed boolean:=false; row_count integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if action_key not in ('day','content') or action_key is null then raise exception 'XP_ACTION_INVALID'; end if;
  if target_protocol is null or length(target_protocol)>1024 then raise exception 'PROTOCOL_INVALID'; end if;
  if d<current_date-1 or d>current_date+1 then raise exception 'XP_DATE_INVALID'; end if;

  select count(*) into row_count from public.protocol_progress pp
  where pp.user_id=uid and pp.protocol_id::text=target_protocol;
  if row_count=0 then raise exception 'PROGRESS_NOT_FOUND'; end if;
  if row_count>1 then raise exception 'PROGRESS_AMBIGUOUS'; end if;
  select * into p from public.protocol_progress pp
  where pp.user_id=uid and pp.protocol_id::text=target_protocol for update;
  max_days:=mt_xp_repair.protocol_days(target_protocol);
  if max_days is null then raise exception 'PROTOCOL_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(x.d::text order by x.d),'[]'::jsonb) into dates
  from (select distinct mt_xp_repair.day_value(j.value #>> '{}') d
    from jsonb_array_elements(mt_xp_repair.as_array(p.completed_days)) j(value)
    where jsonb_typeof(j.value)='string') x
  where x.d is not null and x.d<=current_date+1;
  select coalesce(jsonb_agg(x.id order by x.id),'[]'::jsonb) into contents
  from (select distinct j.value #>> '{}' id
    from jsonb_array_elements(mt_xp_repair.as_array(p.completed_content)) j(value)
    where jsonb_typeof(j.value)='string') x;

  before_total:=mt_xp_repair.protocol_credit_total(uid,target_protocol);
  if action_key='day' then
    if dates ? d::text then state:='already_done';
    elsif jsonb_array_length(dates)>=max_days then state:='complete';
    else dates:=dates||jsonb_build_array(d::text); changed:=true;
    end if;
  else
    if not exists(select 1 from public.protocol_contents c
      where c.id::text=target_content and c.protocol_id::text=target_protocol
        and c.active is distinct from false) then raise exception 'CONTENT_NOT_FOUND'; end if;
    if contents ? target_content then state:='already_done';
    else contents:=contents||jsonb_build_array(target_content); changed:=true;
    end if;
  end if;

  if changed then
    day_count:=jsonb_array_length(dates);
    select max((j.value #>> '{}')::date) into last_day from jsonb_array_elements(dates) j(value);
    if last_day is not null then
      select count(*)::integer into new_streak from (
        select x.d,row_number() over(order by x.d desc)::integer-1 offset_days
        from (select distinct (j.value #>> '{}')::date d from jsonb_array_elements(dates) j(value)) x
      ) s where s.d=last_day-s.offset_days;
    end if;
    update public.protocol_progress set
      completed_days=dates,completed_content=contents,
      total_days=max_days,current_day=least(max_days,greatest(1,coalesce(p.current_day,1))),
      last_validated_at=case when action_key='day' then now() else p.last_validated_at end,
      streak=new_streak,certificate_unlocked=(day_count>=max_days),updated_at=now()
    where id=p.id and user_id=uid;
    -- L'AFTER trigger a crédité et normalisé le compteur dans la même transaction.
  else
    perform mt_xp_repair.sync_protocol(uid,target_protocol);
    perform mt_xp_repair.sync_protocol_display(uid,target_protocol);
  end if;
  select * into p from public.protocol_progress pp where pp.id=p.id and pp.user_id=uid;
  after_total:=mt_xp_repair.protocol_credit_total(uid,target_protocol);
  return jsonb_build_object('status',state,'gained',greatest(0,after_total-before_total),
    'progress',to_jsonb(p),'profile',mt_xp_repair.profile_snapshot(uid));
end;
$$;
revoke all on function public.garden_complete_protocol_action(text,text,text,date) from public,anon;
grant execute on function public.garden_complete_protocol_action(text,text,text,date) to authenticated;

-- Les conditions ci-dessous correspondent au payload de l'accueil :
-- actif + publié/programmé + validable. Une carte informative ou un brouillon
-- ne peut plus bloquer le bonus. EXISTS évite de compter deux fois un geste.
create or replace function mt_xp_repair.daily_is_eligible(p_user uuid,p_action text,p_date date)
returns boolean language plpgsql stable set search_path='' as $$
declare eligible boolean:=false;
begin
  if p_user is null or p_date is null or p_date<current_date-1 or p_date>current_date+1 then return false; end if;
  case p_action
    when 'journal' then
      select exists(select 1 from public.daily_activity d where d.user_id=p_user
        and d.activity_date=p_date and d.has_journal=true) into eligible;
    when 'hydration' then
      select exists(select 1 from public.daily_activity d where d.user_id=p_user
        and d.activity_date=p_date and coalesce(d.hydration_liters,0)>=2) into eligible;
    when 'personal_tracker' then
      select exists(select 1 from public.user_tracker_entries t
        where t.user_id=p_user and t.entry_date=p_date) into eligible;
    when 'community_journey' then
      select count(*)>0 and bool_and(exists(
        select 1 from public.community_journey_completions c
        where c.user_id=p_user and c.journey_date=p_date and c.completed=true
          and c.journey_item_id::text=i.id::text
      )) into eligible
      from public.community_journey_items i
      where i.journey_date=p_date and i.is_active=true
        and i.status in ('scheduled','published') and i.validation_enabled is distinct from false;
    else return false;
  end case;
  return coalesce(eligible,false);
end;
$$;

create or replace function mt_xp_repair.award_daily_for_user(p_user uuid,p_action text,p_date date)
returns integer language plpgsql security definer set search_path='' as $$
declare pts integer;
begin
  if p_user is null or p_date is null or p_action not in ('journal','hydration','personal_tracker','community_journey') then return 0; end if;
  -- Deux derniers gestes arrivant de deux appareils doivent voir une même
  -- décision d'éligibilité, sans dépendre de leur ordre de commit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text||':'||p_action||':'||p_date::text,0));
  if not mt_xp_repair.daily_is_eligible(p_user,p_action,p_date) then return 0; end if;
  pts:=case when p_action='personal_tracker' then 3 else 5 end;
  return public.garden_record_xp(p_user,'daily_'||p_action,p_date::text,p_date,pts);
end;
$$;

-- Même nom, mêmes paramètres et même type pour les apps déjà distribuées.
create or replace function public.garden_award_daily(action_key text,target_date date default current_date)
returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return mt_xp_repair.award_daily_for_user(uid,action_key,target_date);
end;
$$;
revoke all on function public.garden_award_daily(text,date) from public,anon;
grant execute on function public.garden_award_daily(text,date) to authenticated;

create or replace function public.garden_award_daily_status(action_key text,target_date date default current_date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); gained integer; awarded boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if action_key not in ('journal','hydration','personal_tracker','community_journey') or action_key is null then
    raise exception 'XP_ACTION_INVALID';
  end if;
  gained:=mt_xp_repair.award_daily_for_user(uid,action_key,target_date);
  select exists(select 1 from public.garden_xp_events e
    where e.user_id=uid and e.event_key='daily_'||action_key and e.event_ref=target_date::text) into awarded;
  return jsonb_build_object('gained',gained,'awarded',awarded,
    'eligible',mt_xp_repair.daily_is_eligible(uid,action_key,target_date),
    'profile',mt_xp_repair.profile_snapshot(uid));
end;
$$;
revoke all on function public.garden_award_daily_status(text,date) from public,anon;
grant execute on function public.garden_award_daily_status(text,date) to authenticated;

-- Le bonus collectif ne dépend plus du second appel JS de l'ancienne app.
-- Une erreur d'attribution annule l'écriture ; aucun faux geste validé.
create or replace function mt_xp_repair.on_community_saved()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.completed=true then
    perform mt_xp_repair.award_daily_for_user(new.user_id,'community_journey',new.journey_date);
  end if;
  return new;
end;
$$;
create or replace trigger mt_xp_community_saved_20260830
after insert or update of completed on public.community_journey_completions
for each row execute function mt_xp_repair.on_community_saved();

-- Corrige uniquement les compteurs de protocole à partir du ledger existant.
-- Aucun nouvel XP global ici ; ni retrait ni recalcul des anciens soldes opaques.
do $display_backfill$
declare p record;
begin
  for p in select distinct user_id,protocol_id::text pid from public.protocol_progress loop
    perform mt_xp_repair.sync_protocol_display(p.user_id,p.pid);
  end loop;
end;
$display_backfill$;

revoke all on all functions in schema mt_xp_repair from public,anon,authenticated;
insert into mt_xp_repair.installations(patch_key) values('xp_scanner_complement_20260830')
on conflict(patch_key) do nothing;
notify pgrst,'reload schema';
commit;

select 'OK_XP_COMPLEMENT_INSTALLE' as controle,
  to_regprocedure('public.garden_complete_protocol_action(text,text,text,date)') is not null as validations_atomiques,
  to_regprocedure('public.garden_award_daily_status(text,date)') is not null as etat_xp_quotidiens;
