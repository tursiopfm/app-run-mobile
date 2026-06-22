-- 045 : trace GPS dense d'une course (profil altimétrique réel). 1 ligne/course.
-- profile_gz = base64(gzip(JSON {d:number[] km, e:number[] m})), miroir de
-- activity_streams.streams_gz. Le D+/D- officiel reste dans races/race_waypoints.
create table if not exists race_tracks (
  race_id     uuid primary key references races(id) on delete cascade,
  profile_gz  text not null,
  point_count integer not null,
  source      text not null,              -- 'gpx_upload' | 'gpx_url' | 'utmb_auto'
  distance_m  integer,                    -- distance brute du GPX (avant scaling)
  created_at  timestamptz not null default now()
);

alter table race_tracks enable row level security;

-- Accès réservé au propriétaire de la course (miroir des policies race_waypoints / 025).
create policy "race_tracks_select_own" on race_tracks for select
  using (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()));
create policy "race_tracks_modify_own" on race_tracks for all
  using (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()))
  with check (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()));
