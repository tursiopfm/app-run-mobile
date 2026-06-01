-- 028_provider_connection_unique_athlete.sql
-- Règle « 1 compte Strava = 1 utilisateur » : un même athlète provider
-- (provider + provider_user_id) ne peut être lié qu'à un seul user.
-- L'upsert du callback (onConflict user_id,provider) lèvera 23505 sur cet index
-- si un autre user tente de lier un athlète déjà rattaché → message clair.
create unique index if not exists provider_connections_provider_user_unique
  on provider_connections (provider, provider_user_id);
