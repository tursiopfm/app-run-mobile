-- 030_activity_streams.sql
-- Stocke les streams temporels Strava (gzip base64, downsamplé ~1pt/5s)
-- + une fonction de sélection des activités sans streams pour le backfill.

CREATE TABLE IF NOT EXISTS activity_streams (
  activity_id   uuid PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  downsample_s  int  NOT NULL DEFAULT 5,
  point_count   int  NOT NULL DEFAULT 0,
  streams_gz    text NOT NULL,            -- base64( gzip( JSON {time,altitude,heartrate,velocity,distance,grade} ) )
  source        text NOT NULL DEFAULT 'strava',
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_streams_user ON activity_streams(user_id);

ALTER TABLE activity_streams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own streams" ON activity_streams;
CREATE POLICY "own streams" ON activity_streams
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sélection des activités Strava sans streams (pour le backfill, plus récentes d'abord).
CREATE OR REPLACE FUNCTION activities_missing_streams(p_limit int)
RETURNS TABLE(id uuid, user_id uuid, provider_activity_id text)
LANGUAGE sql STABLE
AS $$
  SELECT a.id, a.user_id, a.provider_activity_id
  FROM activities a
  WHERE a.provider = 'strava'
    AND a.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM activity_streams s WHERE s.activity_id = a.id)
  ORDER BY a.start_time DESC
  LIMIT p_limit;
$$;
