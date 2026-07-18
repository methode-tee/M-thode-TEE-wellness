create table if not exists public.apple_external_purchase_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid references public.external_purchase_intents(id) on delete set null,
  token_type text not null check (token_type in ('ACQUISITION','SERVICES')),
  token_value text not null unique,
  report_status text not null default 'pending' check (report_status in ('pending','reported','failed','expired')),
  report_attempts integer not null default 0,
  last_report_error text,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apple_external_purchase_tokens enable row level security;
revoke all on public.apple_external_purchase_tokens from anon, authenticated;
create index if not exists apple_external_purchase_tokens_user_idx on public.apple_external_purchase_tokens(user_id, created_at desc);
create index if not exists apple_external_purchase_tokens_report_idx on public.apple_external_purchase_tokens(report_status, created_at);
