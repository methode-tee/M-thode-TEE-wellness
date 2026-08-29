-- Méthode Tee V393 — réglages journaliers, bilan de protocole et suppression responsable.
begin;

create extension if not exists "pgcrypto";

create table if not exists public.community_journey_day_settings (
  journey_date date primary key,
  title text,
  subtitle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title is null or char_length(title) <= 120),
  check (subtitle is null or char_length(subtitle) <= 500)
);
alter table public.community_journey_day_settings enable row level security;
drop policy if exists "community_journey_day_settings_read" on public.community_journey_day_settings;
create policy "community_journey_day_settings_read" on public.community_journey_day_settings for select using (true);
drop policy if exists "community_journey_day_settings_admin" on public.community_journey_day_settings;
create policy "community_journey_day_settings_admin" on public.community_journey_day_settings for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.protocol_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  helpfulness_rating smallint not null check (helpfulness_rating between 1 and 5),
  recommendation_rating smallint not null check (recommendation_rating between 1 and 5),
  feedback_comment text check (feedback_comment is null or char_length(feedback_comment) <= 1500),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, protocol_id)
);
alter table public.protocol_feedback enable row level security;
drop policy if exists "protocol_feedback_own" on public.protocol_feedback;
create policy "protocol_feedback_own" on public.protocol_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "protocol_feedback_admin_read" on public.protocol_feedback;
create policy "protocol_feedback_admin_read" on public.protocol_feedback for select using (public.is_admin());

create or replace function public.admin_protocol_feedback_summary()
returns table (
  protocol_id uuid,
  response_count bigint,
  overall_average numeric,
  helpfulness_average numeric,
  recommendation_average numeric
)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query
    select f.protocol_id,
           count(*)::bigint,
           round(avg(f.overall_rating)::numeric, 2),
           round(avg(f.helpfulness_rating)::numeric, 2),
           round(avg(f.recommendation_rating)::numeric, 2)
    from public.protocol_feedback f
    group by f.protocol_id;
end; $$;
grant execute on function public.admin_protocol_feedback_summary() to authenticated;

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_hash text not null,
  had_protocol boolean not null default false,
  protocol_ids uuid[] not null default '{}'::uuid[],
  purchase_origin text not null default 'none' check (purchase_origin in ('apple','stripe','mixed','none')),
  completed_protocol_count integer not null default 0,
  exit_reason text not null default 'not_provided' check (exit_reason in ('not_provided','completed_need','no_longer_use','not_found','privacy','technical','other')),
  app_version text,
  deleted_at timestamptz not null default now()
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;
grant select, insert on public.account_deletions to service_role;

create or replace function public.community_journey_payload(target_date date)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare payload jsonb;
begin
  select jsonb_build_object(
    'date', target_date,
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.display_order, i.scheduled_time nulls last, i.created_at) from (
      select id, journey_date, slot_key, scheduled_time, title, short_text, linked_content_type, linked_content_id, linked_url, display_order, show_on_home, show_as_pill, pill_label, validation_enabled, validation_label, completed_label, status, notification_enabled, notification_time, notification_title, notification_body, notification_target_type, notification_target_id, icon_key, is_active, created_at
      from public.community_journey_items where journey_date=target_date and is_active=true and status in ('scheduled','published') order by display_order, scheduled_time nulls last, created_at
    ) i), '[]'::jsonb),
    'settings', coalesce((select to_jsonb(s) || jsonb_strip_nulls(jsonb_build_object('title',nullif(trim(d.title),''),'subtitle',nullif(trim(d.subtitle),''))) from public.community_journey_settings s left join public.community_journey_day_settings d on d.journey_date=target_date where s.id=1), jsonb_build_object('title','Notre journée ensemble','subtitle','Les rendez-vous de la communauté au rythme de ta journée.','show_member_count',true,'member_minimum',50,'timezone_mode','local','empty_message','La journée se vit plus librement aujourd’hui.')),
    'member_count', (select count(*)::integer from public.community_journey_participation p where p.journey_date=target_date),
    'completions', coalesce((select jsonb_agg(jsonb_build_object('journey_item_id',c.journey_item_id,'completed',c.completed,'completed_at',c.completed_at,'updated_at',c.updated_at)) from public.community_journey_completions c where c.user_id=auth.uid() and c.journey_date=target_date), '[]'::jsonb)
  ) into payload;
  return payload;
end; $$;
grant execute on function public.community_journey_payload(date) to anon, authenticated;

commit;
