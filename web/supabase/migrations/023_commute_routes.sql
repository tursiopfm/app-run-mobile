-- 023_commute_routes.sql
-- ⚠️ Migration NON auto-appliquée. À coller dans le SQL Editor Supabase
--    (ou `supabase db push` si le CLI est lié). Le fichier seul ne suffit pas.
--
-- Trajets domicile-travail (Runtaf à pied, Vélotaf à vélo) :
-- auto-détection à l'import/webhook Strava + titre incrémenté par trajet/an.

create table if not exists commute_routes (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references profiles(id) on delete cascade not null,
  sport_type      text not null,
  label           text not null,
  ref_distance_m  numeric(10,1) not null,
  distance_tol_pct numeric(5,2) not null default 12,
  home_lat        double precision,
  home_lng        double precision,
  office_lat      double precision,
  office_lng      double precision,
  geo_tol_m       numeric(8,1) not null default 250,
  outbound_title  text not null,
  return_title    text not null,
  hour_split      integer not null default 14,
  active          boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Colonnes commute sur activities
alter table activities add column if not exists commute_route_id uuid references commute_routes(id) on delete set null;
alter table activities add column if not exists commute_seq integer;
alter table activities add column if not exists commute_direction text;

-- Index
create index if not exists idx_commute_routes_user on commute_routes(user_id);
create index if not exists idx_activities_commute on activities(user_id, commute_route_id, start_time);

-- RLS
alter table commute_routes enable row level security;

create policy "commute_routes_select_own" on commute_routes for select using (auth.uid() = user_id);
create policy "commute_routes_insert_own" on commute_routes for insert with check (auth.uid() = user_id);
create policy "commute_routes_update_own" on commute_routes for update using (auth.uid() = user_id);
create policy "commute_routes_delete_own" on commute_routes for delete using (auth.uid() = user_id);

-- Trigger updated_at (moddatetime déjà installé par 001_initial_schema.sql)
create trigger commute_routes_updated_at
  before update on commute_routes
  for each row execute procedure moddatetime(updated_at);
