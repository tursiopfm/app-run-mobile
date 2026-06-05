-- Onboarding « Mission Setup » : réponses + gate de complétion.
-- onboarding_completed_at est la source de vérité du gate (null = à faire).
-- Les 4 colonnes onboarding_* stockent les réponses (stockées-seulement en v1).
alter table profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_discipline text,
  add column if not exists onboarding_mission text,
  add column if not exists onboarding_mode text,
  add column if not exists onboarding_data_source text;

-- Backfill : ne pas renvoyer les users existants dans l'onboarding.
-- Un user est « déjà passé » s'il a skippé OU s'il a une connexion Strava.
update profiles p set onboarding_completed_at = now()
where p.onboarding_completed_at is null
  and (p.onboarding_skipped = true
       or exists (select 1 from provider_connections pc
                  where pc.user_id = p.id and pc.provider = 'strava'));
