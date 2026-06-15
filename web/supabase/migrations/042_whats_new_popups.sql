-- Migration: 042 - whats_new_popups
-- Pop-ups « Quoi de neuf » pilotées par l'admin. Une seule active à la fois.
-- Le contenu remplace les constantes codées en dur de WhatsNewModal.tsx.
create table if not exists whats_new_popups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  bullets     jsonb not null default '[]'::jsonb,  -- [{ "emoji": "✨", "label": "…" }]
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Au plus une pop-up active (en plus de la logique applicative).
create unique index if not exists whats_new_popups_one_active
  on whats_new_popups (is_active) where is_active;

alter table whats_new_popups enable row level security;

-- Le modal (client navigateur, authentifié) ne lit QUE la ligne active.
drop policy if exists "read active popup" on whats_new_popups;
create policy "read active popup"
  on whats_new_popups for select
  to authenticated
  using (is_active = true);
-- Aucune policy insert/update/delete → seules les routes admin (service role) écrivent.

-- Seed : la pop-up « Deep Mission » actuelle, désactivée (déjà vue par la plupart).
insert into whats_new_popups (title, bullets, is_active) values (
  'Quoi de neuf',
  '[
    {"emoji":"✨","label":"Nouveau design « Deep Mission » : interface rafraîchie et plus lisible"},
    {"emoji":"🎨","label":"Une couleur par sport : course en orange, vélo en vert, natation en bleu"},
    {"emoji":"🔤","label":"Nouvelle typographie : titres et chiffres plus nets"},
    {"emoji":"🌗","label":"Thèmes clair et sombre peaufinés"}
  ]'::jsonb,
  false
);
