# Ingestion des streams Strava + métriques dérivées (SP-1)

**Date :** 2026-06-03
**Scope :** Web app (`web/`) — providers Strava, base Supabase, cron
**Fonctionnalités :** fetch des streams Strava (altitude/FC/temps/vitesse/distance/pente), downsample + compression, stockage, backfill throttlé, intégration webhook, calcul de métriques dérivées par activité.

> Ce document est le **sous-projet 1** d'un chantier en deux temps. Le **sous-projet 2** (refonte du modèle d'intensité en couches : IF VAP par segment, K_cardio drift-aware, charge musculaire descente) aura sa propre spec, rédigée **après** que SP-1 livre les données — la calibration du modèle est impossible sans les streams réels.

---

## Contexte

Le moteur de charge (CES) calcule aujourd'hui l'intensité (IF) à partir de l'**allure moyenne vs allure seuil** (run/trail) ou de la **puissance vs FTP** (vélo), corrigée par un **FacteurDénivelé** sur le D+. La FC n'entre nulle part dans le CES (cf. `docs/reference/MODELE_MATHEMATIQUE.md` §8, bandeau « non implémenté »).

Un objectif a émergé : rapprocher le CES du **ressenti réel** des athlètes en marathon, trail et **ultra** (priorité trail). Trois pistes ont été identifiées :
1. **VAP** (Velocity-Adjusted Pace, déjà codée dans `web/lib/activities/vap.ts`) pour corriger la distorsion de l'allure par la pente.
2. **K_cardio** : correctif borné capturant le coût cardio non visible dans l'allure (dérive cardiaque, chaleur, fatigue).
3. **Fallback FC** pur pour les sports sans allure seuil (marche/rando).

### Pourquoi « streams d'abord »

Un test sur les activités réelles de Franck (semaine du 26/05 au 03/06, 13 activités) a montré :

- **CES cardio quasi inchangé** : VAP qui remplace le FacteurDénivelé se compensent sur terrain à densité D+ modérée → **+1 % sur la semaine**. Rassurant pour la recalibration, mais sans gain de ressenti.
- **K_cardio totalement inerte (×1,000 partout)** : sur les données de Franck, l'IF mécanique (allure/VAP vs seuil) est **systématiquement supérieur** à l'IF cardiaque (`HR_rel/0,85`). Un correctif « upward-only » ne se déclenche jamais. Causes : seuils par défaut non calibrés **et** surtout **FC moyenne qui masque la dérive** (ex. « La Boucle » 42 km / 5h28 reste à FC moy 135 = Z2 alors que la dérive y est forte).
- **Facteur descente non calculable** : la table `activities` n'a **pas** de colonne `elevation_loss_m`, et Strava ne fournit pas le D- en résumé.

**Conclusion** : les trois leviers de ressenti (descente musculaire, dérive cardiaque, VAP fidèle au terrain vallonné) sont **tous bloqués par l'absence de données temporelles**. Les streams ne sont donc pas une amélioration optionnelle « Phase 2 » : ils sont le **prérequis**. Un seul fetch de streams débloque les trois d'un coup.

### Décisions verrouillées (brainstorming 2026-06-03)

1. **Architecture du modèle (SP-2)** : couches additives — base VAP/puissance + correctif K_cardio borné si FC + fallback FC pur.
2. **FacteurDénivelé** : repurposé en **facteur descente musculaire** basé sur D- (cardio montée → VAP/IF ; musculaire descente → muscleLoad).
3. **Données** : streams en prérequis, modèle construit dessus.
4. **Stockage** : **raw downsamplé + compressé** (recalcul local possible à chaque itération du modèle, sans re-fetcher Strava).

---

## 1. Fetch des streams Strava

Endpoint :

```
GET /api/v3/activities/{id}/streams
    ?keys=time,altitude,heartrate,velocity_smooth,distance,grade_smooth
    &key_by_type=true
```

- Scope `activity:read` — déjà accordé pour l'import d'activités.
- 1 appel API par activité.
- Les streams absents (ex. pas de capteur FC) sont simplement omis du payload → on stocke ce qui existe.
- Implémentation dans `web/lib/providers/strava/` (nouveau module `streams.ts`), réutilisant le rafraîchissement de token existant.

### Rate limits

Strava : ~**200 req / 15 min** et ~**2000 req / jour** (limites app standard). Le backfill de l'historique (centaines d'activités) doit donc être **throttlé** (cf. §3).

---

## 2. Downsample + compression

- **Sous-échantillonnage** : ~**1 point / 5 s**. Un ultra de 5 h passe de ~18 000 à ~3 600 points. Suffisant pour la dérive cardiaque, le D- et la VAP par segment.
- **Compression** : sérialisation JSON `{ time[], altitude[], heartrate[], velocity[], distance[], grade[] }` puis **gzip**, stockée en `bytea`. Taille attendue ~30–80 KB/activité (TOAST Postgres gère).
- Pas de bucket Supabase Storage pour l'instant : une colonne `bytea` en table dédiée est plus simple et suffisante à cette échelle.

---

## 3. Schéma base de données

### Nouvelle table `activity_streams`

```sql
create table activity_streams (
  activity_id   uuid primary key references activities(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  downsample_s  int  not null default 5,
  point_count   int  not null,
  streams_gz    bytea not null,   -- gzip( {time,altitude,heartrate,velocity,distance,grade} )
  source        text not null default 'strava',
  fetched_at    timestamptz not null default now()
);

create index activity_streams_user_id_idx on activity_streams(user_id);

alter table activity_streams enable row level security;
create policy "own streams" on activity_streams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Colonnes de métriques dérivées sur `activities`

```sql
alter table activities
  add column elevation_loss_m   numeric,
  add column decoupling_pct     numeric,   -- dérive aérobie (%) ; null si pas de FC ou trop court
  add column grade_adjusted_if  numeric,   -- IF VAP par segment ; null si pas de streams
  add column time_in_hr_zone    jsonb,     -- [z1,z2,z3,z4,z5] en secondes ; null si pas de FC
  add column streams_metrics_at timestamptz;
```

> ⚠️ Migrations Supabase **non auto-appliquées** : rappeler à Franck de coller le SQL dans le SQL Editor (ou `supabase db push`). Numéroter le fichier dans `web/supabase/migrations/` à la suite des existants.

---

## 4. Backfill throttlé

Route cron `web/app/api/cron/strava-streams-backfill/` :

- À chaque exécution, traite un **batch** borné (ex. 50 activités) parmi celles **sans ligne `activity_streams`**, par ordre chronologique décroissant (les plus récentes d'abord).
- Respecte un budget rate-limit conservateur (ex. ≤ 150 appels / run, marge sous la limite 200/15 min).
- **Resumable** : l'absence de ligne `activity_streams` = critère de reprise idempotent.
- Réutilise le suivi `import-status` existant (`web/app/api/strava/import-status/`) pour exposer la progression à l'UI.
- Le backfill complet de l'historique s'étale sur quelques heures/jours selon le volume.

---

## 5. Nouvelles activités

- À la réception d'un webhook Strava (`aspect_type=create`) ou lors d'un import, **enqueue un fetch de streams** pour la nouvelle activité.
- Fetch inline si le budget rate-limit du moment le permet ; sinon laisser le backfill cron la rattraper (elle n'a pas de ligne `activity_streams`).

---

## 6. Métriques dérivées (le pont vers SP-2)

Calculées **depuis les streams stockés** (donc recalculables en local à volonté), écrites dans les colonnes du §3. Module `web/lib/activities/stream-metrics.ts`.

| Métrique | Calcul | Débloque |
|---|---|---|
| **`elevation_loss_m`** (D-) | somme des deltas négatifs du stream `altitude` (avec lissage anti-bruit GPS) | Facteur descente musculaire (muscleLoad) |
| **`decoupling_pct`** | `(EF_2e_moitié / EF_1re_moitié − 1) × 100`, où `EF = output / FC` (output = vitesse ajustée pente, ou puissance vélo). Null si pas de FC ou durée trop courte (< ~20 min) | K_cardio **drift-aware** → ressenti marathon/ultra |
| **`grade_adjusted_if`** | VAP **par segment** : pour chaque pas, `gradeAdjustmentFactor(grade)` × vitesse → vitesse plate équivalente, moyennée puis comparée au seuil. Réutilise `vap.ts`. | IF fidèle au terrain vallonné (vs pente moyenne diluée) |
| **`time_in_hr_zone[5]`** | temps réel passé dans chaque zone FC (depuis le stream `heartrate` + zones du profil) | Remplace l'estimation par loi normale tronquée (`distributeTimeInZones`) |

Ces métriques sont **descriptives** en SP-1 (calculées et stockées, exposables en UI) ; leur **intégration dans le CES** est l'objet de SP-2.

---

## 7. Hors scope SP-1 (→ SP-2)

- Réécriture de `calcIF()` / `computeCesResult()` (couches additives).
- Branchement de `grade_adjusted_if` et `decoupling_pct` dans le CES et le muscleLoad.
- Recalcul de l'historique CES + recalibration des seuils de charge (`LOAD_BALANCE`, `FRESHNESS`).
- Calibration des coefficients (`K_cardio` α/cap, `descentSens` par sport).
- Affichage UI des nouvelles métriques (au-delà d'une éventuelle exposition brute de debug).

---

## 8. Tests

- `stream-metrics.test.ts` : D- sur profil altitude synthétique (montée/descente connues) ; decoupling sur séries 1re/2e moitié contrôlées ; grade-adjusted IF vs cas plat (doit ≈ allure brute) ; time-in-zone vs zones connues.
- Fetch : mock de la réponse Strava (streams partiels, streams absents).
- Backfill : sélection idempotente (activités sans ligne), respect du batch borné.
- Downsample/compression : round-trip gzip, réduction du nombre de points.

---

## 9. Risques & points ouverts

- **Bruit GPS sur l'altitude** : le D- brut est sur-estimé par le jitter. Prévoir un lissage (seuil de delta minimal, ex. ignorer les variations < 1 m). À valider sur tes activités réelles une fois le fetch en place.
- **Activités sans FC** : `decoupling_pct` et `time_in_hr_zone` restent null → SP-2 devra gérer le fallback proprement.
- **Volume backfill** : à mesurer (nombre d'activités × taille gzip moyenne) pour confirmer le stockage et le temps de backfill.
- **`grade_smooth` Strava vs calcul maison** : Strava fournit `grade_smooth` ; on peut soit l'utiliser, soit recalculer la pente depuis `altitude`+`distance`. À trancher à l'implémentation (cohérence avec `vap.ts`).
