-- 019_seed_missing_activity_types.sql
--
-- Ajoute les 3 types running manquants au catalogue système : Course (chrono),
-- Runtaf (course-aller-bureau) et Velotaf (vélo-aller-bureau). Ces 3 slugs
-- existent dans l'enum SessionType côté code mais n'avaient pas été seedés
-- dans `activity_types` à la migration 018 → les pills correspondantes
-- n'apparaissaient pas dans la bibliothèque, et l'utilisateur devait créer
-- un type custom (avec slug suffixé timestamp) qui ne matchait plus le
-- session.type.
--
-- ON CONFLICT DO NOTHING : idempotent, sans effet si déjà appliqué.

INSERT INTO activity_types (athlete_id, slug, label, default_intensity, category, is_system) VALUES
  (NULL, 'course',  'Course',  4, 'run',  true),
  (NULL, 'runtaf',  'Runtaf',  2, 'run',  true),
  (NULL, 'velotaf', 'Velotaf', 2, 'bike', true)
ON CONFLICT DO NOTHING;
