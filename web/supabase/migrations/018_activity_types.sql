-- Migration 018 — Catalogue des types d'activité + préférences user (Phase 2)
--
-- Spec : docs/superpowers/specs/2026-05-17-plan-tab-improvements-part2-design.md §3.1
--
-- PAS de modification du CHECK constraint sur planned_sessions.type ni
-- session_templates.type : les types custom user sont pour la barre de pills
-- du bloc Bibliothèque uniquement (filtrage), pas pour typer une séance.

-- ─── Table catalogue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  default_intensity smallint NOT NULL CHECK (default_intensity BETWEEN 1 AND 5),
  category text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_activity_types_athlete ON activity_types(athlete_id);

-- ─── Table préférences user ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_prefs (
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_slug text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (athlete_id, activity_slug)
);

-- ─── Seed des 9 types système (athlete_id = NULL) ─────────────────────────
INSERT INTO activity_types (athlete_id, slug, label, default_intensity, category, is_system) VALUES
  (NULL, 'sortie_longue', 'Sortie longue', 2, 'run',   true),
  (NULL, 'fractionne',    'Fractionné',    5, 'run',   true),
  (NULL, 'seuil_tempo',   'Seuil',         4, 'run',   true),
  (NULL, 'cotes',         'Côtes',         3, 'run',   true),
  (NULL, 'footing',       'Footing',       2, 'run',   true),
  (NULL, 'velo',          'Vélo',          2, 'bike',  true),
  (NULL, 'natation',      'Natation',      2, 'swim',  true),
  (NULL, 'renfo',         'Renfo',         1, 'other', true),
  (NULL, 'musculation',   'Musculation',   1, 'other', true)
ON CONFLICT (athlete_id, slug) DO NOTHING;

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_prefs ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les types système + ses propres customs
CREATE POLICY "activity_types: read system + own" ON activity_types
  FOR SELECT USING (athlete_id IS NULL OR athlete_id = auth.uid());

-- Écriture : uniquement sur ses propres lignes (les types système restent intouchables)
CREATE POLICY "activity_types: insert own" ON activity_types
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "activity_types: update own" ON activity_types
  FOR UPDATE USING (athlete_id = auth.uid());

CREATE POLICY "activity_types: delete own" ON activity_types
  FOR DELETE USING (athlete_id = auth.uid() AND is_system = false);

-- user_activity_prefs : full CRUD scopé user
CREATE POLICY "user_activity_prefs: own" ON user_activity_prefs
  FOR ALL USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
