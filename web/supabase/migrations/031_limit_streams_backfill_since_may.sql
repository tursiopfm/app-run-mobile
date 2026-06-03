-- 031_limit_streams_backfill_since_may.sql
-- Limite le backfill des streams aux activités depuis le 2026-05-01
-- (mai + juin + toutes les activités à venir) pour épargner l'API Strava :
-- on ne rattrape PAS les ~11k activités d'historique ancien.
-- Le plancher est une borne basse → les nouvelles activités restent couvertes.

CREATE OR REPLACE FUNCTION activities_missing_streams(p_limit int)
RETURNS TABLE(id uuid, user_id uuid, provider_activity_id text)
LANGUAGE sql STABLE
AS $$
  SELECT a.id, a.user_id, a.provider_activity_id
  FROM activities a
  WHERE a.provider = 'strava'
    AND a.deleted_at IS NULL
    AND a.start_time >= '2026-05-01'
    AND NOT EXISTS (SELECT 1 FROM activity_streams s WHERE s.activity_id = a.id)
  ORDER BY a.start_time DESC
  LIMIT p_limit;
$$;
