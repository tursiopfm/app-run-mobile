# Modèle CES en couches sur streams (SP-2)

**Date :** 2026-06-03
**Scope :** Web app (`web/`) — `lib/analytics/effort-score.ts`, `lib/activities/stream-metrics.ts`, recalcul/sync
**Fonctionnalités :** réécriture du facteur d'intensité (IF) et de la charge musculaire pour exploiter les métriques de streams (SP-1) et rapprocher le CES du ressenti athlète (priorité trail/ultra, puis marathon).

> **Sous-projet 2** du chantier streams. SP-1 (ingestion streams + métriques dérivées) est livré : `docs/superpowers/specs/2026-06-03-streams-ingestion-design.md`. SP-2 consomme `grade_adjusted_pace_s`, `decoupling_pct`, `elevation_loss_m` (table `activity_metrics`).

---

## Contexte

Le CES actuel (`computeCesResult`) calcule l'IF run/trail depuis l'**allure moyenne vs allure seuil**, corrigé par un **FacteurDénivelé** sur le D+. Deux limites établies (cf. MODELE_MATHEMATIQUE) : l'allure moyenne est faussée par la pente (une montée raide paraît « facile »), et la FC n'entre nulle part (la dérive cardiaque = le « mur » ultra/marathon est invisible).

SP-1 a rendu disponibles, par activité (mai+juin 2026 backfillés) :
- `grade_adjusted_pace_s` — allure plate équivalente (VAP par segment, Minetti)
- `decoupling_pct` — dérive aérobie (chute d'efficience FC entre 1ère et 2e moitié)
- `elevation_loss_m` — D-

### Prototype sur données réelles (27 sorties mai+juin) — décisif

1. **La GAP-IF est fiable et plus cohérente.** Ex. Côte d'Igny 1000 m D+ (2h, 9 km) : allure brute → IF **0,42** (« facile », compensé par un FacteurDénivelé ×2,29) ; GAP → IF **0,68** (vrai effort de grimpe soutenu). Le CES global bouge peu (−9 % à +13 %) mais récompense l'intensité de montée réelle au lieu de multiplier le D+.

2. **⚠️ Le `decoupling_pct` de SP-1 est inexploitable sur trail.** Il utilise la vitesse **brute** comme output ; or sur trail la vitesse est pilotée par le terrain → comparer 1ère/2e moitié capte l'asymétrie du parcours, pas la dérive cardio. Valeurs aberrantes observées : −36,9 %, −42,4 %, −39,2 %. **Doit être corrigé avant tout usage dans le score.**

### Décisions verrouillées (brainstorming 2026-06-03)

1. **Validation** : comparatif SP-2 vs CES actuel sur les sorties réelles + jugement à l'œil de Franck ; calibration empirique des coefficients.
2. **K_cardio** : correctif **multiplicatif borné** sur le CES (hors IF²), piloté par le découplage **positif** uniquement (découplage ≤ 0 → pas de pénalité).
3. **Activités sans streams** : **fallback gracieux** au calcul actuel (le récent mai+juin est 100 % SP-2 ; l'historique ancien reste sur l'ancien calcul).

---

## C1 — Corriger la métrique de découplage (prérequis)

Fichier : `web/lib/activities/stream-metrics.ts`.

`decouplingPct` doit utiliser, comme output, la **vitesse ajustée pente par échantillon** (`velocity[i] × gradeAdjustmentFactor(grade[i]/100)`) au lieu de la vitesse brute. Ainsi l'efficience EF = (vitesse plate équivalente) / FC ne dépend plus du terrain, et la dérive mesurée est réellement cardiaque.

- Découpage 1ère/2e moitié inchangé ; seul le calcul de l'output change.
- Recalcul depuis les **streams bruts déjà stockés** (`activity_streams.streams_gz`), sans re-fetch Strava : un batch qui dé-gzip, recalcule `decoupling_pct`, met à jour `activity_metrics`.
- Garde-fous inchangés : null si pas de FC / durée < 20 min.

**Critère** : sur les trails du prototype, les aberrations (−30 à −42 %) doivent disparaître au profit de valeurs physiologiquement plausibles (typiquement −5 % à +15 %).

---

## C2 — `calcIF` en couches

Fichier : `web/lib/analytics/effort-score.ts`. `computeCesResult` prend un paramètre supplémentaire optionnel `streamMetrics?: { gradeAdjustedPaceS, decouplingPct, elevationLossM }`.

```
Couche 1 — Base mécanique
  • Vélo (thresholdPower ≠ null) : NP|avg / FTP            (INCHANGÉ)
  • Run / Trail AVEC streams      : seuil / grade_adjusted_pace_s
  • Run / Trail SANS streams      : seuil / allure_moyenne  (calcul actuel)
  • Marche/rando/natation sans allure seuil : couche 3
  IF = clamp(IF, cfg.minIF, cfg.maxIF)

Couche 2 — K_cardio (correctif borné, hors IF²)  [si decoupling_pct présent]
  K_cardio = clamp(1 + BETA × max(0, decoupling_pct), 1.0, KCARDIO_CAP)
  → appliqué en multiplicateur du CES final
  → BETA ≈ 0.01, KCARDIO_CAP ≈ 1.15  (à caler à l'œil, cf. §Calibration)

Couche 3 — Fallback FC pur  [aucune allure/puissance]
  IF_FC = clamp(HR_relative / 0.85, minIF, maxIF)   où HR_relative = (avgHr−restHr)/(maxHr−restHr)
  → si pas de FC non plus : cfg.defaultIF (legacy)
```

**Facteur dénivelé sur le chemin cardio** :
- Run/trail **avec** GAP : le D+ est déjà dans l'IF → **pas** de FacteurDénivelé sur le CES global (évite le double-comptage).
- Run/trail **sans** streams (fallback) : on garde le FacteurDénivelé actuel sur D+ (sinon la montée serait sous-comptée).
- Vélo : FacteurDénivelé inchangé.

`model` reflète le chemin : `'pace_gap'` | `'pace_threshold'` (fallback) | `'power'` | `'hr_proxy'` | `'legacy'`. `confidence` : `high` si GAP+seuil perso, dégradé si fallback/manquant.

---

## C3 — Charge musculaire via descente (D-)

Remplace `muscleLoad = round(finalScore × 0.6)` par un facteur descente piloté par `elevation_loss_m` :

```
K_descent  = 1 + min(KDESCENT_CAP, (D-_m / distance_m × 100) × descentSens × 0.01)
muscleLoad = round(baseScore × sportFactor × K_descent)
```

- `descentSens` par sport (fort trail/VTT/hike, nul natation/HT/mobilité) — valeurs de départ à poser, ex. trail 14, run 6, hike 16, mtb 10.
- `KDESCENT_CAP` ≈ 0,5.
- Sans `elevation_loss_m` (pas de streams) : fallback à l'ancien `finalScore × 0.6`.

---

## Flux de données & fallback

- Le pipeline de recalcul (`web/lib/sync/recalculate-scores.ts`) et l'upsert webhook lisent `activity_metrics` (clés `grade_adjusted_pace_s`, `decoupling_pct`, `elevation_loss_m`) et passent les valeurs à `computeCesResult` via `streamMetrics`.
- Métriques absentes → chemins fallback ci-dessus (calcul actuel). Aucune régression sur les activités non streamées.
- Une activité fraîche bascule de fallback → SP-2 complet dès que le backfill streams l'attrape (recalc ciblé).

---

## Recalcul & recalibration

- `POST /api/profile/recalculate` rejoue l'historique (déjà en place) : recalcule CES + EWMA.
- Vérifier après bascule que les seuils de charge (`LOAD_BALANCE`, `FRESHNESS`, `STRAIN`) tiennent. Le prototype montre un CES global à ±10 % → a priori OK, mais à confirmer sur la courbe ATL/CTL réelle ; recalibrer si dérive notable.

---

## Validation (méthode retenue)

Table comparative **CES actuel vs SP-2** (+ IF, K_cardio, muscleLoad) sur les sorties mai+juin réelles, jugée à l'œil par Franck contre son souvenir du ressenti. Itérer `BETA`, `KCARDIO_CAP`, `descentSens` jusqu'à cohérence. Cas de référence à surveiller :
- Côte d'Igny 1000 D+ : intensité de montée doit monter (IF ~0,68, pas 0,42).
- La Boucle 42 km (découplage réel +8,6 %) : léger bonus K_cardio attendu.
- Sorties vallonnées à D+ modéré : ne doivent plus être sur-récompensées par le FacteurDénivelé.

---

## Hors scope

- Backfill de l'historique ancien (pré-mai) — exclu volontairement (épargne Strava).
- `time_in_hr_zone` réel (reporté ; l'estimation loi-normale actuelle reste en place).
- Streams Garmin (futur connecteur).
- Refonte UI au-delà d'exposer éventuellement les nouvelles métriques.

---

## Points de calibration ouverts (à fixer pendant l'implémentation)

1. `BETA` et `KCARDIO_CAP` du K_cardio (départ 0,01 / 1,15).
2. `descentSens` par sport et `KDESCENT_CAP`.
3. Faut-il recalibrer `LOAD_BALANCE`/`FRESHNESS` après bascule (à trancher sur la courbe réelle).
