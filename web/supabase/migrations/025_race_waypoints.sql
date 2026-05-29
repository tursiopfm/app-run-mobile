-- Migration: 025 - race_waypoints
-- Tableau des points de passage d'une course objectif (ravitos, BH, dénivelés cumulés).
-- Lié à la table races. RLS via jointure sur races.athlete_id.

create table if not exists race_waypoints (
  id           uuid primary key default gen_random_uuid(),
  race_id      uuid references races(id) on delete cascade not null,
  order_index  integer not null,
  name         text not null,
  km           numeric(8,3) not null,
  km_inter     numeric(8,3),
  d_plus       integer,
  d_moins      integer,
  cutoff_raw   text,
  cutoff_kind  text check (cutoff_kind in ('clock_time','elapsed','unknown')),
  type         text not null check (type in ('depart','ravito','pointage','arrivee','autre')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_race_waypoints_race
  on race_waypoints(race_id, order_index);

alter table race_waypoints enable row level security;

create policy "waypoints_select_own" on race_waypoints for select
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_insert_own" on race_waypoints for insert
  with check (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_update_own" on race_waypoints for update
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_delete_own" on race_waypoints for delete
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
