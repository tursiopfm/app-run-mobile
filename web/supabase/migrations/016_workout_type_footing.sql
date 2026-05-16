-- Migration: 016 - Ajoute le type 'footing' aux CHECK constraints planned_sessions.type et session_templates.type.
-- L'enum WorkoutType (lib/activities/intensity.ts) gagne la valeur 'footing' pour différencier
-- une sortie facile Z2 d'une sortie longue ou d'un seuil. Côté activities.manual_workout_type
-- il n'y a pas de CHECK (colonne text libre, cf. migration 011) donc rien à toucher là-bas.
--
-- Les constraints visées portent les noms par défaut Postgres :
--   - planned_sessions_type_check
--   - session_templates_type_check
-- (Postgres nomme `<table>_<column>_check` quand on ne nomme pas explicitement la contrainte.)

-- ─── planned_sessions.type ───────────────────────────────────────────────────
alter table planned_sessions drop constraint if exists planned_sessions_type_check;
alter table planned_sessions add constraint planned_sessions_type_check
  check (type in ('sortie_longue','fractionne','seuil_tempo','cotes','course','runtaf','velotaf','footing'));

-- ─── session_templates.type ──────────────────────────────────────────────────
alter table session_templates drop constraint if exists session_templates_type_check;
alter table session_templates add constraint session_templates_type_check
  check (type in ('sortie_longue','fractionne','seuil_tempo','cotes','course','runtaf','velotaf','footing'));

-- Verification:
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname in ('planned_sessions_type_check','session_templates_type_check');
