# Module admin « Quoi de neuf » — pop-ups de mise à jour pilotées par la base

> **Status: Implémenté** · 2026-06-15 · Code: `web/app/(main)/admin/components/TabWhatsNew.tsx`, `web/app/(main)/admin/components/WhatsNewManager.tsx`, `web/app/api/admin/whats-new/`, `web/components/ui/WhatsNewCard.tsx`, `web/components/ui/WhatsNewModal.tsx`, `web/lib/admin/whats-new.ts`, `web/supabase/migrations/042_whats_new_popups.sql`
> ⚠️ Migration 042 à appliquer dans Supabase avant utilisation (voir § Déploiement).

> Date : 2026-06-15 · Statut : Spec validée, à implémenter

## Contexte

La pop-up « Quoi de neuf » (image « Deep Mission ») est aujourd'hui **codée en dur** dans
[`web/components/ui/WhatsNewModal.tsx`](../../../components/ui/WhatsNewModal.tsx) :
les constantes `RELEASE_ID` et `BULLETS` décrivent le contenu, et l'état « vu » par
utilisateur est stocké dans `profiles.ui_preferences.whats_new_seen` (= `RELEASE_ID`).
Pour publier une nouvelle pop-up, il faut éditer le code et redéployer.

**Objectif** : permettre à l'admin de **créer** des pop-ups de mise à jour et de les
**activer / désactiver** depuis le panneau admin, sans toucher au code.

## Décisions de cadrage (validées)

1. **Une seule active à la fois** — activer une pop-up désactive automatiquement les autres.
2. **Contenu éditable** : **titre + puces** (chaque puce = un emoji + un texte). L'icône
   d'en-tête (✨), les couleurs et le bouton « Compris » restent figés au design de l'app.
3. **Pop-up actuelle** : la « Deep Mission » est migrée comme **première entrée, désactivée**
   (conservée et éditable, mais plus affichée car déjà vue par la plupart).

## Approche

Rendre les pop-ups **pilotées par la base** : une table `whats_new_popups`, un onglet admin
pour les gérer, et le `WhatsNewModal` qui lit la **ligne active** au lieu des constantes.

Alternatives écartées :
- Stocker un tableau JSON dans une ligne de config unique → pas de toggle/horodatage propre
  par pop-up, ordering bancal.
- Simple interrupteur on/off sur le contenu en dur → ne permet pas de **créer** de nouvelles
  pop-ups (besoin explicite).

## 1. Modèle de données — `web/supabase/migrations/042_whats_new_popups.sql`

```sql
create table if not exists whats_new_popups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  bullets     jsonb not null default '[]'::jsonb,  -- [{ "emoji": "✨", "label": "…" }]
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Au plus une pop-up active (ceinture + bretelles avec la logique applicative).
create unique index if not exists whats_new_popups_one_active
  on whats_new_popups (is_active) where is_active;

alter table whats_new_popups enable row level security;

-- Le modal (client navigateur, authentifié) ne lit QUE la ligne active.
create policy "read active popup"
  on whats_new_popups for select
  to authenticated
  using (is_active = true);

-- Aucune policy insert/update/delete → seules les routes admin (service role) écrivent.

-- Seed : la pop-up « Deep Mission » actuelle, désactivée.
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
```

Notes :
- L'index unique partiel impose l'ordre des updates à l'activation : **mettre les autres à
  `false` d'abord, puis celle-ci à `true`** (sinon violation de contrainte).
- Pas de colonne `seen` ici : le « vu » reste dans `profiles.ui_preferences.whats_new_seen`,
  désormais égal à l'**uuid** de la pop-up (au lieu d'un slug). Mécanisme inchangé.

## 2. Refactor `WhatsNewModal` + composant présentationnel partagé

### `WhatsNewCard` (nouveau, présentationnel pur)

Extrait du visuel interne actuel. Props :

```ts
type Bullet = { emoji: string; label: string }
function WhatsNewCard(props: {
  title: string
  bullets: Bullet[]
  onDismiss?: () => void   // absent/no-op pour l'aperçu admin
}): JSX.Element
```

Rend l'en-tête (icône ✨ + titre), la liste des puces et le bouton « Compris ». **Source
unique du rendu**, utilisée par le modal (avec portail + overlay) et par l'aperçu live admin.

### `WhatsNewModal` (refactoré)

- Supprime `RELEASE_ID` et `BULLETS`.
- Au montage : lit la **pop-up active** via le client navigateur
  (`from('whats_new_popups').select('id, title, bullets').eq('is_active', true).maybeSingle()`,
  borné par la RLS). Aucune ligne → ne rend rien.
- Lit `profiles.ui_preferences.whats_new_seen` ; ouvre si `seen !== popup.id`.
- Au dismiss : écrit `popup.id` dans `localStorage` (clé `whats_new_seen`, format JSON, déjà
  dans `SYNCED_KEYS`) **et** update ciblé read-modify-write de `ui_preferences`. Inchangé.
- Garde le portail `createPortal(document.body)`, l'overlay, la fermeture Escape/clic-dehors.

## 3. Onglet admin « Quoi de neuf »

### Branchements ([`web/app/(main)/admin/page.tsx`](../../../app/(main)/admin/page.tsx))

- Ajouter `'whats-new'` à `VALID_TABS`.
- Ajouter `'whats-new': 'Quoi de neuf'` à `TAB_TITLES`.
- Rendre `{activeTab === 'whats-new' && <TabWhatsNew />}`.
- Ajouter une carte vers `?tab=whats-new` dans
  [`TabDashboard`](../../../app/(main)/admin/components/TabDashboard.tsx)
  (icône `Sparkles`, libellé « Quoi de neuf », compteur de pop-ups).

### `TabWhatsNew` (serveur)

Lit **toutes** les pop-ups via `createServiceClient` (bypass RLS), triées par
`created_at desc`, et les passe au composant client.

### `WhatsNewManager` (client)

- Liste des pop-ups : titre, badge « active », boutons **éditer / supprimer**, toggle actif.
- Bouton **« Nouvelle pop-up »** → formulaire :
  - champ **titre** ;
  - liste de **puces** : chaque ligne = un petit champ emoji + un champ texte, avec
    ajout/suppression de ligne (≥ 1 puce) ;
  - **aperçu live** via `WhatsNewCard` qui se met à jour à la frappe.
- Actions → `fetch` vers les routes API ci-dessous, puis `router.refresh()`.

## 4. Routes API admin (gardées par `getServerUser` + `getIsAdmin`, comme `reset-onboarding`)

`web/app/api/admin/whats-new/route.ts` :
- `POST { title, bullets }` → insert (`is_active = false`). 400 si titre vide ou `bullets`
  invalide / vide.

`web/app/api/admin/whats-new/[id]/route.ts` :
- `PATCH { title?, bullets?, is_active? }` → update. Si `is_active === true` :
  `update({ is_active: false }).neq('id', id)` **puis** `update({ is_active: true, ... }).eq('id', id)`.
  Sinon update simple. Met `updated_at = now()`.
- `DELETE` → supprime la ligne.

Toutes les écritures utilisent `createServiceClient`. 401/403 si non-admin.

## 5. Helpers purs + tests

Extraire dans `web/lib/admin/whats-new.ts` (avec le type `Bullet` partagé, importé aussi
par `WhatsNewCard`/`WhatsNewModal`) :
- `normalizeBullets(input: unknown): Bullet[]` — filtre/valide la forme `{emoji, label}`,
  trim, rejette les entrées vides. Utilisé côté API (validation) et formulaire.
- `shouldShowPopup(active: { id: string } | null, seenId: unknown): boolean` —
  `!!active && seenId !== active.id`. Utilisé par le modal.

Tests Jest légers dans `web/__tests__/` couvrant les deux fonctions (cas vides, formes
invalides, égalité d'id). Pas d'autre surface testée (les routes/Supabase ne sont pas
unit-testées dans ce projet).

## Gestion d'erreurs / cas limites

- Aucune pop-up active → le modal ne rend rien (comme aujourd'hui en cas d'échec).
- Sauvegarde avec 0 puce ou titre vide → 400 côté API + garde côté formulaire.
- Course à l'activation concurrente → index unique partiel + ordre des updates.
- Suppression de la pop-up active → autorisée ; plus rien ne s'affiche tant qu'aucune autre
  n'est activée (acceptable, admin-only).

## Portée — fichiers touchés

**Créés** :
- `web/supabase/migrations/042_whats_new_popups.sql`
- `web/components/ui/WhatsNewCard.tsx`
- `web/app/(main)/admin/components/TabWhatsNew.tsx`
- `web/app/(main)/admin/components/WhatsNewManager.tsx`
- `web/app/api/admin/whats-new/route.ts`
- `web/app/api/admin/whats-new/[id]/route.ts`
- `web/lib/admin/whats-new.ts`
- `web/__tests__/lib/admin/whats-new.test.ts`

**Modifiés** :
- `web/components/ui/WhatsNewModal.tsx` (lit la DB, utilise `WhatsNewCard`)
- `web/app/(main)/admin/page.tsx` (onglet)
- `web/app/(main)/admin/components/TabDashboard.tsx` (carte)

## Déploiement

- Migration **042 non auto-appliquée** : rappeler à Franck de coller le SQL dans le SQL
  Editor Supabase (ou `supabase db push`).
- Déploiement web via push GitHub (Vercel auto-deploy).
