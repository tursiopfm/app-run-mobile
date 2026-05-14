-- 013_profile_identity_fields.sql
-- Adds full birth date and sex to the athlete profile.
-- birth_year is kept (still used by HR auto method) and stays in sync on updates.

alter table profiles
  add column if not exists birth_date date,
  add column if not exists sex        text check (sex in ('male', 'female', 'other'));

-- Backfill birth_date from existing birth_year when possible (Jan 1 of that year as best approximation).
update profiles
   set birth_date = make_date(birth_year, 1, 1)
 where birth_year is not null
   and birth_date is null;
