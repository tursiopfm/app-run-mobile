-- 024_plan_auto_push_title.sql
-- Toggle user : pousser auto le titre d'une séance planifiée sur Strava
-- quand une activité matche la séance (1↔1) à l'arrivée via webhook.
alter table profiles
  add column if not exists plan_auto_push_title boolean not null default true;
