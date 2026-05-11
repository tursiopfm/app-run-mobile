-- 011_add_manual_workout_type.sql
-- Ajoute la colonne manual_workout_type pour séparer le type de séance de l'intensité cardio.
-- Les manual_intensity mal catégorisées (sortie_longue, cotes) sont rapatriées en workout_type.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS manual_workout_type text;

UPDATE activities
  SET manual_workout_type = 'sortie_longue', manual_intensity = NULL
  WHERE manual_intensity = 'sortie_longue';

UPDATE activities
  SET manual_workout_type = 'cotes', manual_intensity = NULL
  WHERE manual_intensity = 'cotes';
