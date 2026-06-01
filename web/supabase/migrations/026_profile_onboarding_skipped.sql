-- 026_profile_onboarding_skipped.sql
-- Flag : l'utilisateur a passé l'étape d'onboarding « Connecter Strava ».
-- Empêche la page /onboarding de réapparaître une fois passée définitivement.
alter table profiles
  add column if not exists onboarding_skipped boolean not null default false;
