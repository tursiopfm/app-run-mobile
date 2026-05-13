-- 012_workout_type_backfill_swim_and_fractionne_cotes.sql
-- Backfill deux cas où le manual_workout_type stocké ne correspond plus aux règles actuelles :
--   1. Toutes les activités de natation (sport effectif = Swim) doivent être "Non défini"
--      → on force le sentinel 'none' pour bypasser toute auto-détection future.
--   2. Les activités dont le titre contient un mot-clé fractionné ET un mot-clé côte
--      étaient classées 'cotes' (ancienne priorité) ; elles doivent maintenant être
--      'fractionne' (le mot-clé fractionné est prépondérant).

-- ─── PRÉVISUALISATION (exécuter d'abord, commenter ensuite) ──────────────────
-- 1. Aperçu Natation → 'none'
-- SELECT id, start_time, name, sport_type, manual_sport_type, manual_workout_type
--   FROM activities
--   WHERE COALESCE(manual_sport_type, sport_type) = 'Swim'
--     AND (manual_workout_type IS NULL OR manual_workout_type <> 'none')
--   ORDER BY start_time DESC;

-- 2. Aperçu "Fractionné en côte" → 'fractionne'
-- SELECT id, start_time, name, manual_workout_type
--   FROM activities
--   WHERE manual_workout_type = 'cotes'
--     AND name ~* '(fractionn|vma|interval|répétition|repetition)'
--     AND name ~* '(côtes|côte|cotes|cote|montée|montee|hill)'
--   ORDER BY start_time DESC;

-- ─── MIGRATION ───────────────────────────────────────────────────────────────
-- 1. Natation → 'none'
UPDATE activities
  SET manual_workout_type = 'none'
  WHERE COALESCE(manual_sport_type, sport_type) = 'Swim'
    AND (manual_workout_type IS NULL OR manual_workout_type <> 'none');

-- 2. "Fractionné en côte" stocké comme 'cotes' → 'fractionne'
UPDATE activities
  SET manual_workout_type = 'fractionne'
  WHERE manual_workout_type = 'cotes'
    AND name ~* '(fractionn|vma|interval|répétition|repetition)'
    AND name ~* '(côtes|côte|cotes|cote|montée|montee|hill)';
