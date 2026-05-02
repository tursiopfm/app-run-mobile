-- Add role + subscription_status to profiles (not in migration 001)
alter table profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'pro', 'premium'));

-- Function: insert a profiles row when a new auth.users row is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, subscription_status)
  values (
    new.id,
    new.email,
    'user',
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: fire after every auth.users INSERT
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
