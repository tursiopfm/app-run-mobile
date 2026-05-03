-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table if not exists profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text unique not null,
  first_name    text,
  last_name     text,
  avatar_url    text,
  year_goal_km  integer default 3000,
  weight_kg     numeric(5,1),
  resting_hr    integer,
  max_hr        integer,
  threshold_hr  integer,
  ftp_watts     integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Provider connections — generic: strava, garmin, polar, suunto, coros, fit_file
create table if not exists provider_connections (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references profiles(id) on delete cascade not null,
  provider         text not null check (provider in ('strava','garmin','polar','suunto','coros','fit_file')),
  provider_user_id text,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scope            text,
  athlete_data     jsonb,
  connected_at     timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id, provider)
);

-- Activities — normalized, multi-provider
create table if not exists activities (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references profiles(id) on delete cascade not null,
  provider              text not null,
  provider_activity_id  text not null,
  sport_type            text not null,
  name                  text,
  start_time            timestamptz not null,
  duration_sec          integer not null default 0,
  moving_time_sec       integer not null default 0,
  distance_m            numeric(10,1) default 0,
  elevation_gain_m      numeric(8,1) default 0,
  avg_hr                integer,
  max_hr                integer,
  avg_power             integer,
  calories              integer,
  external_training_load numeric(8,2),
  ces                   numeric(8,2),
  raw_payload           jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id, provider, provider_activity_id)
);
create index if not exists idx_activities_user_start on activities(user_id, start_time desc);

-- Activity metrics (per-activity computed values)
create table if not exists activity_metrics (
  id           uuid default uuid_generate_v4() primary key,
  activity_id  uuid references activities(id) on delete cascade not null,
  metric_key   text not null,
  metric_value numeric(12,4),
  computed_at  timestamptz default now(),
  unique (activity_id, metric_key)
);

-- Daily metrics (EWMA ATL/CTL/TSB per user per day)
create table if not exists daily_metrics (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  metric_date date not null,
  atl         numeric(8,2),
  ctl         numeric(8,2),
  tsb         numeric(8,2),
  daily_load  numeric(8,2),
  computed_at timestamptz default now(),
  unique (user_id, metric_date)
);
create index if not exists idx_daily_metrics_user_date on daily_metrics(user_id, metric_date desc);

-- Weekly metrics (snapshot end-of-week)
create table if not exists weekly_metrics (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade not null,
  week_start   date not null,
  run_km       numeric(8,2),
  run_dplus    integer,
  ride_km      numeric(8,2),
  swim_km      numeric(8,2),
  total_ces    numeric(8,2),
  atl_snapshot numeric(8,2),
  ctl_snapshot numeric(8,2),
  tsb_snapshot numeric(8,2),
  computed_at  timestamptz default now(),
  unique (user_id, week_start)
);

-- Webhook events (raw, fast insert, async processing)
create table if not exists webhook_events (
  id          uuid default uuid_generate_v4() primary key,
  provider    text not null,
  event_type  text,
  object_type text,
  object_id   text,
  owner_id    text,
  raw_payload jsonb not null,
  received_at timestamptz default now(),
  processed   boolean default false
);
create index if not exists idx_webhook_unprocessed on webhook_events(provider, processed, received_at);

-- Sync jobs (async processing queue)
create table if not exists sync_jobs (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete set null,
  provider    text not null,
  job_type    text not null,
  status      text not null default 'pending'
              check (status in ('pending','running','done','error')),
  payload     jsonb,
  error_msg   text,
  created_at  timestamptz default now(),
  started_at  timestamptz,
  finished_at timestamptz
);
create index if not exists idx_sync_jobs_status on sync_jobs(status, created_at);

-- Coach messages (chat history)
create table if not exists coach_messages (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  model      text,
  created_at timestamptz default now()
);
create index if not exists idx_coach_messages_user on coach_messages(user_id, created_at desc);

-- Admin logs
create table if not exists admin_logs (
  id          uuid default uuid_generate_v4() primary key,
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz default now()
);

-- Auto-update updated_at on row modification
create extension if not exists moddatetime schema extensions;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure moddatetime(updated_at);

create trigger provider_connections_updated_at
  before update on provider_connections
  for each row execute procedure moddatetime(updated_at);

create trigger activities_updated_at
  before update on activities
  for each row execute procedure moddatetime(updated_at);
