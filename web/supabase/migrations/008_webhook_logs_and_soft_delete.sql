-- 008_webhook_logs_and_soft_delete.sql
-- 1) Soft-delete sur activities (sync Strava + suppressions webhook)
-- 2) Table webhook_logs (audit des événements reçus, vu dans /admin)

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_activities_user_active
  ON activities(user_id, start_time DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id          uuid default uuid_generate_v4() primary key,
  provider    text not null,
  event_type  text,
  user_id     uuid references profiles(id) on delete set null,
  status_code integer,
  payload     jsonb,
  created_at  timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at
  ON webhook_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_errors
  ON webhook_logs(status_code, created_at DESC)
  WHERE status_code >= 500;

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasse RLS automatiquement; on n'expose rien aux clients
-- (l'admin lit via service role côté serveur Next.js)
