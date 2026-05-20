-- Migration: 021 - Cibles km/D+ semaine par semaine (overrides par phase).
-- Ajoute une colonne `weekly_targets` JSONB sur `phases` pour permettre à
-- l'utilisateur d'éditer les objectifs km et D+ semaine par semaine au sein
-- d'une phase (au lieu de la cible uniforme `weekly_distance_km_target` /
-- `weekly_elevation_m_target` de la migration 015).
--
-- Format : array d'objets `[{ "km": number, "d_plus": number }, ...]`
-- indexé par numéro de semaine dans la phase (0-based). Si l'array est vide
-- ou plus court que le nombre de semaines, les semaines non couvertes
-- retombent sur la cible uniforme de la phase.
--
-- Defaults à `[]` pour les phases existantes — la phase continue d'utiliser
-- ses cibles uniformes jusqu'à ce que l'utilisateur édite une semaine.
-- IF NOT EXISTS pour rester idempotent.

alter table phases
  add column if not exists weekly_targets jsonb not null default '[]'::jsonb;

-- Verification:
-- select column_name, data_type, column_default
--   from information_schema.columns
--   where table_name = 'phases'
--     and column_name = 'weekly_targets';
