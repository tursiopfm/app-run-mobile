-- Migration: 014 - Onglet Plan (Mode Manuel) : races, training_plans, phases, planned_sessions, session_templates.
-- Crée le schéma de planification (course objectif, macrocycle, phases, séances planifiées, templates).
-- RLS : un athlète n'accède qu'à ses propres rangs (athlete_id = auth.uid()).
-- Les templates système (athlete_id IS NULL) sont visibles en lecture par tous les utilisateurs auth.

-- ─── 1. Races ────────────────────────────────────────────────────────────────
create table if not exists races (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  date        date not null,
  distance_km numeric(8,2) not null,
  elevation_m integer not null default 0,
  type        text not null check (type in ('trail','ultra','route','cross','skyrace')),
  location    text,
  is_main     boolean not null default false,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_races_athlete_date on races(athlete_id, date desc);

-- ─── 2. Training plans (macrocycle) ──────────────────────────────────────────
create table if not exists training_plans (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  goal_race_id uuid references races(id) on delete set null,
  start_date   date not null,
  end_date     date not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_training_plans_athlete on training_plans(athlete_id, start_date desc);

-- ─── 3. Phases (mésocycles) ──────────────────────────────────────────────────
create table if not exists phases (
  id                   uuid primary key default gen_random_uuid(),
  plan_id              uuid references training_plans(id) on delete cascade not null,
  type                 text not null check (type in ('foncier','developpement','specifique','affutage','recuperation')),
  label                text not null,
  start_date           date not null,
  end_date             date not null,
  weekly_charge_target integer not null default 0,
  description          text,
  position             integer not null default 0
);
create index if not exists idx_phases_plan on phases(plan_id, position);

-- ─── 4. Planned sessions ─────────────────────────────────────────────────────
create table if not exists planned_sessions (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid references training_plans(id) on delete cascade,
  athlete_id         uuid references auth.users(id) on delete cascade not null,
  date               date not null,
  type               text not null,
  title              text not null,
  duration_min       integer not null,
  distance_km        numeric(8,2),
  elevation_m        integer,
  intensity          smallint not null check (intensity between 1 and 5),
  estimated_charge   integer not null default 0,
  zones              jsonb,
  notes              text,
  status             text not null default 'planned'
                       check (status in ('planned','completed','skipped','moved')),
  linked_activity_id uuid references activities(id) on delete set null,
  template_id        text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_planned_sessions_athlete_date on planned_sessions(athlete_id, date);
create index if not exists idx_planned_sessions_plan on planned_sessions(plan_id);

-- ─── 5. Session templates ────────────────────────────────────────────────────
-- athlete_id NULL = template système (visible par tous les athlètes).
create table if not exists session_templates (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid references auth.users(id) on delete cascade,
  type                 text not null,
  title                text not null,
  default_duration_min integer not null,
  default_distance_km  numeric(8,2),
  default_elevation_m  integer,
  default_intensity    smallint not null check (default_intensity between 1 and 5),
  default_zones        jsonb,
  description          text,
  tags                 text[],
  created_at           timestamptz default now()
);
create index if not exists idx_session_templates_athlete on session_templates(athlete_id);

-- ─── 6. Auto-update updated_at ───────────────────────────────────────────────
create trigger races_updated_at
  before update on races
  for each row execute procedure moddatetime(updated_at);

create trigger training_plans_updated_at
  before update on training_plans
  for each row execute procedure moddatetime(updated_at);

create trigger planned_sessions_updated_at
  before update on planned_sessions
  for each row execute procedure moddatetime(updated_at);

-- ─── 7. RLS ──────────────────────────────────────────────────────────────────
alter table races              enable row level security;
alter table training_plans     enable row level security;
alter table phases             enable row level security;
alter table planned_sessions   enable row level security;
alter table session_templates  enable row level security;

-- races: own rows only
create policy "races_select_own" on races for select using (auth.uid() = athlete_id);
create policy "races_insert_own" on races for insert with check (auth.uid() = athlete_id);
create policy "races_update_own" on races for update using (auth.uid() = athlete_id);
create policy "races_delete_own" on races for delete using (auth.uid() = athlete_id);

-- training_plans: own rows only
create policy "training_plans_select_own" on training_plans for select using (auth.uid() = athlete_id);
create policy "training_plans_insert_own" on training_plans for insert with check (auth.uid() = athlete_id);
create policy "training_plans_update_own" on training_plans for update using (auth.uid() = athlete_id);
create policy "training_plans_delete_own" on training_plans for delete using (auth.uid() = athlete_id);

-- phases: accès via le plan parent (athlete_id du plan = auth.uid())
create policy "phases_select_via_plan" on phases for select
  using (exists (select 1 from training_plans p where p.id = phases.plan_id and p.athlete_id = auth.uid()));
create policy "phases_insert_via_plan" on phases for insert
  with check (exists (select 1 from training_plans p where p.id = phases.plan_id and p.athlete_id = auth.uid()));
create policy "phases_update_via_plan" on phases for update
  using (exists (select 1 from training_plans p where p.id = phases.plan_id and p.athlete_id = auth.uid()));
create policy "phases_delete_via_plan" on phases for delete
  using (exists (select 1 from training_plans p where p.id = phases.plan_id and p.athlete_id = auth.uid()));

-- planned_sessions: own rows only
create policy "planned_sessions_select_own" on planned_sessions for select using (auth.uid() = athlete_id);
create policy "planned_sessions_insert_own" on planned_sessions for insert with check (auth.uid() = athlete_id);
create policy "planned_sessions_update_own" on planned_sessions for update using (auth.uid() = athlete_id);
create policy "planned_sessions_delete_own" on planned_sessions for delete using (auth.uid() = athlete_id);

-- session_templates: own rows + templates système (athlete_id IS NULL) en lecture
create policy "session_templates_select_own_or_system" on session_templates for select
  using (athlete_id is null or auth.uid() = athlete_id);
create policy "session_templates_insert_own" on session_templates for insert with check (auth.uid() = athlete_id);
create policy "session_templates_update_own" on session_templates for update using (auth.uid() = athlete_id);
create policy "session_templates_delete_own" on session_templates for delete using (auth.uid() = athlete_id);

-- Verification:
-- select table_name from information_schema.tables where table_schema = 'public'
--   and table_name in ('races','training_plans','phases','planned_sessions','session_templates');
