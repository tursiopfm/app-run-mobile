-- Migration: 035 - pacing course + contenu ravito waypoints
-- races : heure de départ, temps cible total, coefficient de fade (pacing).
-- race_waypoints : contenu du ravito (solide/liquide/base vie) + override
-- manuel de l'heure de passage (secondes écoulées depuis le départ).
-- Rappel : d_plus / d_moins restent CUMULÉS (cf. migration 025).

alter table races
  add column if not exists start_time          time,
  add column if not exists target_duration_min integer,
  add column if not exists pacing_fade         numeric not null default 0;

alter table race_waypoints
  add column if not exists supplies            text[]  not null default '{}',
  add column if not exists target_override_sec integer;
