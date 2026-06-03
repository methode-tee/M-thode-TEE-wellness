
-- V18 Progress + Viewer
create table if not exists protocol_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  protocol_id text not null,
  current_day integer default 1,
  total_days integer default 21,
  streak integer default 0,
  last_checkin timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table protocol_progress enable row level security;

create policy "Users can view own progress"
on protocol_progress for select
using (auth.uid() = user_id);

create policy "Users can update own progress"
on protocol_progress for all
using (auth.uid() = user_id);
