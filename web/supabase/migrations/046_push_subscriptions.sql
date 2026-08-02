-- Migration: 046 - push_subscriptions
-- Abonnements Web Push, un par appareil, pour la notification du rapport
-- matinal envoyée à 7:00 Europe/Paris.
create table if not exists push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- endpoint est l'identité de l'abonnement côté service de push : unique
  -- globalement, ce qui permet l'upsert sans lire d'abord.
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  -- Jour (Europe/Paris) du dernier envoi réussi. C'est la clé d'idempotence :
  -- le cron balaie toutes les 10 min dans sa fenêtre, un seul envoi passe.
  -- Porté par l'ABONNEMENT et non par l'utilisateur : un athlète avec deux
  -- appareils reçoit sur les deux, une fois chacun.
  last_notified_on date
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);
create index if not exists push_subscriptions_last_notified_idx
  on push_subscriptions (last_notified_on);

alter table push_subscriptions enable row level security;

drop policy if exists "own subscriptions select" on push_subscriptions;
create policy "own subscriptions select"
  on push_subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own subscriptions insert" on push_subscriptions;
create policy "own subscriptions insert"
  on push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own subscriptions update" on push_subscriptions;
create policy "own subscriptions update"
  on push_subscriptions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own subscriptions delete" on push_subscriptions;
create policy "own subscriptions delete"
  on push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);
-- Le cron passe en service role et contourne la RLS.
