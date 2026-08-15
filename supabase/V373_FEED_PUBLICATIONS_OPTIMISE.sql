-- V373 — FEED / PUBLICATIONS
-- À exécuter UNE FOIS dans Supabase SQL Editor AVANT de tester le patch V373.
--
-- Ce patch NE MODIFIE PAS le compteur brut du Feed.
-- Aucun système "Relier cette publication à..." n'est ajouté.
--
-- Ajouts :
-- - pagination réelle 5 par 5 côté Supabase ;
-- - chargement léger partagé pour Capsules + Échos du journal ;
-- - publication programmée ;
-- - mise en avant temporaire ;
-- - notification push facultative ;
-- - notification des publications programmées via un petit dispatcher toutes les 5 min.

begin;

alter table public.posts
  add column if not exists published_at timestamptz null;

alter table public.posts
  add column if not exists featured_until timestamptz null;

alter table public.posts
  add column if not exists notify_on_publish boolean not null default false;

alter table public.posts
  add column if not exists notification_sent_at timestamptz null;

alter table public.posts
  add column if not exists updated_at timestamptz not null default now();

-- Les anciens posts restent publiés à leur date historique.
update public.posts
set published_at = coalesce(published_at, created_at, now())
where published_at is null;

create index if not exists posts_feed_publication_idx
  on public.posts(active, published_at desc, created_at desc);

create index if not exists posts_feed_featured_idx
  on public.posts(featured_until desc)
  where active = true;

-- Feed PUBLIC comme actuellement :
-- visiteurs non connectés + utilisateurs connectés voient uniquement
-- les publications actives dont la date/heure de publication est arrivée.
-- Les autres rubriques de l'app gardent leurs propres protections.
drop policy if exists "posts_read_paid_admin" on public.posts;
drop policy if exists "posts_read_public" on public.posts;
drop policy if exists "posts_public_read_published" on public.posts;

create policy "posts_read_public"
on public.posts
for select
to anon, authenticated
using (
  active = true
  and coalesce(published_at, created_at) <= now()
);

-- Lecture nécessaire aux RPC du Feed et au chargement à la demande d'un post.
grant select on public.posts to anon, authenticated;

-- 1 requête = 5 publications + compteur total.
-- Les posts mis en avant et encore valides remontent en premier.
create or replace function public.feed_posts_page(
  p_offset integer default 0,
  p_limit integer default 5
)
returns table(
  id uuid,
  title text,
  content text,
  type text,
  image_url text,
  media_urls jsonb,
  created_at timestamptz,
  published_at timestamptz,
  featured_until timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.content,
    p.type,
    p.image_url,
    p.media_urls,
    p.created_at,
    p.published_at,
    p.featured_until,
    count(*) over() as total_count
  from public.posts p
  where p.active = true
    and coalesce(p.published_at, p.created_at) <= now()
  order by
    (p.featured_until is not null and p.featured_until > now()) desc,
    coalesce(p.published_at, p.created_at) desc,
    p.created_at desc
  offset greatest(0, coalesce(p_offset,0))
  limit least(10, greatest(1, coalesce(p_limit,5)));
$$;

grant execute
on function public.feed_posts_page(integer,integer)
to anon, authenticated;

-- Une seule lecture légère partagée par les Capsules du jour et les Échos.
-- Pas de médias et seulement un extrait du texte.
create or replace function public.feed_support_posts(
  p_limit integer default 16
)
returns table(
  id uuid,
  title text,
  content text,
  type text,
  created_at timestamptz,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.title,
    left(coalesce(p.content,''), 700) as content,
    p.type,
    p.created_at,
    p.published_at
  from public.posts p
  where p.active = true
    and coalesce(p.published_at, p.created_at) <= now()
  order by
    coalesce(p.published_at, p.created_at) desc,
    p.created_at desc
  limit least(24, greatest(4, coalesce(p_limit,16)));
$$;

grant execute
on function public.feed_support_posts(integer)
to anon, authenticated;

-- ---------------------------------------------------------------
-- Notifications programmées
-- ---------------------------------------------------------------
-- L'Edge Function send-push-notifications existe déjà dans ce projet.
-- Ce dispatcher ne fait AUCUN appel réseau quand aucun post n'est dû.
-- Il tourne toutes les 5 minutes et traite au maximum 10 posts.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.mt_post_notification_route(p_type text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_type,'')))
    when 'hydratation' then 'hydratation'
    when 'fuel du jour' then 'fuel'
    when 'fuel' then 'fuel'
    when 'routine' then 'routine'
    when 'conseil' then 'conseil'
    when 'conseil du jour' then 'conseil'
    when 'conseil privé' then 'conseil'
    when 'drop exclusif' then 'drop'
    when 'mindset' then 'mindset'
    when 'mouvement' then 'mouvement'
    when 'sweet switch' then 'sweet-switch'
    when 'recette' then 'recettes'
    when 'contenu privé' then 'contenu-prive'
    when 'challenge' then 'challenge'
    when 'nutrition' then 'nutrition'
    when 'pharmacopée' then 'pharmacopee'
    when 'bien-être' then 'bien-etre'
    when 'méthode tee' then 'methode-tee'
    else 'journal'
  end;
$$;

create or replace function public.mt_post_notification_body(
  p_type text,
  p_title text
)
returns text
language sql
immutable
as $$
  select
    (
      case lower(trim(coalesce(p_type,'')))
        when 'hydratation' then 'Un rappel douceur t’attend 💧'
        when 'fuel du jour' then 'Ton fuel du jour est prêt 🌿'
        when 'fuel' then 'Ton fuel du jour est prêt 🌿'
        when 'routine' then 'Un nouveau rituel t’attend 🌙'
        when 'conseil' then 'Un conseil vient d’être ajouté ✨'
        when 'conseil du jour' then 'Un conseil du jour t’attend ✨'
        when 'conseil privé' then 'Un conseil privé vient d’être ajouté ✨'
        when 'drop exclusif' then 'Un drop exclusif vient d’arriver ✶'
        when 'mindset' then 'Une note mindset t’attend 🕊️'
        when 'mouvement' then 'Un geste mouvement t’attend 🚶🏽‍♀️'
        when 'sweet switch' then 'Ton sweet switch du jour est prêt 🍫'
        when 'recette' then 'Une nouvelle recette est disponible 🥣'
        when 'nutrition' then 'Un nouveau repère nutrition t’attend 🥑'
        when 'pharmacopée' then 'Une nouvelle note de pharmacopée t’attend 🌿'
        when 'bien-être' then 'Un nouveau repère bien-être t’attend ✨'
        when 'méthode tee' then 'Une nouvelle publication Méthode Tee t’attend ✶'
        else 'Une nouvelle publication t’attend ✨'
      end
    )
    || E'\n'
    || coalesce(nullif(trim(p_title),''),'Nouveau contenu');
$$;

create or replace function public.mt_dispatch_due_post_notifications()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  r record;
  request_id bigint;
  sent_count integer := 0;
  dom_id text;
  route text;
  body_text text;
  emoji text;
begin
  for r in
    select p.id,p.title,p.type,p.published_at
    from public.posts p
    where p.active = true
      and p.notify_on_publish = true
      and p.notification_sent_at is null
      and coalesce(p.published_at,p.created_at) <= now() - interval '1 minute'
    order by coalesce(p.published_at,p.created_at) asc
    limit 10
  loop
    dom_id := 'post-' || lower(r.id::text);
    route := public.mt_post_notification_route(r.type);
    body_text := public.mt_post_notification_body(r.type,r.title);
    emoji := case lower(trim(coalesce(r.type,'')))
      when 'hydratation' then '💧'
      when 'fuel du jour' then '🌿'
      when 'mouvement' then '🚶🏽‍♀️'
      when 'sweet switch' then '🍫'
      when 'recette' then '🥣'
      when 'nutrition' then '🥑'
      when 'pharmacopée' then '🌿'
      else '✶'
    end;

    select net.http_post(
      url := 'https://tyuvlmmmyygqqhuetwoe.supabase.co/functions/v1/send-push-notifications',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dXZsbW1teXlncXFodWV0d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDA5NTQsImV4cCI6MjA5NTg3Njk1NH0.zyyFmDqM96TjYSqJW8_bfG330E4jLBheQ_c6qmyQ7W4',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dXZsbW1teXlncXFodWV0d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDA5NTQsImV4cCI6MjA5NTg3Njk1NH0.zyyFmDqM96TjYSqJW8_bfG330E4jLBheQ_c6qmyQ7W4'
      ),
      body := jsonb_build_object(
        'title', emoji || ' Méthode Tee',
        'body', body_text,
        'url', '/index.html?mt_post=' || dom_id || '&mt_route=' || route || '#' || dom_id
      )
    )
    into request_id;

    if request_id is not null then
      update public.posts
      set notification_sent_at = now(),
          updated_at = now()
      where id = r.id
        and notification_sent_at is null;
      sent_count := sent_count + 1;
    end if;
  end loop;

  return sent_count;
end;
$$;

revoke all
on function public.mt_dispatch_due_post_notifications()
from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'mt-feed-scheduled-push-v373'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'mt-feed-scheduled-push-v373',
    '*/5 * * * *',
    'select public.mt_dispatch_due_post_notifications();'
  );
end;
$$;

notify pgrst,'reload schema';

commit;
