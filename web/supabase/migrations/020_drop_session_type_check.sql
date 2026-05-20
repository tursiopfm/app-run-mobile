-- Migration 020 : drop le CHECK constraint sur planned_sessions.type et
-- session_templates.type pour autoriser les slugs custom du catalogue
-- activity_types.
--
-- Contexte : depuis la feature "custom activity types" (Plan tab), l'athlète
-- peut créer un type d'activité personnalisé (ex. 'tennis-mwafg', 'trail-race-xyz')
-- et l'utiliser dans une séance planifiée. L'ancienne CHECK constraint
-- enumère uniquement les 12 builtins (mig 017) et rejette tout slug custom
-- avec une erreur 23514.
--
-- Validation : la validation des types se fait désormais côté application via
-- le resolver `resolveSessionMeta` qui consulte la table `activity_types`.
-- Un slug orphelin (custom supprimé alors qu'une séance le référence) est
-- géré gracieusement (label = slug, couleur gris, category = 'other').
--
-- Idempotent : DROP CONSTRAINT IF EXISTS.

alter table planned_sessions  drop constraint if exists planned_sessions_type_check;
alter table session_templates drop constraint if exists session_templates_type_check;
