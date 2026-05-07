-- Add aerobic threshold HR and birth year to profiles
alter table profiles
  add column if not exists aerobic_threshold_hr integer,
  add column if not exists birth_year            integer;
