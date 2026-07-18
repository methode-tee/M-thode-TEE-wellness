create extension if not exists pgcrypto;

create table if not exists public.apple_external_purchase_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid references public.external_purchase_intents(id) on delete set null,
  token_type text not null check (token_type in ('ACQUISITION','SERVICES')),
  token_value text not null unique,
  external_purchase_id text,
  app_apple_id bigint,
  bundle_id text,
  token_creation_date timestamptz,
  token_expiration_date timestamptz,
  environment text not null default 'production' check (environment in ('sandbox','production')),
  report_status text not null default 'pending' check (report_status in ('pending','reported','failed','expired')),
  report_attempts integer not null default 0,
  last_report_error text,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apple_external_purchase_tokens
  add column if not exists external_purchase_id text,
  add column if not exists app_apple_id bigint,
  add column if not exists bundle_id text,
  add column if not exists token_creation_date timestamptz,
  add column if not exists token_expiration_date timestamptz,
  add column if not exists environment text not null default 'production';

create unique index if not exists apple_external_purchase_tokens_external_id_uidx
  on public.apple_external_purchase_tokens(external_purchase_id)
  where external_purchase_id is not null;
create index if not exists apple_external_purchase_tokens_user_period_idx
  on public.apple_external_purchase_tokens(user_id, token_type, token_expiration_date desc);
create index if not exists apple_external_purchase_tokens_reporting_idx
  on public.apple_external_purchase_tokens(report_status, token_expiration_date);

alter table public.apple_external_purchase_tokens enable row level security;
revoke all on public.apple_external_purchase_tokens from anon, authenticated;

create table if not exists public.apple_external_purchase_reports (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.apple_external_purchase_tokens(id) on delete cascade,
  intent_id uuid references public.external_purchase_intents(id) on delete set null,
  request_identifier uuid not null default gen_random_uuid(),
  report_kind text not null check (report_kind in ('purchase','refund','no_purchase','duplicate','unrecognized')),
  stripe_event_id text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  line_item_id text,
  reference_line_item_id text,
  apple_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','reported','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  apple_response jsonb,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists apple_external_purchase_reports_request_uidx
  on public.apple_external_purchase_reports(request_identifier);
create unique index if not exists apple_external_purchase_reports_event_uidx
  on public.apple_external_purchase_reports(token_id, report_kind, stripe_event_id)
  where stripe_event_id is not null;
create index if not exists apple_external_purchase_reports_queue_idx
  on public.apple_external_purchase_reports(status, next_attempt_at, created_at);
create index if not exists apple_external_purchase_reports_payment_intent_idx
  on public.apple_external_purchase_reports(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.apple_external_purchase_reports enable row level security;
revoke all on public.apple_external_purchase_reports from anon, authenticated;

alter table public.external_purchase_intents
  add column if not exists stripe_session_id text,
  add column if not exists apple_report_status text;
