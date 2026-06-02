-- 029_plan_auto_push_title_default_false.sql
-- Change default to false and update all existing users.
alter table profiles
  alter column plan_auto_push_title set default false;

update profiles set plan_auto_push_title = false;
