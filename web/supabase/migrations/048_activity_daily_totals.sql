-- 048 : agrégat journalier des activités, calculé côté Postgres.
--
-- Motif : le Cockpit (fetchAllHistorySlim, lib/data/dashboard.ts) rapatriait TOUT
-- l'historique d'activités, paginé par 1000, à chaque rendu — 5 389 lignes / ~1,1 MB
-- pour le plus gros compte, ~40 chargements par jour — uniquement pour en dériver
-- deux agrégats par (jour, sport) : l'historique journalier du bloc Historique et
-- le cumul kilométrique annuel. La même information tient en ~243 kB agrégée.
-- Second poste d'egress Supabase après le recalcul CES (cf. migration 047).
--
-- Découpage des jours : `at time zone 'UTC'` reproduit exactement le comportement
-- de production, où localDateKey() s'exécute sur un runtime Vercel en UTC.
--
-- Les overrides manuels (manual_sport_type / manual_distance_m /
-- manual_elevation_gain_m) restent prioritaires, comme dans le code TS.
--
-- SECURITY INVOKER : la RLS de `activities` s'applique à l'appelant ; le paramètre
-- p_user_id ne l'ouvre donc pas aux données d'autrui.

create or replace function activity_daily_totals(p_user_id uuid)
returns table (d date, s text, km numeric, dp numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select (start_time at time zone 'UTC')::date                                   as d,
         coalesce(manual_sport_type, sport_type)                                 as s,
         round((sum(coalesce(manual_distance_m, distance_m, 0)) / 1000)::numeric, 3) as km,
         round(sum(coalesce(manual_elevation_gain_m, elevation_gain_m, 0))::numeric)  as dp
  from activities
  where user_id = p_user_id
    and deleted_at is null
  group by 1, 2
  order by 1;
$$;

comment on function activity_daily_totals(uuid) is
  'Totaux km / D+ par jour et par sport effectif, pour le Cockpit. Évite de rapatrier tout l''historique d''activités à chaque rendu.';
