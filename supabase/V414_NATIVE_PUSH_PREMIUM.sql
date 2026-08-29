-- MÉTHODE TEE V414 — tokens APNs natifs iOS
create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios',
  enabled boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_enabled_idx on public.native_push_tokens(user_id,enabled);
alter table public.native_push_tokens enable row level security;

drop policy if exists "native_push_tokens_select_own" on public.native_push_tokens;
create policy "native_push_tokens_select_own" on public.native_push_tokens for select to authenticated using (auth.uid()=user_id);
drop policy if exists "native_push_tokens_delete_own" on public.native_push_tokens;
create policy "native_push_tokens_delete_own" on public.native_push_tokens for delete to authenticated using (auth.uid()=user_id);

create or replace function public.claim_native_push_token(p_token text,p_platform text default 'ios',p_user_agent text default null)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_token),'') is null then raise exception 'TOKEN_REQUIRED'; end if;
  delete from public.native_push_tokens where token=p_token and user_id<>uid;
  insert into public.native_push_tokens(user_id,token,platform,enabled,user_agent,updated_at)
  values(uid,trim(p_token),coalesce(nullif(trim(p_platform),''),'ios'),true,p_user_agent,now())
  on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,enabled=true,user_agent=excluded.user_agent,updated_at=now();
end; $$;
revoke all on function public.claim_native_push_token(text,text,text) from public;
grant execute on function public.claim_native_push_token(text,text,text) to authenticated;

create or replace function public.disable_native_push_tokens_for_current_user()
returns void language sql security definer set search_path=public as $$
  update public.native_push_tokens set enabled=false,updated_at=now() where user_id=auth.uid();
$$;
revoke all on function public.disable_native_push_tokens_for_current_user() from public;
grant execute on function public.disable_native_push_tokens_for_current_user() to authenticated;
