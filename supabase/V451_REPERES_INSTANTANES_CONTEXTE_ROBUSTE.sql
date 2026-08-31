-- MÉTHODE TEE · V451 · REPÈRES INSTANTANÉS + CONTEXTE ROBUSTE
-- À exécuter après V441 + V442 + V445 + V446 + V447.
--
-- Pourquoi : mt_reference_context() lançait mt_reference_bootstrap(28) de façon
-- synchrone. Sur un compte avec un historique riche, le premier appel pouvait
-- dépasser le délai client et l'interface restait sur « Repères en mise à jour »
-- alors que le profil de départ suffisait déjà à calculer une première fourchette.
--
-- V451 sépare les responsabilités :
--   • Résumé / Adapter mon repas : lecture immédiate des faits compacts existants ;
--   • Mes tendances 28 j / 3 mois : conserve le bootstrap serveur à la demande ;
--   • aucun historique brut n'est téléchargé ;
--   • si une couche optionnelle est momentanément indisponible, le profil est
--     quand même renvoyé afin de ne pas bloquer les premiers repères.

begin;

create or replace function public.mt_reference_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  v_today jsonb := '{}'::jsonb;
  v_profile jsonb := '{}'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_trackers jsonb := '{}'::jsonb;
  v_preferences jsonb := '{}'::jsonb;
  v_active_protocols jsonb := '[]'::jsonb;
  w_first numeric; w_last numeric; w_first_date date; w_last_date date;
  w_old numeric; w_recent numeric; w_old_n int; w_recent_n int;
begin
  if uid is null then raise exception 'auth required'; end if;

  -- Le profil de départ est prioritaire et ne dépend d'aucun bootstrap historique.
  select jsonb_strip_nulls(jsonb_build_object(
    'birth_date',birth_date,
    'height_cm',height_cm,
    'reference_gender',reference_gender,
    'reference_sex',reference_sex,
    'reference_weight_kg',reference_weight_kg,
    'settings',reference_settings
  ))
  into v_profile
  from public.profiles
  where id=uid;
  v_profile:=coalesce(v_profile,'{}'::jsonb);

  -- Fait compact du jour déjà produit par les triggers. Son absence est normale.
  begin
    select coalesce(core,'{}'::jsonb) || coalesce(numeric_signals,'{}'::jsonb)
    into v_today
    from public.user_reference_daily_facts
    where user_id=uid and fact_date=target_date;
    v_today:=coalesce(v_today,'{}'::jsonb);
  exception when others then
    v_today:='{}'::jsonb;
  end;

  -- Historique compact existant : aucune reconstruction synchrone ici.
  begin
    v_summary:=coalesce(public.mt_reference_period_summary(uid,current_date-27,current_date),'{}'::jsonb);

    select fact_date,public.mt_reference_num(core,'weight_kg')
    into w_first_date,w_first
    from public.user_reference_daily_facts
    where user_id=uid and fact_date>=current_date-27
      and public.mt_reference_num(core,'weight_kg') is not null
    order by fact_date asc limit 1;

    select fact_date,public.mt_reference_num(core,'weight_kg')
    into w_last_date,w_last
    from public.user_reference_daily_facts
    where user_id=uid and fact_date>=current_date-27
      and public.mt_reference_num(core,'weight_kg') is not null
    order by fact_date desc limit 1;

    select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int
    into w_old,w_old_n
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between current_date-27 and current_date-14
      and public.mt_reference_num(core,'weight_kg') is not null;

    select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int
    into w_recent,w_recent_n
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between current_date-13 and current_date
      and public.mt_reference_num(core,'weight_kg') is not null;

    v_summary:=v_summary || jsonb_strip_nulls(jsonb_build_object(
      'weight_first',w_first,'weight_first_date',w_first_date,
      'weight_last',w_last,'weight_last_date',w_last_date,
      'weight_older_avg',w_old,'weight_older_count',w_old_n,
      'weight_recent_avg',w_recent,'weight_recent_count',w_recent_n
    ));

    with t as (
      select k,count(*)::int days
      from public.user_reference_daily_facts d
      cross join lateral unnest(d.tracker_keys) k
      where d.user_id=uid
        and d.fact_date>=current_date-27 and d.fact_date<=current_date
        and d.source_count>0
      group by k
    )
    select coalesce(jsonb_object_agg(k,days),'{}'::jsonb)
    into v_trackers from t;
  exception when others then
    -- Une lecture historique défaillante ne doit jamais empêcher le point de départ.
    v_summary:='{}'::jsonb;
    v_trackers:='{}'::jsonb;
  end;

  -- Préférences de trackers : contexte optionnel.
  begin
    select coalesce(jsonb_object_agg(tracker_key,settings),'{}'::jsonb)
    into v_preferences
    from public.user_tracker_preferences
    where user_id=uid and enabled=true;
    v_preferences:=coalesce(v_preferences,'{}'::jsonb);
  exception when others then
    v_preferences:='{}'::jsonb;
  end;

  -- Protocoles réellement en cours : contexte optionnel, jamais bloquant.
  begin
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',p.id,'slug',p.slug,'title',p.title,
        'current_day',pp.current_day,'total_days',pp.total_days
      ) order by pp.updated_at desc
    ),'[]'::jsonb)
    into v_active_protocols
    from public.protocol_progress pp
    join public.protocols p on p.id=pp.protocol_id
    where pp.user_id=uid
      and coalesce(pp.certificate_unlocked,false)=false
      and (case
        when jsonb_typeof(coalesce(pp.completed_days,'[]'::jsonb))='array'
          then jsonb_array_length(coalesce(pp.completed_days,'[]'::jsonb))
        else 0 end) < greatest(1,coalesce(pp.total_days,1));
    v_active_protocols:=coalesce(v_active_protocols,'[]'::jsonb);
  exception when others then
    v_active_protocols:='[]'::jsonb;
  end;

  return jsonb_build_object(
    'date',target_date,
    'profile',v_profile,
    'today',coalesce(v_today,'{}'::jsonb),
    'summary28',coalesce(v_summary,'{}'::jsonb),
    'tracker_days',coalesce(v_trackers,'{}'::jsonb),
    'preferences',coalesce(v_preferences,'{}'::jsonb),
    'active_protocols',coalesce(v_active_protocols,'[]'::jsonb),
    'context_mode','instant_compact',
    'source_note','Point de départ immédiat depuis Mon profil ; les faits compacts déjà disponibles affinent ensuite le repère. Une absence reste une absence, jamais un zéro.'
  );
end;
$$;

revoke all on function public.mt_reference_context(date) from public,anon;
grant execute on function public.mt_reference_context(date) to authenticated;
comment on function public.mt_reference_context(date) is 'V451 · Contexte instantané : profil immédiatement disponible, historique compact non bloquant, aucun bootstrap synchrone.';

commit;
