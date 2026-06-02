-- MÉTHODE TEE V15 — Secure Backend / Stripe / Signed Storage / Logs
create extension if not exists "pgcrypto";

-- Paiements Stripe
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  purchase_type text,
  protocol_id uuid,
  amount_total integer,
  currency text,
  status text,
  raw jsonb,
  created_at timestamptz default now()
);

-- Logs sécurité / rate-limit
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_key text,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_security_events_actor_action_time
on public.security_events(actor_key, action, created_at desc);

-- Hardening profils/protocoles/contenus
alter table if exists public.payments enable row level security;
alter table if exists public.security_events enable row level security;

drop policy if exists "payments_own_admin_read" on public.payments;
create policy "payments_own_admin_read"
on public.payments for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments_admin_manage" on public.payments;
create policy "payments_admin_manage"
on public.payments for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "security_events_admin_read" on public.security_events;
create policy "security_events_admin_read"
on public.security_events for select
using (public.is_admin());

drop policy if exists "security_events_admin_manage" on public.security_events;
create policy "security_events_admin_manage"
on public.security_events for all
using (public.is_admin())
with check (public.is_admin());

-- Storage privé conseillé pour protocol-files
insert into storage.buckets (id, name, public)
values ('protocol-files','protocol-files',false)
on conflict(id) do update set public = false;

-- Media publics uniquement pour posts/protocol covers
insert into storage.buckets (id, name, public)
values
('post-media','post-media',true),
('protocol-media','protocol-media',true)
on conflict(id) do update set public = true;

-- Storage policies
drop policy if exists "protocol_files_signed_read_only" on storage.objects;
create policy "protocol_files_signed_read_only"
on storage.objects for select
using (
  bucket_id = 'protocol-files'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.protocol_contents pc
      join public.user_protocols up on up.protocol_id = pc.protocol_id
      where up.user_id = auth.uid()
      and up.status = 'active'
      and pc.file_path = storage.objects.name
    )
  )
);

drop policy if exists "protocol_files_admin_insert" on storage.objects;
create policy "protocol_files_admin_insert"
on storage.objects for insert
with check (bucket_id = 'protocol-files' and public.is_admin());

drop policy if exists "protocol_files_admin_update" on storage.objects;
create policy "protocol_files_admin_update"
on storage.objects for update
using (bucket_id = 'protocol-files' and public.is_admin())
with check (bucket_id = 'protocol-files' and public.is_admin());

drop policy if exists "protocol_files_admin_delete" on storage.objects;
create policy "protocol_files_admin_delete"
on storage.objects for delete
using (bucket_id = 'protocol-files' and public.is_admin());

drop policy if exists "public_media_read" on storage.objects;
create policy "public_media_read"
on storage.objects for select
using (bucket_id in ('post-media','protocol-media'));

drop policy if exists "public_media_admin_insert" on storage.objects;
create policy "public_media_admin_insert"
on storage.objects for insert
with check (bucket_id in ('post-media','protocol-media') and public.is_admin());

drop policy if exists "public_media_admin_update" on storage.objects;
create policy "public_media_admin_update"
on storage.objects for update
using (bucket_id in ('post-media','protocol-media') and public.is_admin())
with check (bucket_id in ('post-media','protocol-media') and public.is_admin());

drop policy if exists "public_media_admin_delete" on storage.objects;
create policy "public_media_admin_delete"
on storage.objects for delete
using (bucket_id in ('post-media','protocol-media') and public.is_admin());

notify pgrst, 'reload schema';
