-- 006_activity_effort_score_version.sql
-- Traçabilité du calcul CES pour permettre le recalcul sélectif
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS effort_score_version    text,
  ADD COLUMN IF NOT EXISTS effort_score_updated_at timestamptz;

COMMENT ON COLUMN activities.effort_score_version
  IS 'Version du modèle CES utilisé pour calculer ces (ex: v2.0-pace-threshold-user).';
COMMENT ON COLUMN activities.effort_score_updated_at
  IS 'Horodatage du dernier calcul CES sur cette activité.';
