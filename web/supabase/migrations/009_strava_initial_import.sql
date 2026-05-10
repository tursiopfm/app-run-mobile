-- 009_strava_initial_import.sql
-- Colonnes pour suivre l'import initial complet de l'historique Strava.
-- Le cron /api/cron/strava-import lit/met à jour ces colonnes pour
-- avancer page par page jusqu'à épuisement des activités.

ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS import_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS import_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_oldest_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_last_error TEXT,
  ADD COLUMN IF NOT EXISTS import_updated_at TIMESTAMPTZ;

-- Contrainte sur les valeurs de import_status
ALTER TABLE provider_connections
  DROP CONSTRAINT IF EXISTS provider_connections_import_status_check;
ALTER TABLE provider_connections
  ADD CONSTRAINT provider_connections_import_status_check
  CHECK (import_status IN ('idle', 'pending', 'in_progress', 'completed', 'error'));

-- Index pour le scan du cron (filtre les jobs actifs uniquement)
CREATE INDEX IF NOT EXISTS idx_provider_connections_import_pending
  ON provider_connections (import_status, import_updated_at)
  WHERE import_status IN ('pending', 'in_progress');
