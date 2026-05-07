# Admin Panel — Trail Cockpit Web App

**Date:** 2026-05-07  
**Statut:** Validé — prêt pour implémentation

---

## Contexte

L'app Trail Cockpit (Next.js 15 / Supabase) a besoin d'un espace d'administration réservé au compte `franck.meri@gmail.com`. Une page `/admin` existe déjà avec des données statiques. Ce design la remplace avec des données réelles et un système de rôle sécurisé.

---

## Décisions de design

| Sujet | Décision |
|---|---|
| Navigation | Icône 🛡️ "Admin" dans la bottom nav, visible uniquement pour l'admin |
| Rôle admin | Colonne `is_admin boolean` dans la table `profiles` existante |
| Modules | Dashboard, Users, Déploiements, Webhooks, Système, Sync |
| Structure | Page unique `/admin?tab=xxx` avec 6 onglets horizontaux |
| Vercel | API Vercel via `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` en variables d'env |

---

## Architecture

### 1. Rôle admin — Supabase

- Ajouter colonne `is_admin boolean DEFAULT false` à la table `profiles`
- Passer `franck.meri@gmail.com` en admin via SQL : `UPDATE profiles SET is_admin = true WHERE id = '<user_id>'`
- Créer helper `lib/database/get-admin.ts` : `isAdmin(userId)` → query `profiles.is_admin`
- La page `/admin` appelle `isAdmin()` côté serveur et redirige vers `/dashboard` si faux
- La bottom nav conditionne l'affichage de l'item Admin sur `isAdmin()`

### 2. Navigation

- `BottomNav` est actuellement `'use client'` (utilise `usePathname`). Il restera Client Component mais recevra `isAdmin: boolean` en prop depuis `AppShell`
- `AppShell` (Server Component) lit le profil admin et passe `isAdmin` à `BottomNav`
- L'item Admin n'est rendu que si `isAdmin === true`

### 3. Page `/admin` — structure

```
app/(main)/admin/
  page.tsx          ← Server Component, vérifie is_admin, lit ?tab
  components/
    AdminTabs.tsx   ← barre d'onglets (client, gère ?tab dans URL)
    TabDashboard.tsx
    TabUsers.tsx
    TabDeployments.tsx
    TabWebhooks.tsx
    TabSystem.tsx
    TabSync.tsx
```

Le paramètre `?tab` est lu via `searchParams` en Server Component. Chaque onglet est un Server Component qui fetch ses propres données.

### 4. Onglet Dashboard

Données réelles depuis Supabase (service role) :
- Nombre total d'utilisateurs : `COUNT(profiles)`
- Connexions Strava actives : `COUNT(provider_connections WHERE provider='strava')`
- Activités importées : `COUNT(activities)`
- Webhooks reçus : `COUNT(webhook_logs)` (si table existante, sinon afficher N/A)
- Erreurs 24h : `COUNT(webhook_logs WHERE status >= 500 AND created_at > now()-24h)`
- Dernier déploiement : via API Vercel (statut + durée)

Grille 2×3 de KPI cards, même style que la page actuelle.

### 5. Onglet Users

Données : join `auth.users` (via service role) + `profiles` + `provider_connections`

Chaque carte affiche :
- Email
- Date d'inscription (`created_at`)
- Dernière connexion (`last_sign_in_at`) — vert si < 3 jours, orange sinon
- Badge rôle (🛡 Admin / User)
- Badges Strava (connecté/non) et nombre d'activités

Tap sur une carte → modal ou section dépliable avec actions :
- Déclencher sync Strava individuelle
- Supprimer le compte (avec confirmation)

### 6. Onglet Déploiements

Route handler `/api/admin/deployments` appelle l'API Vercel :
```
GET https://api.vercel.com/v6/deployments?projectId=VERCEL_PROJECT_ID&limit=10
Authorization: Bearer VERCEL_TOKEN
```

Chaque ligne affiche :
- Environnement (Production / Preview) avec point coloré (vert=Ready, rouge=Error, jaune=Building)
- Message du dernier commit
- Hash court du commit
- Durée relative ("il y a 2h")
- Lien ↗ vers l'URL du déploiement (prod uniquement)

### 7. Onglet Webhooks

Query : `SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20`

Si la table `webhook_logs` n'existe pas encore, elle sera créée avec :
```sql
CREATE TABLE webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users,
  status_code int,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);
```

Chaque ligne : event type, provider, email user, statut HTTP (vert=2xx, rouge=5xx), date.

### 8. Onglet Système

4 sections avec titre coloré + description :

| Section | Couleur | Variables vérifiées |
|---|---|---|
| Base de données — Supabase | Violet | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Synchronisation — Strava OAuth | Orange | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` |
| Déploiements — Vercel API | Bleu | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` |
| Application | Vert | `NODE_ENV`, version Next.js, version Node.js |

Chaque variable : ✓ vert si définie, ⚠ orange si manquante. Les valeurs ne sont jamais affichées (sécurité).

### 9. Onglet Sync

**Sync individuelle :**
- Champ de sélection (dropdown des users ou champ email)
- Bouton "Sync →" → appelle `POST /api/admin/sync` avec `{ userId }`
- Réutilise la logique de `StravaRepository` existante

**Sync de masse :**
- Bouton rouge "Sync tous ⚠" affichant le nombre de users
- Confirmation modale avant exécution : "Lancer la sync pour N utilisateurs ?"
- Appelle `POST /api/admin/sync` avec `{ all: true }` — traitement séquentiel pour éviter le rate limit Strava

---

## Sécurité

- Toute route `/api/admin/*` vérifie `isAdmin()` via service role avant de traiter la requête
- Le token Vercel n'est jamais exposé au client (appel serveur uniquement)
- La sync de masse nécessite une confirmation explicite
- La suppression de compte nécessite une confirmation explicite
- RLS Supabase : la colonne `is_admin` n'est lisible que via service role (pas via anon key)

---

## Variables d'env à ajouter

```
VERCEL_TOKEN=<token lecture seule créé sur vercel.com/account/tokens>
VERCEL_PROJECT_ID=<visible dans Settings > General de ton projet Vercel>
```

---

## Ce qui est hors scope

- Interface de création de nouveaux utilisateurs (inscription via l'app suffit)
- Gestion des rôles multiples (admin suffisant pour l'instant)
- Logs d'audit des actions admin
- Notifications push admin
