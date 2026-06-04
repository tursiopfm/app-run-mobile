# SP-2 instantané sur les nouvelles activités

> **Status: Implémenté** · 2026-06-04 · Code: `web/lib/providers/strava/trigger-backfill.ts`, `web/lib/providers/strava/streams-backfill.ts`, `web/app/api/strava/webhook/route.ts`

**Date :** 2026-06-04
**Scope :** Web app (`web/`) — webhook Strava, backfill streams
**Fonctionnalités :** appliquer le modèle CES SP-2 à une nouvelle activité dès sa synchronisation Strava (quelques secondes), au lieu d'attendre le prochain run du cron backfill (≤ 10 min, parfois plus).

> Suite de SP-1 (ingestion streams) et SP-2 (modèle CES en couches). Réf : `docs/superpowers/specs/2026-06-03-ces-layered-model-design.md`. Clôt le loose end backlogé : les nouvelles activités ne passaient en SP-2 qu'au recalcul manuel/cron.

---

## Contexte

Une nouvelle activité reçoit son CES **sans streams** : le webhook Strava (`create`) tourne en runtime `edge` (pas de `zlib`, pas de fetch streams), il calcule donc un CES de **fallback** (allure moyenne + facteur D+). Les streams n'arrivent qu'au prochain cron backfill, et le CES ne bascule en SP-2 qu'à ce moment. D'où une fenêtre (≤ 10 min, cron GitHub capricieux) où l'activité affiche l'ancien modèle.

**Pourquoi on ne supprime pas l'ancien calcul :** SP-2 *dépend* des streams (indisponibles au webhook), et l'ancien calcul reste le **fallback permanent** des activités sans streams (saisies manuelles, sans capteur, historique pré-mai). Le modèle est donc « SP-2 si streams, fallback sinon ». Objectif ici : rendre la bascule SP-2 quasi instantanée pour les nouvelles activités.

---

## Architecture : réutiliser le cron backfill comme déclencheur instant

L'étape « appliquer SP-2 » (fetch streams d'une activité → stocker → recalculer l'utilisateur) existe **déjà** dans le cron backfill. On ne crée donc **aucun nouvel endpoint** : le webhook **déclenche le cron existant**.

**Chemin rapide (instantané)** — nouvelles activités :
1. Webhook `create` (edge) : upsert de l'activité avec CES fallback (inchangé, < 2 s).
2. Le webhook déclenche en **fire-and-forget** (`keepalive`, sans bloquer la réponse à Strava) un GET vers `/api/cron/strava-streams-backfill` (le cron existant).
3. Le cron traite l'activité manquante (la plus récente, sans streams → en tête de `activities_missing_streams`) : stocke ses streams, puis recalcule l'utilisateur → CES SP-2 + charge à jour en quelques secondes.

**Filet de sécurité (≤ 10 min)** — webhooks ratés / historique :
- Le cron tourne aussi sur son planning GitHub habituel et rattrape toute activité sans streams.

---

## Composants (2 modifications, 0 nouvel endpoint)

### 1. `streams-backfill.ts` — recalcul par utilisateur après le batch (Option A)
`processStreamsBackfillBatch` collecte les `user_id` ayant reçu ≥ 1 stream durant le batch (un `Set`). Après la boucle, pour chaque user touché : `await recalculateUserEffortScores(userId)` puis `await recalculateUserFatigue(userId)`, en **best-effort** (try/catch par user — un échec de recalcul ne casse pas le backfill). Le résultat expose `recalculatedUsers: number` pour le log.

C'est ce qui applique réellement SP-2 (le backfill stockait les streams mais ne recalculait pas le CES). Vaut pour le déclenchement instant ET le filet cron.

### 2. Webhook `webhook/route.ts` (edge) — déclencheur instant
Après un upsert réussi sur un event `create` (`upserted?.id` présent et `event.aspect_type === 'create'`), fire-and-forget :
```
fetch(`${APP_URL}/api/cron/strava-streams-backfill`, {
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
  keepalive: true,
}).catch(() => {})
```
Dans un try/catch englobant : ne doit **jamais** faire échouer le webhook (sinon Strava retente). N'agir que sur `create` (pas `update`/`delete`). `APP_URL` et `CRON_SECRET` déjà dispo en env (déjà utilisés par le cron d'import).

---

## Flux de données

- **Nouvelle activité** : webhook (CES fallback, instantané) → déclenche le cron → streams stockés + recalcul user → CES SP-2 + charge (secondes).
- **Webhook raté / historique** : cron sur planning → idem (≤ 10 min).

Les deux empruntent exactement le même code (le cron). Aucune logique dupliquée, aucun endpoint en plus.

---

## Gestion d'erreur & idempotence

- Chemin rapide entièrement **best-effort** : un échec du fire-and-forget n'impacte ni le webhook (déjà répondu 200 à Strava) ni les données (le cron planifié rattrape).
- Concurrence webhook↔cron planifié : deux runs backfill simultanés peuvent saisir le même lot → upserts idempotents (`onConflict activity_id`) + recalcul idempotent → sans dommage (au pire quelques appels Strava gâchés).
- 429 Strava : le cron s'arrête proprement (`rateLimited`), l'activité est reprise au run suivant.

---

## Tests

- `streams-backfill` : le test existant + assertion que `recalculateUserEffortScores`/`recalculateUserFatigue` (mockés) sont appelés une fois par user ayant reçu un stream ; et pas appelés si aucun stream stocké.
- `triggerStreamsBackfill` (helper) : test unitaire — `fetch` appelé avec la bonne URL + bearer + `keepalive` ; no-op sans `CRON_SECRET` ; ne propage jamais (le webhook ne peut pas casser).
- Webhook : pas de test unitaire dédié (le route edge a trop de dépendances pour un test proportionné) ; le déclencheur est un appel `void` garde-fou (`create` + `upserted?.id`) vers le helper déjà testé → vérifié par inspection + tsc/lint + contrôle manuel post-déploiement.

---

## Hors scope

- Nouvel endpoint dédié (écarté : on réutilise le cron).
- Extraction d'un helper `storeActivityStreams` (inutile : pas de second consommateur).
- Calcul SP-2 dans le webhook edge (impossible sans streams/zlib).
- Modification du modèle CES (figé en SP-2) ; backfill historique pré-mai (exclu).
