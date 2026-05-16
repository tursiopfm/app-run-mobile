-- Migration: 015 - Objectifs km et D+ hebdomadaires par phase.
-- Ajoute deux colonnes à `phases` pour exprimer les cibles volumiques au-delà du TSS :
--   - weekly_distance_km_target  : km cible par semaine (numeric 8,2)
--   - weekly_elevation_m_target  : D+ cible par semaine (integer m)
-- Defaults à 0 pour les phases existantes — l'utilisateur peut éditer ensuite.
-- IF NOT EXISTS pour rester idempotent si on rejoue la migration.

alter table phases
  add column if not exists weekly_distance_km_target numeric(8,2) not null default 0;

alter table phases
  add column if not exists weekly_elevation_m_target integer not null default 0;

-- Verification:
-- select column_name, data_type, column_default
--   from information_schema.columns
--   where table_name = 'phases'
--     and column_name in ('weekly_distance_km_target','weekly_elevation_m_target');
