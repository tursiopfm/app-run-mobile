-- 027_backfill_onboarding_skipped.sql
-- Backfill : les comptes existants (créés avant la feature onboarding Strava)
-- ne doivent PAS être renvoyés sur /onboarding. On les marque comme « passés ».
-- Les comptes créés après cette migration gardent le défaut false (cf. 026) et
-- verront donc la page d'onboarding tant que Strava n'est pas connecté.
-- Migration one-shot à exécuter une seule fois.
update profiles set onboarding_skipped = true where onboarding_skipped = false;
