-- Migration: 022 - Cycles v2 foundation.
-- Ajoute les fondations pour le module "Cycles d'entraînement v2" :
--   - races.priority (A/B/C) — backfill depuis is_main.
--   - phases.focus (text libre) + phases.load_pattern (7 valeurs).
--   - training_plans.status / color / template_id (multi-macrocycles).
--   - nouvelle table mesocycle_weeks (1 row par semaine de phase) + RLS.
--   - backfill des mesocycle_weeks depuis les phases existantes (JSONB weekly_targets).
-- Idempotente (IF NOT EXISTS, ON CONFLICT DO NOTHING) — rejouable sans effet de bord.

-- ─── 1. races.priority ────────────────────────────────────────────────────────
alter table races
  add column if not exists priority text not null default 'C'
    check (priority in ('A','B','C'));

-- Backfill : is_main=true devient priorité A (ne touche pas les rows déjà à 'A'/'B').
update races set priority = 'A' where is_main = true and priority = 'C';

-- ─── 2. phases.focus (libre) ──────────────────────────────────────────────────
alter table phases
  add column if not exists focus text;

-- ─── 3. training_plans : status / color / template_id ─────────────────────────
alter table training_plans
  add column if not exists template_id text,
  add column if not exists status text not null default 'active'
    check (status in ('planned','active','completed','archived')),
  add column if not exists color text;

-- ─── 4. phases.load_pattern ───────────────────────────────────────────────────
alter table phases
  add column if not exists load_pattern text not null default 'custom'
    check (load_pattern in (
      'progressive_3_1','progressive_2_1','taper',
      'maintenance','recovery','competition','custom'
    ));

-- ─── 5. Table mesocycle_weeks ─────────────────────────────────────────────────
create table if not exists mesocycle_weeks (
  id                       uuid primary key default gen_random_uuid(),
  phase_id                 uuid references phases(id) on delete cascade not null,
  week_index               integer not null,
  week_start_date          date not null,
  week_type                text not null default 'load'
    check (week_type in ('load','deload','recovery','taper','race','transition','custom')),
  target_load_tss          integer not null default 0,
  target_volume_km         numeric(8,2) not null default 0,
  target_dplus_m           integer not null default 0,
  comment                  text,
  is_manual_override       boolean not null default false,
  generated_from_pattern   boolean not null default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  unique (phase_id, week_index)
);

create index if not exists idx_mesocycle_weeks_phase
  on mesocycle_weeks(phase_id, week_index);

-- RLS via phase → plan → athlete.
alter table mesocycle_weeks enable row level security;

create policy "mesocycle_weeks_select_via_phase" on mesocycle_weeks for select
  using (exists (
    select 1 from phases ph
    join training_plans tp on tp.id = ph.plan_id
    where ph.id = mesocycle_weeks.phase_id and tp.athlete_id = auth.uid()
  ));

create policy "mesocycle_weeks_insert_via_phase" on mesocycle_weeks for insert
  with check (exists (
    select 1 from phases ph
    join training_plans tp on tp.id = ph.plan_id
    where ph.id = mesocycle_weeks.phase_id and tp.athlete_id = auth.uid()
  ));

create policy "mesocycle_weeks_update_via_phase" on mesocycle_weeks for update
  using (exists (
    select 1 from phases ph
    join training_plans tp on tp.id = ph.plan_id
    where ph.id = mesocycle_weeks.phase_id and tp.athlete_id = auth.uid()
  ));

create policy "mesocycle_weeks_delete_via_phase" on mesocycle_weeks for delete
  using (exists (
    select 1 from phases ph
    join training_plans tp on tp.id = ph.plan_id
    where ph.id = mesocycle_weeks.phase_id and tp.athlete_id = auth.uid()
  ));

create trigger mesocycle_weeks_updated_at
  before update on mesocycle_weeks
  for each row execute procedure moddatetime(updated_at);

-- ─── 6. Backfill mesocycle_weeks depuis les phases existantes ─────────────────
-- Pour chaque phase, génère N rows (N = nb semaines = ceil((end-start)/7)). Reprend
-- les overrides JSONB weekly_targets[i] quand ils existent, sinon les défauts uniformes.
-- ON CONFLICT DO NOTHING pour rester rejouable.
insert into mesocycle_weeks (
  phase_id, week_index, week_start_date,
  week_type, target_load_tss, target_volume_km, target_dplus_m,
  is_manual_override, generated_from_pattern
)
select
  ph.id,
  gs.week_index,
  (ph.start_date + (gs.week_index * 7))::date,
  'load',
  coalesce(ph.weekly_charge_target, 0),
  coalesce(
    (ph.weekly_targets -> gs.week_index ->> 'km')::numeric,
    ph.weekly_distance_km_target,
    0
  ),
  coalesce(
    (ph.weekly_targets -> gs.week_index ->> 'd_plus')::integer,
    ph.weekly_elevation_m_target,
    0
  ),
  -- Une entrée présente dans le JSONB pour cet index = override manuel.
  case when ph.weekly_targets -> gs.week_index is not null then true else false end,
  true
from phases ph
cross join lateral generate_series(
  0,
  greatest(0, ceil(extract(epoch from (ph.end_date - ph.start_date)) / 604800)::int - 1)
) as gs(week_index)
on conflict (phase_id, week_index) do nothing;

-- Verification (à exécuter manuellement après la migration) :
-- select count(*) from mesocycle_weeks;
-- select column_name from information_schema.columns where table_name='races' and column_name='priority';
-- select column_name from information_schema.columns where table_name='phases' and column_name in ('focus','load_pattern');
-- select column_name from information_schema.columns where table_name='training_plans' and column_name in ('status','color','template_id');
