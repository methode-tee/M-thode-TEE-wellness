-- Méthode Tee V299 — Connexion profil/calendrier de « Notre journée ensemble »
-- Migration additive et compatible : aucune table existante n'est supprimée,
-- aucune policy existante n'est remplacée et aucun système d'achat n'est touché.

alter table public.community_journey_settings
  add column if not exists member_count_threshold integer not null default 20,
  add column if not exists low_member_text text not null default 'La communauté avance avec toi',
  add column if not exists counted_member_text text not null default '{count} membres avancent avec toi',
  add column if not exists show_profile_progress boolean not null default true,
  add column if not exists profile_label text not null default 'Notre journée',
  add column if not exists show_weekly_stats boolean not null default true,
  add column if not exists show_monthly_stats boolean not null default true,
  add column if not exists show_calendar_participation boolean not null default true,
  add column if not exists allow_past_view boolean not null default true,
  add column if not exists allow_retroactive boolean not null default false,
  add column if not exists history_days integer not null default 365,
  add column if not exists calendar_marker_style text not null default 'dot';

alter table public.community_journey_settings
  drop constraint if exists community_journey_settings_member_count_threshold_check;
alter table public.community_journey_settings
  add constraint community_journey_settings_member_count_threshold_check
  check (member_count_threshold >= 0);

alter table public.community_journey_settings
  drop constraint if exists community_journey_settings_history_days_check;
alter table public.community_journey_settings
  add constraint community_journey_settings_history_days_check
  check (history_days >= 30 and history_days <= 3650);

-- Résumé compact du compte connecté. Appelé uniquement dans le Profil/Calendrier,
-- jamais pendant le chargement de l'accueil.
create or replace function public.community_journey_profile_summary(
  target_date date,
  month_start date,
  month_end date
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with settings_row as (
    select to_jsonb(s) as settings
    from public.community_journey_settings s
    where s.id = 1
  ), validatable as (
    select i.journey_date, i.id
    from public.community_journey_items i
    where i.is_active = true
      and i.status in ('scheduled','published')
      and i.validation_enabled = true
      and i.journey_date between month_start and month_end
  ), day_totals as (
    select v.journey_date,
           count(*)::integer as total,
           count(*) filter (where c.completed = true)::integer as completed,
           max(c.completed_at) as last_completed_at
    from validatable v
    left join public.community_journey_completions c
      on c.journey_item_id = v.id
     and c.journey_date = v.journey_date
     and c.user_id = auth.uid()
    group by v.journey_date
  ), participation_days as (
    select p.journey_date
    from public.community_journey_participation p
    where p.user_id = auth.uid()
      and p.journey_date between month_start and month_end
  ), merged_days as (
    select coalesce(d.journey_date,p.journey_date) as journey_date,
           coalesce(d.completed,0)::integer as completed,
           coalesce(d.total,0)::integer as total,
           d.last_completed_at,
           (p.journey_date is not null) as participated
    from day_totals d
    full join participation_days p using (journey_date)
  ), today_row as (
    select coalesce(max(completed),0)::integer as completed,
           coalesce(max(total),0)::integer as total,
           coalesce(bool_or(participated),false) as participated
    from merged_days where journey_date = target_date
  ), week_row as (
    select count(*)::integer as joined_days
    from merged_days
    where journey_date between (target_date - ((extract(isodow from target_date)::integer)-1))
                           and (target_date + (7-extract(isodow from target_date)::integer))
      and (participated or completed > 0)
  ), month_row as (
    select count(*) filter (where participated or completed > 0)::integer as joined_days,
           coalesce(sum(completed),0)::integer as completed_gestures,
           coalesce(sum(total),0)::integer as total_gestures
    from merged_days
  )
  select jsonb_build_object(
    'settings', coalesce((select settings from settings_row), '{}'::jsonb),
    'today', (select to_jsonb(today_row) from today_row),
    'week', (select to_jsonb(week_row) from week_row),
    'month', (select to_jsonb(month_row) from month_row),
    'days', coalesce((select jsonb_agg(to_jsonb(m) order by m.journey_date) from merged_days m), '[]'::jsonb)
  );
$$;

grant execute on function public.community_journey_profile_summary(date,date,date) to authenticated;

comment on function public.community_journey_profile_summary(date,date,date)
is 'Résumé privé et agrégé de Notre journée ensemble pour Mon parcours et son calendrier.';
