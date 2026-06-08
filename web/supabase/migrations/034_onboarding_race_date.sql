-- Lot 3 onboarding fonctionnel.
-- 1) Date de course optionnelle (proposition B) : graine future de la Structure Prépa.
alter table profiles
  add column if not exists onboarding_race_date date;

-- 2) Renommage de l'id mission « marathon » → « route »
--    (libellé « Préparer une course sur route », couvre 10 km / semi / marathon).
update profiles set onboarding_mission = 'route' where onboarding_mission = 'marathon';
