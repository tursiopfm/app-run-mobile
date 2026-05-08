-- 005_profile_threshold_pace.sql
-- Allure seuil personnalisée par sport (secondes par km)
-- NULL = utiliser la valeur par défaut du sport config
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS threshold_pace_run_sec_per_km   integer,
  ADD COLUMN IF NOT EXISTS threshold_pace_trail_sec_per_km integer;

COMMENT ON COLUMN profiles.threshold_pace_run_sec_per_km
  IS 'Allure seuil course à pied en s/km (ex: 270 = 4:30/km). NULL = défaut config.';
COMMENT ON COLUMN profiles.threshold_pace_trail_sec_per_km
  IS 'Allure seuil trail en s/km. NULL = défaut config.';
