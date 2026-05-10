# Import initial complet des activités Strava — Design

**Date :** 2026-05-10
**Statut :** spec validée, prête pour planification d'implémentation
**Contexte :** web/ (Next.js, Supabase, Vercel)

## Problème

Aujourd'hui, le sync Strava est limité à 1 000 activités max et n'est jamais déclenché automatiquement après la connexion OAuth. L'utilisateur qui se connecte pour la première fois ne voit aucune activité tant qu'il ne clique pas sur le bouton « Sync » dans Settings — et même alors, il ne récupère que les 30 derniers jours (sync incrémental).

On veut que **tout l'historique Strava** soit importé automatiquement à la première connexion, avec une UX qui ne bloque pas l'utilisateur.

## Choix utilisateur (validés)

1. **Trigger** : auto au callback OAuth, redirect immédiat vers le dashboard.
2. **Profondeur** : tout l'historique (illimité, jusqu'à la 1ère activité Strava).
3. **Robustesse** : Vercel Cron (1×/min) pousse l'import en background.
4. **UI** : bannière fine en haut du dashboard avec compteur + spinner.

## Architecture

Approche retenue : **Cron + curseur en BDD**.

```
[OAuth callback] ──▶ marque connection import_status='pending'
                         │
                         ▼
                 [Vercel Cron 1×/min]
                         │
                         ▼
       Pour chaque connection en pending/in_progress :
         1. Fetch 1 page Strava (200 activités, before=oldest_at)
         2. Import via importActivities() existant
         3. Update curseur (oldest_at, total, status)
         4. Si batch < 200 → status='completed'
                         │
                         ▼
       [Dashboard banner] ──▶ polling /api/strava/import-status (10s)
```

## 1. Modèle de données

Nouvelles colonnes sur la table existante `provider_connections` (pas de table dédiée, on garde la cardinalité 1:1) :

```sql
ALTER TABLE provider_connections
  ADD COLUMN import_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN import_started_at TIMESTAMPTZ,
  ADD COLUMN import_completed_at TIMESTAMPTZ,
  ADD COLUMN import_oldest_at TIMESTAMPTZ,
  ADD COLUMN import_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN import_last_error TEXT,
  ADD COLUMN import_updated_at TIMESTAMPTZ;

-- Index pour le scan du cron
CREATE INDEX idx_provider_connections_import_pending
  ON provider_connections (import_status, import_updated_at)
  WHERE import_status IN ('pending', 'in_progress');
```

**Valeurs `import_status`** : `idle` | `pending` | `in_progress` | `completed` | `error`.

**Migration** : à coller dans `web/supabase/migrations/20260510_strava_initial_import.sql`. Franck colle le SQL dans le Dashboard Supabase (les migrations ne s'auto-appliquent pas).

## 2. Flux & endpoints

### 2.1 Modif callback OAuth — `app/api/strava/callback/route.ts`

Après `upsert provider_connections`, ajouter dans le même upsert :
```ts
import_status:        'pending',
import_started_at:    new Date().toISOString(),
import_oldest_at:     null,
import_total:         0,
import_last_error:    null,
import_updated_at:    new Date().toISOString(),
```

Garder le redirect `/settings?strava=connected` actuel (la bannière sera visible dès le retour).

### 2.2 Nouveau cron — `app/api/cron/strava-import/route.ts`

```ts
GET /api/cron/strava-import
Header: Authorization: Bearer ${CRON_SECRET}
```

Logique :
1. Vérif `Authorization` header.
2. SELECT toutes les connections où :
   - `provider = 'strava'`
   - `import_status IN ('pending', 'in_progress')`
   - `import_updated_at IS NULL OR import_updated_at < now() - interval '50 seconds'` (anti-chevauchement)
   - LIMIT 5 (max users traités par tick).
3. Pour chaque connection, en parallèle (`Promise.allSettled`) :
   - `processOneImportTick(userId)` (cf. lib ci-dessous)
4. Renvoyer `{ processed: N, results: [...] }`.

### 2.3 Nouvel endpoint polling — `app/api/strava/import-status/route.ts`

```ts
GET /api/strava/import-status
→ {
    status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'error',
    total: number,
    oldestAt: string | null,
    startedAt: string | null,
    completedAt: string | null,
    error: string | null,
  }
```
Headers : `Cache-Control: no-store`. Auth via `auth.getUser()`.

```ts
POST /api/strava/import-status
Body: { action: 'retry' }
```
→ reset `import_status='pending'`, `import_last_error=null`, `import_updated_at=null`. Pour le bouton « Réessayer » de la bannière en cas d'erreur.

### 2.4 Nouvelle lib — `lib/providers/strava/import.ts`

```ts
export async function processOneImportTick(userId: string): Promise<TickResult> {
  // 1. UPDATE status='in_progress', updated_at=now() (avant tout fetch, pour anti-chevauchement)
  // 2. getValidStravaToken(userId)
  // 3. before = oldest_at (en secondes Unix), ou undefined si null
  // 4. fetchStravaActivitiesPage(token, { before, perPage: 200 })  ← une seule page
  // 5. Si batch.length === 0:
  //      UPDATE status='completed', completed_at=now()
  //      RETURN { done: true, savedThisTick: 0 }
  // 6. Mapper + importActivities(activities, profile)
  // 7. newOldest = min(activities.start_time)
  // 8. UPDATE oldest_at=newOldest, total += result.saved, updated_at=now()
  // 9. Si batch.length < 200:
  //      UPDATE status='completed', completed_at=now()
  // 10. RETURN { done: batch.length < 200, savedThisTick: result.saved }
  // Catch: si Strava 429 → garder status='pending', log, return { rateLimited: true }
  //        sinon → UPDATE status='error', last_error=msg
}
```

Exposer aussi `fetchStravaActivitiesPage(accessToken, { before?, perPage })` dans `lib/providers/strava/api.ts` (refacto léger : sortir la fonction de page de la boucle existante).

### 2.5 Cron Vercel — `web/vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/strava-import", "schedule": "* * * * *" }
  ]
}
```

**Note** : Vercel Hobby autorise 2 crons gratuits, on en utilise 1.

## 3. UI bannière de progression

### 3.1 Composant — `components/ui/ImportProgressBanner.tsx`

Client component. Mount dans `web/app/(main)/layout.tsx` (le layout authenticated commun qui wrap toutes les pages avec `AppShell`).

Comportement :
- `useEffect` au mount : fetch initial `/api/strava/import-status`, puis `setInterval(fetch, 10_000)`.
- Cleanup : `clearInterval` au unmount + dès que `status` devient `completed` ou `error`.
- Rendu conditionnel selon `status` :

| status | rendu |
|---|---|
| `idle` | rien (banner masqué) |
| `pending` / `in_progress` | bandeau h-9 sticky top, fond `bg-trail-accent/10`, texte « Import Strava — **{total}** activités » + spinner. Si `oldestAt`, ajouter « (remonté jusqu'à {format mois année}) » |
| `completed` | bandeau vert 5s « ✓ Import Strava terminé — {total} activités », puis localStorage flag pour ne plus afficher |
| `error` | bandeau rouge avec `last_error` + bouton « Réessayer » qui POST `/api/strava/import-status` avec `{ action: 'retry' }`, puis reprend le polling |

**Pas de % ni barre visuelle** : on ne connaît pas le total Strava à l'avance. Compteur croissant + spinner suffit.

### 3.2 Animation
- Spinner Lucide `Loader2` avec `animate-spin`.
- Apparition/disparition : `transition-all duration-300`.

## 4. Rate limit & edge cases

### Rate limit Strava
- 200 req / 15 min, 2 000 req / jour (par client_id).
- 1 user en import = 1 req/min = 60 req/h → safe.
- Cron limite à **5 users traités par tick** → max 300 req/h pour l'app, sous la limite quotidienne.
- Si Strava renvoie **429** : `import_status` reste `pending`, on retry au prochain tick.

### Edge cases

| Cas | Comportement |
|---|---|
| Reconnexion Strava après déconnexion | Le callback reset `import_status='pending'`, `oldest_at=null`, `total=0`. Re-fetch complet, `importActivities` upsert → pas de doublons. |
| Token expiré pendant le cron | `getValidStravaToken` refresh auto (déjà en place). |
| Cron qui chevauche | Filtre `import_updated_at < now() - interval '50s'` empêche la double exécution. |
| Sync manuel pendant import initial | Inchangé (fenêtre 30j). Indépendant de l'import initial. Possible doublon de requête mais upsert le gère. |
| Compte Strava vide | 1er tick renvoie `[]` → status passe direct à `completed`. |
| User ferme l'onglet | Cron continue. Au retour, la bannière reprend le polling et affiche l'état courant. |

### Sécurité
- `/api/cron/strava-import` : check `Authorization: Bearer ${CRON_SECRET}` (header injecté automatiquement par Vercel pour les crons).
- `/api/strava/import-status` : auth standard via `supabase.auth.getUser()`.
- RLS Supabase : nouvelles colonnes héritent des policies existantes de `provider_connections`.

## 5. Fichiers impactés

**Nouveaux**
- `web/supabase/migrations/20260510_strava_initial_import.sql`
- `web/app/api/cron/strava-import/route.ts`
- `web/app/api/strava/import-status/route.ts`
- `web/lib/providers/strava/import.ts`
- `web/components/ui/ImportProgressBanner.tsx`

**Modifiés**
- `web/app/api/strava/callback/route.ts` — set `import_status='pending'` à la connexion
- `web/lib/providers/strava/api.ts` — exposer `fetchStravaActivitiesPage` (refacto)
- `web/vercel.json` — ajouter le cron
- `web/app/(main)/layout.tsx` — mount `<ImportProgressBanner />` dans le layout authenticated commun

## 6. Variables d'environnement

À ajouter dans Vercel (et `.env.local` pour dev) :
- `CRON_SECRET` — secret aléatoire pour authentifier le cron.

## 7. Tests

- Unit test `processOneImportTick` :
  - 1er tick (pas de `oldest_at`) → fetch sans `before`, met à jour curseur
  - tick suivant → fetch avec `before`
  - batch < 200 → status `completed`
  - batch vide → status `completed` direct
  - Strava 429 → status reste `pending`, pas d'erreur
  - Strava 500 → status `error`
- Test endpoint `/api/strava/import-status` (GET + POST retry).

## 8. Hors scope (V2 éventuelle)

- Estimation du total via `/athlete/stats` pour afficher un vrai % de progression.
- Notification push quand l'import est terminé.
- Pause/reprise manuelle.
- Stats par sport pendant l'import.
