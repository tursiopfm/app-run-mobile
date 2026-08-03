# Notification push « Rapport matinal » à 7:00

> **Status: Implémenté** · 2026-08-02 · Code: `web/lib/push/`, `web/app/api/push/subscribe/route.ts`, `web/app/api/cron/morning-push/route.ts`, `web/components/settings/PushNotificationToggle.tsx`, `web/scripts/sw.template.js`

> Date : 2026-08-02 · Zone : Paramètres > Apparence, Service Worker, cron

## Objectif

Envoyer chaque matin à **7:00 heure de Paris** une notification push sur le
téléphone, annonçant que le rapport matinal est disponible et résumant en une
ligne l'état de forme et la séance du jour. Un tap ouvre `/rapport-matinal`.

Décisions de cadrage (Franck, 2026-08-02) :

- **Opt-in, pour tous les utilisateurs** — interrupteur dans les Paramètres.
- **Heure figée à 7:00 Europe/Paris** pour tout le monde. Pas de sélecteur
  d'heure, pas de fuseau par utilisateur. (Simplification explicitement demandée
  après avoir envisagé une heure réglable.)
- **Notification tous les jours**, y compris les jours sans séance planifiée.
- **Contenu** : le verdict global du rapport (`insights.status`) + la séance du
  jour.

## État existant

- **Aucune infrastructure push** : zéro occurrence de `pushManager`, `VAPID`,
  `web-push` ou `showNotification` dans `web/`.
- Le Service Worker ([scripts/sw.template.js](../../../scripts/sw.template.js))
  gère `install`/`activate`/`fetch` uniquement. `VERSION` est injectée au build
  (SHA du commit) — **ne jamais éditer `public/sw.js`**.
- Les crons sont déclenchés par **GitHub Actions** (`.github/workflows/*.yml`)
  avec un header `Authorization: Bearer ${CRON_SECRET}`, parce que Vercel Hobby
  plafonne les crons à un déclenchement par jour. Modèle de référence :
  [race-freshness/route.ts](../../../app/api/cron/race-freshness/route.ts).
- La PWA est installable (`display: standalone` dans `public/manifest.json`).
- `getMorningReportData(userId, timeZone)` et `getChargePageData(userId)`
  utilisent le client Supabase **par cookies** — inutilisable depuis un cron.
  Mais le calcul lourd est déjà **pur** : `buildSportPayload(acts, zones, now)`
  ([lib/data/charge.ts:60](../../../lib/data/charge.ts)) produit
  `insights.status` sans toucher à la base.
- `fr` ([lib/i18n/dictionaries/fr.ts:1144](../../../lib/i18n/dictionaries/fr.ts))
  est un `const` exporté — importable depuis un route handler.
- `formatDurationHHmm(minutes)` existe dans
  [lib/training/duration.ts](../../../lib/training/duration.ts) (90 → `1h30`).

## Contrainte iOS (bloquante)

Sur iPhone, le Web Push n'existe que si la PWA est **ajoutée à l'écran
d'accueil** (iOS 16.4+). Dans Safari en onglet classique, `PushManager` est
absent et `Notification.requestPermission()` n'est pas disponible. L'UI doit
donc détecter ce cas et afficher une consigne d'installation plutôt qu'un
interrupteur mort.

Deux règles Safari supplémentaires, non négociables :

1. `Notification.requestPermission()` doit être appelé **dans un gestionnaire de
   clic**. Hors geste utilisateur, la demande est rejetée.
2. Une permission **refusée n'est jamais redemandée**. L'interrupteur doit être
   verrouillé avec une consigne, sinon c'est un piège pour l'utilisateur.

## Architecture

### 1. Migration Supabase — `046_push_subscriptions.sql`

```sql
create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_notified_on date
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index push_subscriptions_last_notified_idx on public.push_subscriptions(last_notified_on);

alter table public.push_subscriptions enable row level security;
-- Chacun ne lit / n'écrit / ne supprime que ses propres lignes.
-- Le cron passe en service-role et contourne la RLS.
```

`last_notified_on` est porté par l'**abonnement**, pas par l'utilisateur : un
athlète avec un iPhone et un Android reçoit sur les deux, une fois chacun.

### 2. Clés VAPID

Générées par `npx web-push generate-vapid-keys`, stockées dans le dashboard
Vercel :

| Variable | Exposition |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client (nécessaire pour `subscribe()`) |
| `VAPID_PRIVATE_KEY` | serveur uniquement |
| `VAPID_SUBJECT` | serveur uniquement (`mailto:…`) |

Dépendance npm : `web-push`.

### 3. Service Worker

Ajouter deux handlers dans
[scripts/sw.template.js](../../../scripts/sw.template.js) — **et nulle part
ailleurs**. Aucune modification des handlers `fetch`/`install`/`activate`
existants.

```js
self.addEventListener('push', (event) => {
  // Un push reçu DOIT afficher une notification : un push silencieux fait
  // révoquer l'abonnement par le navigateur. D'où le repli sur un texte par
  // défaut si le payload est absent ou illisible.
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { /* repli */ }
  const title = payload.title || 'Rapport matinal'
  const body  = payload.body  || 'Ton rapport matinal est prêt.'
  const url   = payload.url   || '/rapport-matinal'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   'morning-report',   // une notif remplace la précédente
      data:  { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/rapport-matinal'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
```

Les abonnements push sont liés à la *registration*, pas au script : le bump de
`VERSION` à chaque déploiement ne les invalide pas.

### 4. Routes API — `app/api/push/subscribe/route.ts`

- `POST` — corps `{ endpoint, keys: { p256dh, auth } }`. Upsert sur `endpoint`,
  avec `user_id` issu de la session. `user_agent` lu dans les headers.
- `DELETE` — corps `{ endpoint }`. Supprime la ligne de l'utilisateur courant.

Client Supabase par cookies (session utilisateur), RLS active.

### 5. Cron — `app/api/cron/morning-push/route.ts`

Même garde Bearer que les crons existants. `runtime = 'nodejs'`,
`maxDuration = 60`.

1. **Garde horaire** : n'agir que si l'heure locale de Paris est dans
   `[07:00, 12:00[`, sinon retourner `{ skipped: true }` sans rien faire. La
   borne basse fait le travail décrit plus bas (DST + retard GitHub) ; la borne
   haute évite qu'un `workflow_dispatch` manuel en pleine journée n'envoie une
   notification « matinale » à 22h.
2. Sélectionner les abonnements dont `last_notified_on` est distinct du jour
   courant (Paris), triés par `last_notified_on` croissant (`nulls first`),
   **limités à 25 par invocation**.
3. Pour chaque `user_id` distinct du lot, avec un client **service-role** :
   - activités sur `EWMA_WARMUP_DAYS` (~1 an, mêmes colonnes que
     `getChargePageData`) + ligne `profiles` (FC max, FC repos, seuils, année de
     naissance) ;
   - `buildSportPayload(activités, hrZonesFromProfile(profile), now)` — **le
     payload `all` uniquement**, pas les quatre catégories ;
   - `planned_sessions` du jour (`athlete_id`, `date = aujourd'hui Paris`,
     `limit 1`, ordre `created_at`).
4. Composer le message (voir plus bas), envoyer via `web-push`.
5. Réponse **404 ou 410** → supprimer l'abonnement. Succès → écrire
   `last_notified_on = aujourd'hui (Paris)`. Autre erreur → laisser en l'état,
   le tick suivant réessaiera.
6. Retourner un compte `{ sent, removed, skipped }`.

**Budget d'exécution.** Une année d'activités par abonné sous `maxDuration = 60`
impose le plafond de 25. Les abonnements non traités sont repris au tick suivant
10 min plus tard ; l'idempotence `last_notified_on` garantit qu'aucun n'est
doublé ni perdu. Ce dimensionnement tient jusqu'à ~150 abonnés ; au-delà il
faudra une file, hors périmètre aujourd'hui.

### 6. Workflow — `.github/workflows/morning-push-cron.yml`

Calqué sur `strava-import-cron.yml` (curl + Bearer + contrôle du code HTTP).

```yaml
on:
  schedule:
    - cron: '7,17,27,37,47,57 5-10 * * *'   # UTC
  workflow_dispatch:
```

La fenêtre 05h–07h UTC couvre les deux régimes horaires sans jamais toucher au
workflow :

| | 7:00 Paris | Premier tick qui passe la garde |
|---|---|---|
| **Été** (UTC+2) | 05:00 UTC | le tick de 05:00 envoie ; 05:10→06:50 sont no-op |
| **Hiver** (UTC+1) | 06:00 UTC | 05:00→05:50 refusés par la garde ; 06:00 envoie |

La garde « ≥ 7:00 Paris » absorbe le changement d'heure, et l'idempotence rend le
**retard habituel de GitHub Actions (5 à 20 min) inoffensif** : si le tick de
05:00 arrive à 05:12, la notif part à 07:12, et aucun tick ultérieur ne la
double. En pratique : entre 7:00 et ~7:20.

## Contenu de la notification

- **Titre** : `Rapport matinal`
- **Corps** : `<verdict> · <séance>`
- **Tap** → `/rapport-matinal`

`<verdict>` = `fr.charge.verdict[payload.insights.status].action`, **point final
retiré** (les libellés se terminent par un point, qui rendrait le séparateur `·`
disgracieux). Exemples : `Lève le pied 1-2 jours`, `Bonne fenêtre pour
intensifier`, `Suis ton plan normalement`.

`<séance>` :

- aucune séance planifiée → `Aucune séance prévue` ;
- sinon → `<titre> — <durée>` via `formatDurationHHmm`, suivi de
  ` · <distance> km` si `distance` est non nulle.

Exemples rendus :

```
Rapport matinal
Lève le pied 1-2 jours · Sortie longue — 1h30 · 18 km

Rapport matinal
Bonne fenêtre pour intensifier · Aucune séance prévue
```

Un utilisateur sans historique obtient `insufficient` → « Pas encore assez de
données » : phrase correcte, envoyée telle quelle.

**Langue : français uniquement.** Le cron ne lit pas la préférence de langue et
importe `fr` en dur. Localiser le corps impliquerait de résoudre la langue par
utilisateur puis de charger le bon dictionnaire — hors périmètre ici. Seuls les
libellés de l'UI des Paramètres sont traduits (`fr.ts` **et** `en.ts`).

## UI — Paramètres > Apparence

Interrupteur **« Notification du rapport matinal »** placé juste sous le toggle
« Rapport matinal » existant dans
[AppearanceSection.tsx](../../../components/settings/AppearanceSection.tsx) : les
deux réglages parlent du même écran.

**Différence importante avec le toggle voisin : cet état ne va pas dans
`ui_preferences`.** Un abonnement push est lié à un appareil, pas à un compte —
un athlète peut vouloir la notif sur son téléphone mais pas sur sa tablette. La
source de vérité est `registration.pushManager.getSubscription()` côté
navigateur, reflétée dans `push_subscriptions`. Le composant est donc autonome,
il **n'utilise pas** `PreferencesProvider` ni `SYNCED_KEYS`.

### Les quatre états

| Situation | Affichage |
|---|---|
| Push supporté | Interrupteur normal |
| iPhone hors écran d'accueil | Interrupteur masqué + consigne « Ajoute Trail Cockpit à ton écran d'accueil pour recevoir les notifications » |
| Permission refusée (`Notification.permission === 'denied'`) | Interrupteur OFF, verrouillé + consigne « Autorise les notifications dans les réglages de ton navigateur » |
| Pas de `PushManager` (navigateur ancien) | Bloc entièrement masqué |

Détection de l'installation :
`window.matchMedia('(display-mode: standalone)').matches || navigator.standalone`.

### Interactions

- **ON** : `Notification.requestPermission()` **dans le gestionnaire de clic** →
  si accordée, `registration.pushManager.subscribe({ userVisibleOnly: true,
  applicationServerKey })` → `POST /api/push/subscribe`. Si refusée,
  l'interrupteur reste OFF et bascule sur l'état « verrouillé ».
- **OFF** : `subscription.unsubscribe()` puis `DELETE /api/push/subscribe`.
- **Au montage** : lecture de `getSubscription()` — l'interrupteur reflète
  toujours l'état réel de *cet* appareil, jamais un état stocké. Un abonnement
  révoqué par le navigateur (celui-là même qui fait répondre 410 au serveur)
  apparaît donc naturellement en OFF, sans synchronisation à écrire.

## Fichiers touchés

1. **`supabase/migrations/046_push_subscriptions.sql`** *(nouveau)* — table + RLS.
2. **`package.json`** — dépendance `web-push`.
3. **`scripts/sw.template.js`** — handlers `push` et `notificationclick`.
4. **`lib/push/subscriptions.ts`** *(nouveau)* — accès service-role aux
   abonnements (lecture du lot, suppression sur 404/410, écriture de
   `last_notified_on`).
5. **`lib/push/morning-message.ts`** *(nouveau)* — **logique pure** : garde
   horaire Paris, composition titre/corps. Cœur de la couverture de tests.
6. **`lib/data/charge.ts`** — deux extractions minimes, sans changement de
   comportement : `buildSportPayload` passe en `export` ; la dérivation des
   zones FC (IIFE des lignes 138-150) devient `hrZonesFromProfile(profile)`,
   appelée par `getChargePageData` **et** par le cron.
7. **`app/api/push/subscribe/route.ts`** *(nouveau)* — `POST` / `DELETE`.
8. **`app/api/cron/morning-push/route.ts`** *(nouveau)* — le cron.
9. **`.github/workflows/morning-push-cron.yml`** *(nouveau)* — planification.
10. **`components/settings/PushNotificationToggle.tsx`** *(nouveau, client)* —
    l'interrupteur et ses quatre états.
11. **`components/settings/AppearanceSection.tsx`** — montage du composant.
12. **`lib/i18n/dictionaries/fr.ts` & `en.ts`** — libellé, hint, et les deux
    consignes (installation, permission refusée).

## Tests

Suite Jest sur `lib/push/morning-message.ts`, la seule logique non triviale :

- **garde horaire** : bords `06:59` / `07:00` et `11:59` / `12:00` heure de
  Paris, en été **et** en hiver ;
- **composition du corps** : avec séance / sans séance ; distance présente ou
  nulle ; retrait du point final du verdict ; chaque `StatusId` produit une
  phrase non vide ;
- **tri des abonnements morts** : quels codes HTTP déclenchent la suppression
  (404, 410) et lesquels non (500, réseau).

Pas de test d'intégration `web-push`, pas de mock de l'API Push du navigateur :
ça testerait le navigateur, pas notre code. La validation de bout en bout se
fait sur téléphone.

## Hors périmètre (YAGNI)

- Pas d'heure réglable ni de fuseau par utilisateur (7:00 Paris pour tous).
- Pas de choix des jours de la semaine.
- Pas de file d'attente ni de retry exponentiel — le balayage toutes les 10 min
  suffit.
- Pas de notification pour un autre événement (nouvelle activité, course
  approchante).
- Pas de centre de notifications in-app.

## Vérification

- `npx tsc --noEmit` + `npm run lint` + `npx jest __tests__/lib/push/`.
- Migration `046` : **à coller dans le SQL Editor Supabase** — elle n'est pas
  appliquée automatiquement.
- Variables Vercel `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` à créer avant le premier déploiement.
- Test manuel : activer le toggle sur iPhone installé → déclencher le workflow
  à la main (`workflow_dispatch`) — il court-circuite la fenêtre via `?force=1` (hors
  de cette fenêtre le cron est volontairement inerte) → la notification arrive,
  le tap ouvre `/rapport-matinal`.

## Drift notes

**Point d'entrée unique dans `charge.ts`.** Au lieu des deux exports prévus
(`buildSportPayload` et `hrZonesFromProfile`), le module n'expose plus qu'un
seul point d'entrée, `computeAllSportPayload(rows, profile, now)`, ainsi que
les constantes de colonnes `CHARGE_ACTIVITY_COLUMNS` / `CHARGE_PROFILE_COLUMNS`
partagées avec le cron. `buildSportPayload`, `hrZonesFromProfile`,
`rowToCesActivity` et le type `ActivityRow` restent privés au module : le
cron n'a besoin que du payload final, pas des étapes intermédiaires.

**Seules les séances au statut `planned` sont annoncées.** Le cron filtre
`planned_sessions` sur `status = 'planned'` : une séance déjà marquée
`completed`, `skipped` ou `moved` fait basculer la ligne « séance » de la
notification sur « Aucune séance prévue » plutôt que d'afficher une séance
obsolète ou déjà faite. Décision produit de Franck, la version initiale de la
spec ne filtrait pas sur le statut.

**`POST /api/push/subscribe` écrit en service role.** Sous RLS utilisateur,
l'upsert `onConflict: 'endpoint'` ne peut pas réattribuer un endpoint d'un
compte à un autre — la policy `UPDATE` s'évalue contre la ligne existante, pas
la nouvelle. Le service role lève cet obstacle technique : il permet à
l'endpoint d'un appareil déjà enregistré au nom d'un compte A d'être réécrit
au nom d'un compte B **si B retouche l'interrupteur** sur ce même appareil.
Mais rien ne pousse B à le faire : l'interrupteur reflète
`pushManager.getSubscription()`, qui répond « abonné » dès que le navigateur a
un abonnement actif — peu importe qui l'a créé. Sur un navigateur partagé (A se
déconnecte, B se connecte), B voit donc l'interrupteur déjà sur ON et n'a
aucune raison d'y toucher : le service role seul ne ferme pas la fuite (le
cron continue d'envoyer le verdict et la séance de A sur l'appareil désormais
utilisé par B). C'est le désabonnement à la déconnexion
(`components/settings/AccountSection.tsx`) qui la ferme : en retirant
l'abonnement du compte sortant avant le `signOut`, l'appareil redémarre sans
abonnement et B doit retoucher l'interrupteur pour en créer un nouveau — cette
fois à son nom, via le mécanisme de réattribution décrit ci-dessus.
L'authentification reste par cookies pour les deux routes et `user_id`
provient toujours de la session, jamais du corps de la requête ; seule
l'écriture du `POST` bascule en service role. Le `DELETE` reste entièrement
par cookies (RLS active).

**Le workflow GitHub Actions sérialise ses invocations.** Un bloc
`concurrency` (`group: morning-push-cron`, `cancel-in-progress: false`)
empêche deux runs de se chevaucher : sans lui, deux exécutions concurrentes
liraient le même lot d'abonnements non marqués et enverraient certaines
notifications en double. `cancel-in-progress` reste à `false` pour ne jamais
interrompre un run à mi-lot, ce qui laisserait des abonnés notifiés côté
serveur push mais jamais marqués `last_notified_on` — pire que d'attendre la
fin du run précédent.

**Le push et `/rapport-matinal` peuvent nommer des séances différentes.** Le
cron filtre `planned_sessions` sur `status = 'planned'` (note ci-dessus) ;
`getMorningReportData` ([lib/data/morning-report.ts](../../../lib/data/morning-report.ts))
ne filtre pas sur `status` pour sa propre requête `planned_sessions` du jour —
il retient la première séance créée (`created_at`), quel que soit son statut.
Conséquence : une séance déjà `completed` fait dire « Aucune séance prévue »
au push, pendant que la page `/rapport-matinal` l'affiche normalement. Et avec
deux séances le même jour dont la première créée est déjà terminée, le push
et la page nomment deux séances différentes (le push saute la première et
retient la seconde encore `planned`, la page affiche la première).

**Le désabonnement côté navigateur a lieu même si le `DELETE` serveur échoue.**
Choix délibéré, pas un oubli : contrairement à un `POST` échoué (qui ferait
mentir l'interrupteur en affichant ON alors que rien n'arrivera), un `DELETE`
échoué suivi du désabonnement ne ment pas — l'interrupteur affiche OFF et les
notifications cessent réellement sur cet appareil. La ligne orpheline côté
serveur est purgée automatiquement par le cron au premier 404/410 renvoyé par
le service de push.

### GitHub Actions n'est qu'un filet ; la fenêtre va jusqu'à midi

Le design d'origine reposait sur une hypothèse fausse : « le retard habituel de
GitHub Actions est de 5 à 20 minutes ». Le 2026-08-03, sur les **12
déclenchements planifiés** entre 05:00 et 06:50 UTC, GitHub en a exécuté **un
seul**, à 08:44 UTC — soit 10h44 heure de Paris. La borne haute de la fenêtre
était à 10h : le run a été refusé, et personne n'a reçu sa notification.

Deux enseignements, tous deux appliqués :

- GitHub **ne rattrape pas** les occurrences manquées, et 05:00/06:00 UTC sont
  des heures de pointe (tout le monde planifie aux heures rondes). Les minutes
  sont donc décalées (`7,17,27,…`) et la plage étendue à 05h-10h UTC.
- La fenêtre de la route va désormais jusqu'à **midi** heure de Paris. Cinq
  heures de marge, sans risque de doublon grâce à `last_notified_on`.

Le déclencheur **principal** est désormais un service d'ordonnancement externe
précis à la minute ; le workflow GitHub reste en second, comme filet. Avoir deux
déclencheurs est sans danger : le premier arrivé envoie et marque, le second ne
trouve plus rien à faire.

### `?force=1` pour tester hors fenêtre

La garde horaire protège d'un envoi « matinal » égaré en pleine journée. Un
appel manuel étant une intention explicite, il peut la court-circuiter via
`?force=1`. Sans ce paramètre, vérifier la chaîne complète imposait d'attendre
le lendemain matin à chaque itération. L'appel reste protégé par le Bearer, et
l'idempotence continue de s'appliquer : forcer deux fois le même jour n'envoie
rien la seconde fois — il faut remettre `last_notified_on` à `NULL` pour
retester.
