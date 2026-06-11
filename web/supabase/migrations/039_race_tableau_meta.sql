-- Migration: 039 - race_tableau_meta
-- Provenance + fraîcheur d'un tableau de course importé. 1:1 avec races.
-- RLS par jointure sur races.athlete_id (même pattern que race_waypoints).

create table if not exists race_tableau_meta (
  race_id           uuid primary key references races(id) on delete cascade,
  edition_year      integer,
  edition_date      date,
  date_explicit     boolean not null default false,
  freshness_status  text not null
                    check (freshness_status in
                      ('confirmed','provisional_previous_edition','unknown')),
  source_url        text,
  source_checked_at timestamptz not null default now(),
  source_hash       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table race_tableau_meta enable row level security;

create policy "tableau_meta_select_own" on race_tableau_meta for select
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_insert_own" on race_tableau_meta for insert
  with check (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_update_own" on race_tableau_meta for update
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_delete_own" on race_tableau_meta for delete
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
