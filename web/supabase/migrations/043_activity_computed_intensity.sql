-- Migration: 043 - activity_computed_intensity
-- Intensité calculée et persistée par activité (clé IntensityKey :
-- recuperation | footing | endurance_active | seuil | vma). Écrite par
-- recalculateUserEffortScores depuis le stream FC réel quand il existe (le plus
-- juste), sinon depuis l'estimation FC moyenne — même cascade que la vue détail.
-- Permet à la liste d'activités d'afficher la MÊME valeur que le détail sans
-- charger les streams. Nullable : les lignes non encore recalculées retombent
-- sur l'estimation client (guessIntensity). NULL = manuel/override géré ailleurs
-- via manual_intensity.
alter table activities add column if not exists computed_intensity text;

-- Rafraîchir le cache de schéma PostgREST pour exposer la colonne immédiatement.
notify pgrst, 'reload schema';
