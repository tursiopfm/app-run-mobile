-- Migration: 041 - race_website_url
-- URL du site officiel de l'organisation d'une course. Auto-rempli à la création
-- via recherche web, éditable/saisissable manuellement dans la fiche course. Nullable.
alter table races add column if not exists website_url text;
