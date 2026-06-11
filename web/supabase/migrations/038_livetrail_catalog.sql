-- Catalogue LiveTrail : index léger (nom→événement) pour résoudre une course sans OpenAI.
-- Grain = une course-édition. AUCUN waypoint stocké (re-fetch frais à l'import).
-- Écritures réservées au service role ; lecture pour les utilisateurs authentifiés.
create extension if not exists pg_trgm;

create table if not exists livetrail_catalog (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'livetrail',
  event_slug    text not null,
  event_name    text,
  course_name   text,
  edition_year  integer,
  total_km      numeric(6,2),
  total_dplus   integer,
  source_url    text not null,
  search_text   text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- NULLS NOT DISTINCT (PG15+) : une course sans année/nom ne se duplique pas, et
-- la cible d'onConflict reste des colonnes réelles (upsert PostgREST).
create unique index if not exists livetrail_catalog_uniq
  on livetrail_catalog (platform, event_slug, course_name, edition_year) nulls not distinct;

create index if not exists livetrail_catalog_search
  on livetrail_catalog using gin (search_text gin_trgm_ops);

alter table livetrail_catalog enable row level security;

create policy "livetrail_catalog_select_auth" on livetrail_catalog
  for select to authenticated using (true);
