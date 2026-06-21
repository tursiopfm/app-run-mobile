-- 044 : altitude absolue (m) par waypoint. NULL si la source ne la fournit pas
-- (UTMB, imports LLM, historique). Le profil retombe alors sur le relatif (d+ − d−).
alter table race_waypoints
  add column if not exists altitude integer;

comment on column race_waypoints.altitude is
  'Altitude absolue en mètres au point ; NULL si inconnue (mode relatif d+−d−).';
