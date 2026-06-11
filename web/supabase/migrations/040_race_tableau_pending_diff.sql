-- Migration: 040 - race_tableau_meta.pending_diff
-- Diff de re-check en attente de validation utilisateur (Lot 2b). Jamais d'écrasement
-- silencieux : le re-check (Lot 2a) enregistre ici, l'utilisateur valide ensuite.
alter table race_tableau_meta add column if not exists pending_diff    jsonb;
alter table race_tableau_meta add column if not exists pending_diff_at  timestamptz;
