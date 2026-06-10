-- 035_garmin_sport_type_canonical.sql
-- Les activités importées depuis l'export GDPR Garmin (Phase 1) ont été stockées avec
-- le sport_type natif Garmin (ex 'running', 'trail_running', 'cycling'), qui ne matche
-- pas SPORT_TYPE_MAP (['Run','TrailRun'], ['Ride','VirtualRide'], ['Swim']) → ces
-- activités étaient exclues des blocs Cockpit/Charge par sport (le graphe "Cumul
-- km/année — Course" ne montrait que les années Strava).
--
-- On normalise vers les types canoniques (style Strava), même logique substring que
-- garminSportToCanonical() dans web/lib/garmin-import/mapper.ts. Le type Garmin brut
-- reste disponible dans raw_payload.summary.activityType. Le CES n'a pas besoin d'être
-- recalculé : sa catégorie (effort-score normalizeSportType) est inchangée.

UPDATE activities SET sport_type = CASE
  WHEN lower(sport_type) LIKE '%trail%'                                                                 THEN 'TrailRun'
  WHEN lower(sport_type) LIKE '%run%'                                                                   THEN 'Run'
  WHEN lower(sport_type) LIKE '%hik%'                                                                   THEN 'Hike'
  WHEN lower(sport_type) LIKE '%walk%'                                                                  THEN 'Walk'
  WHEN lower(sport_type) LIKE '%virtual%' AND (lower(sport_type) LIKE '%rid%' OR lower(sport_type) LIKE '%cycl%' OR lower(sport_type) LIKE '%bik%') THEN 'VirtualRide'
  WHEN lower(sport_type) LIKE '%indoor%'  AND (lower(sport_type) LIKE '%cycl%' OR lower(sport_type) LIKE '%bik%')                                   THEN 'VirtualRide'
  WHEN lower(sport_type) LIKE '%cycl%' OR lower(sport_type) LIKE '%bik%'                                THEN 'Ride'
  WHEN lower(sport_type) LIKE '%swim%'                                                                  THEN 'Swim'
  ELSE sport_type
END
WHERE provider = 'garmin';
