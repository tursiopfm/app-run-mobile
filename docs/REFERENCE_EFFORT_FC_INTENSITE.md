# Référence — Effort, Fréquence Cardiaque, Intensité

Document de référence pour tous les calculs liés à l'effort, la FC et l'intensité dans Trail Cockpit.
**Source de vérité** : ce document prime sur les commentaires dans le code.

---

## 1. Zones de fréquence cardiaque

### 1.1 Méthodes disponibles

Fichier : `web/lib/health/hr-zones.ts` — `calculateHrZones()`

Cinq méthodes, de la plus précise à la plus approximative :

| Méthode | Clé | Données requises | Confiance |
|---|---|---|---|
| Seuils mesurés | `seuils` | FC max + AeT + LTHR | Excellente |
| Test 30 min | `test30` | FC max + LTHR | Très bien |
| Karvonen | `karvonen` | FC max + FC repos | Bien |
| % FC max | `pct_max` | FC max | Correcte |
| Automatique | `auto` | Année naissance | Approximative |

La méthode active de l'utilisateur est stockée dans localStorage sous la clé `tc_hr_zone_method`.

---

### 1.2 Méthode Seuils (`seuils`)

Utilise les seuils physiologiques mesurés en laboratoire ou test terrain.

```
Z1 max = AeT - 11
Z2 min = AeT - 10,  Z2 max = AeT
Z3 min = AeT + 1,   Z3 max = LTHR - 8
Z4 min = LTHR - 7,  Z4 max = LTHR + 3
Z5 min = LTHR + 4,  Z5 max = FC max
```

Paramètres : `maxHr`, `aerobicThresholdHr` (AeT), `thresholdHr` (LTHR)

---

### 1.3 Méthode Test 30 min (`test30`)

Basée sur la LTHR mesurée par un test de 30 min (Coggan).
Applique des pourcentages de LTHR, plafonnés à FC max.

```
Z1 : 0 – 85 % LTHR
Z2 : 85 – 89 % LTHR
Z3 : 90 – 94 % LTHR
Z4 : 95 – 99 % LTHR
Z5 : 100 % LTHR → FC max
```

Paramètres : `maxHr`, `thresholdHr` (LTHR)

---

### 1.4 Méthode Karvonen (`karvonen`)

Basée sur la réserve cardiaque (FCR = FC max − FC repos).

```
Formule : FC zone = FC repos + pct × FCR
FCR = FC max − FC repos

Z1 : < FC repos + 60 % FCR
Z2 : FC repos + 60 % – 70 % FCR
Z3 : FC repos + 70 % – 80 % FCR
Z4 : FC repos + 80 % – 90 % FCR
Z5 : FC repos + 90 % FCR – FC max
```

Paramètres : `maxHr`, `restingHr`

**Exemple** (FC max 195, FC repos 57, FCR = 138) :
- Z1 ≤ 140 bpm
- Z2 : 141 – 154 bpm
- Z3 : 155 – 167 bpm
- Z4 : 168 – 181 bpm
- Z5 : 182 – 195 bpm

---

### 1.5 Méthode % FC max (`pct_max`)

Méthode simple basée uniquement sur la FC max.

```
Z1 : 0 – 72 % FC max
Z2 : 72 – 78 % FC max
Z3 : 78 – 85 % FC max
Z4 : 85 – 92 % FC max
Z5 : 92 % – FC max
```

Paramètre : `maxHr`

---

### 1.6 Méthode Auto (`auto`)

Estime la FC max par âge (formule Tanaka).

```
FC max estimée = 208 − 0.7 × âge
```

Puis applique les mêmes % que `pct_max`.

Paramètre : `birthYear`

---

### 1.7 Noms et couleurs des zones

```
Z1 Récupération           #4caf50 (vert)
Z2 Endurance fondamentale #38bdf8 (bleu ciel)
Z3 Endurance active       #f59e0b (ambre)
Z4 Seuil                  #e8651a (orange)
Z5 Très intense           #ef4444 (rouge)
```

---

### 1.8 Profil HR stocké en localStorage

La clé `tc_athlete_hr` contient l'objet JSON du profil HR :

```json
{
  "maxHr": 195,
  "restingHr": 57,
  "aerobicThresholdHr": 155,
  "thresholdHr": 174,
  "birthYear": 1980
}
```

Sauvegardé automatiquement par `ProfileCardioSection` lors de l'enregistrement du profil.

---

## 2. Déterminer la zone d'une activité

### 2.1 `hrZoneForAvgHr`

Fichier : `web/lib/health/hr-zones.ts`

Retourne le numéro de zone (1–5) correspondant à un `avg_hr` donné, en parcourant les zones dans l'ordre et en retournant la première dont `avgHr ≤ z.max`.

```
si avgHr ≤ Z1.max → zone 1
si avgHr ≤ Z2.max → zone 2
...
si avgHr > Z5.max → zone 5 (clamped)
```

Retourne `null` si le tableau de zones est vide.

---

### 2.2 Distribution du temps par zone (loi normale tronquée)

Fichier : `web/components/ui/ActivityHeartRateZones.tsx` — `distributeTimeInZones()`

Modélise la distribution de la FC pendant une activité comme une **loi normale tronquée** :

```
FC ~ N(avgHr, σ)  tronquée sur [restingHr, activityMaxHr]

σ = max((activityMaxHr − avgHr) / 2, 3)
```

**Pourquoi :** le max observé est ~2σ au-dessus de la moyenne → les zones au-dessus de `activityMaxHr` reçoivent automatiquement 0 seconde.

**Calcul pour chaque zone `[zMin, zMax]` :**

```
P(zone) = CDF(min(zMax, activityMaxHr)) − CDF(max(zMin, restingHr))

CDF(x) = 0.5 × (1 + erf((x − avgHr) / (σ × √2)))
```

La fonction `erf` est approximée par Abramowitz & Stegun (erreur < 1.5e-7) pour fonctionner côté client sans librairie.

**Temps par zone :**

```
temps_zone_i = round(P(zone_i) / Σ_P × movingTimeSec)
```

Le dernier bucket absorbe les secondes restantes pour que la somme soit exacte.

**Si `restingHr` inconnu :**

```
restingHr estimé = max(avgHr − 3σ, 40)
```

---

## 3. Intensité et Type de séance

L'édition d'une activité distingue deux notions indépendantes :
- **Intensité** — notion physiologique, fondée uniquement sur la fréquence cardiaque.
- **Type de séance** — notion contextuelle, fondée sur les mots-clés du titre.

Fichier : `web/lib/activities/intensity.ts`

---

### 3.1 Intensité — `IntensityKey`

Cinq valeurs, chacune correspondant à une zone FC :

| Clé | Emoji | Libellé | Zone FC |
|---|---|---|---|
| `recuperation` | 😴 | Récupération | Z1 |
| `footing` | 🦶 | Footing | Z2 |
| `endurance_active` | 🔄 | Endurance active | Z3 |
| `seuil` | 🎯 | Seuil | Z4 |
| `vma` | 🔥 | VMA | Z5 |

Stockée dans la colonne `manual_intensity` de la table `activities` (override manuel de l'utilisateur).

---

### 3.2 `guessIntensity` — calcul détaillé depuis la fréquence cardiaque

```ts
guessIntensity(
  avgHr?: number | null,
  hrZones?: HrZone[],
  opts?: { activityMaxHr?, movingTimeSec?, restingHr? },
): IntensityKey | null
```

Aucun mot-clé, aucun titre, aucun CES. La fonction utilise **uniquement** des données FC.

Deux modes selon les données disponibles :

- **Mode distribution (préféré)** — si `activityMaxHr` et `movingTimeSec` sont fournis : on calcule la répartition du temps dans les 5 zones (loi normale tronquée, section 2.2), puis on applique une règle de bascule sur la distribution.
- **Mode FC moyenne (fallback)** — sinon : on prend la zone qui contient `avgHr` directement.

#### Algorithme — mode distribution

**Étape 1 — Garde-fou :**

```
si avgHr == null ou hrZones vide          → null
si activityMaxHr ≤ avgHr OU movingTimeSec ≤ 0 → fallback FC moyenne
```

**Étape 2 — Calculer la distribution :**

`distributeTimeInZones(zones, avgHr, activityMaxHr, movingTimeSec, restingHr)` retourne un tableau `[Z1, Z2, Z3, Z4, Z5]` de secondes par zone (loi normale tronquée — voir section 2.2 pour la dérivation mathématique).

Si `restingHr` est absent, il est estimé par `max(avgHr − 3σ, 40)` où `σ = max((activityMaxHr − avgHr) / 2, 3)`.

**Étape 3 — Cascade par zone supérieure (premier match gagne) :**

```
total = Z1 + Z2 + Z3 + Z4 + Z5

si  Z5 / total       ≥ 15 %  →  'vma'              (effort VO₂max stable)
si (Z4 + Z5) / total ≥ 20 %  →  'seuil'            (séance "qualité" HIT)
si (Z3 + Z4 + Z5) / total ≥ 40 %  →  'endurance_active' (intensité moyenne soutenue)
si  Z2 ≥ Z1                    →  'footing'         (endurance fondamentale dominante)
sinon                            →  'recuperation'   (Z1 dominant)
```

**Justification des seuils (littérature) :**

| Seuil | Source | Logique |
|---|---|---|
| Z5 ≥ 15 % | Daniels — "I" (Interval/VO₂max) = 3×5 min en Z5 → ~25 % d'une séance d'1 h ; 15 % capture les vraies séances VO₂max sans inclure les pics fugaces des fractionnés courts | Empreinte VO₂max stable |
| Z4+Z5 ≥ 20 % | Seiler & Kjerland (polarized training) — TID HIT typique chez l'élite : 15-20 % du volume hebdo en zones hautes ; 20 % en intra-séance = stimulus supra-seuil clairement marqué | Séance "qualité" |
| Z3+ ≥ 40 % | Empirique — au-delà de 40 % du temps actif au-dessus de Z2, la séance n'est plus une "endurance fondamentale" même si la FC moyenne reste en Z2 | Capture trail vallonné, sortie progressive |

**Pourquoi cascade et pas "max(Z3, Z4, Z5)" ?**

Une cascade par zone supérieure significative reflète la **plus haute intensité atteinte de manière mesurable**, indépendamment du temps passé en Z3. Une séance qui passe 39 % en Z3 + 25 % en Z4 + 8 % en Z5 = 72 % en Z3+, dont Z3 dominant numériquement. La règle "max" donnerait `endurance_active`, ce qui écraserait totalement le signal `seuil`. La cascade donne `seuil` car Z4+Z5 = 33 % ≥ 20 %.

**Cas particulier — fractionnés courts (300-400 m) :**

Sur des fractions de ~1 min, la FC met 20-30 s à monter en Z4-Z5 → la fraction est presque finie quand le pic est atteint. L'empreinte FC moyenne reste dominée par Z3-Z4. Conséquence : un "VMA 8×400" sera classé `seuil` (correct physiologiquement — c'est du travail sub-VO₂max au sens Daniels). Le caractère "fractionné" est capturé séparément par `WorkoutType` (chip Type → fractionné).

#### Algorithme — mode FC moyenne (fallback)

Utilisé quand on n'a pas assez de données pour la distribution (`activityMaxHr` ou `movingTimeSec` manquant) :

1. `hrZoneForAvgHr(avgHr, hrZones)` → numéro de zone 1–5.
2. `zoneToIntensity(zone)` → `IntensityKey`.

```
avgHr ≤ Z1.max → zone 1 → 'recuperation'
avgHr ≤ Z2.max → zone 2 → 'footing'
avgHr ≤ Z3.max → zone 3 → 'endurance_active'
avgHr ≤ Z4.max → zone 4 → 'seuil'
sinon          → zone 5 → 'vma'
```

#### Exemple complet (profil Karvonen, FC max 195, FC repos 57)

Zones calculées : Z1 ≤ 140, Z2 ≤ 154, Z3 ≤ 167, Z4 ≤ 181, Z5 ≤ 195

| Cas | avg_hr | activity max_hr | durée | Mode | Distribution Z1/Z2/Z3/Z4/Z5 | IntensityKey |
|---|---|---|---|---|---|---|
| Footing stable | 148 | 152 | 60 min | distribution | 7/52/1/0/0 (88 % en Z1+Z2) | `footing` |
| Trail vallonné* | 153 | 177 | 4h17 | distribution | 34/102/97/23/0 (47 % en Z3+) | **`endurance_active`** |
| Récup pure | 125 | 135 | 45 min | distribution | 45/0/0/0/0 (100 % Z1) | `recuperation` |
| Seuil 30 min | 172 | 178 | 30 min | distribution | 0/0/4/26/0 (100 % Z3+, Z4 dom.) | `seuil` |
| VMA 10×400 | 165 | 188 | 50 min | distribution | 0/2/12/16/20 (96 % Z3+, Z5 dom.) | `vma` |
| Sans max_hr | 153 | — | — | FC moyenne | — | `footing` |
| avgHr seul, null zones | 153 | — | — | — | — | `null` |

*Cas réel : activité "Trail des lavoirs" — FC moy en limite Z2/Z3 mais 47 % du temps en Z3+ → `endurance_active`. Le mode FC moyenne classerait à tort en `footing`.

#### Priorité dans l'UI

1. `manual_intensity` en base de données — override saisi par l'utilisateur dans le modal
2. `guessIntensity(avg_hr, hrZones, { activityMaxHr: max_hr, movingTimeSec, restingHr })` — calculé automatiquement
3. `null` — aucun chip actif (données FC absentes ou zones non configurées)

---

### 3.3 Type de séance — `WorkoutType`

Six valeurs, avec restrictions par sport pour runtaf et velotaf :

| Clé | Emoji | Libellé | Sports autorisés |
|---|---|---|---|
| `sortie_longue` | 🐢 | Sortie longue | tous |
| `fractionne` | ⌚ | Fractionné | tous |
| `cotes` | ⛰️ | Côtes | tous |
| `course` | 🏆 | Course | tous |
| `runtaf` | 🏃‍♂️💻 | Runtaf | `Run`, `TrailRun` uniquement |
| `velotaf` | 🚴🏻💻 | Velotaf | `Ride`, `EBikeRide`, `VirtualRide` uniquement |

Stockée dans la colonne `manual_workout_type` de la table `activities` (override manuel).
Colonne ajoutée par la migration `011_add_manual_workout_type.sql`.

---

### 3.4 `guessWorkoutType` — détection depuis le titre

```ts
guessWorkoutType(name: string, sport: string): WorkoutType | null
```

Ordre de priorité (premier match gagne) :

**1. Runtaf** — uniquement si sport ∈ {`Run`, `TrailRun`} :
- titre contient `runtaf`, `run taf`, ou `taf`
- ou nom exact `Home 🏃‍♂️` / `🏃‍♂️ Home`

**2. Velotaf** — uniquement si sport ∈ {`Ride`, `EBikeRide`, `VirtualRide`} :
- titre contient `vélotaf`, `velotaf`, `vélo taf`, ou `taf`
- ou nom exact `Home 🚴🏻` / `🚴🏻 Home`

**3. Côtes** :
- titre contient `côtes`, `cotes`, `côte`, `cote`, `montée`, `montee`, `hill`

**4. Fractionné** :
- titre contient une distance isolée (200, 300, 400, 500, 800, 1000 — non collée à d'autres chiffres)
- ou contient `vma`, `interval`, `fractionné`, `fractionnée`, `répétition`, `repetition`

**5. Course** (excluant `course à pied`) :
- titre contient `race`, `compét`, `compet`, `dossard`, `chrono`, ` pb `, ` pr `, `10k`, `semi`, `marathon`

**6. Sortie longue** :
- titre contient `sortie longue`, mot exact `sl`, `long run`, `lsl`

**7. `null`** — aucun match.

Dans l'UI, les options affichées sont filtrées par sport (runtaf masqué si sport = Ride, velotaf masqué si sport = Run, etc.). Si le sport change et que le type sélectionné est incompatible avec le nouveau sport, le type est réinitialisé à `null`.

#### Priorité dans l'UI

1. `manual_workout_type` en base de données — override saisi par l'utilisateur dans le modal
2. `guessWorkoutType(name, sport)` — calculé automatiquement depuis le titre
3. `null` — aucun chip actif

---

### 3.5 Mapping zone → label (graphique répartition intensité)

Utilisé dans `getIntensityLabel()` (`web/lib/data/dashboard.ts`) pour le graphique de répartition sur 30 jours glissants. Ce mapping est indépendant de `guessIntensity` — il sert uniquement à l'affichage agrégé du dashboard.

| Zone | Label graphique |
|---|---|
| Z1, Z2 | Footing |
| Z3 | Sortie longue |
| Z4 | Seuil |
| Z5 | VMA |

Fallback CES si pas de zones :

| CES | Label |
|---|---|
| ≤ 30 | Footing |
| 31–60 | Sortie longue |
| 61–100 | Seuil |
| 101–150 | VMA |
| > 150 | Runtaf |

---

## 4. Score d'effort CES (Cockpit Effort Score)

### 4.1 Formule générale

Fichier : `web/lib/analytics/effort-score.ts` — `computeCesResult()`

```
CES = DurationHours × SportBase × IF² × SportFactor × ElevationFactor
```

Avec :

```
DurationHours = movingTimeSeconds / 3600
```

**Principe :** 1 heure à intensité seuil (IF = 1.0) ≈ 100 points.

---

### 4.2 Intensity Factor (IF)

Priorité par sport :

**Course / trail :**
```
IF = thresholdPaceSecPerKm / avgPaceSecPerKm   (si distance > 200 m)
```

**Vélo :**
```
IF = normalizedPowerWatts / FTP   (ou averageWatts / FTP)
```

**Sinon :** utilise `defaultIF` du sport.

Toujours clampé entre `[minIF, maxIF]` propres à chaque sport.

---

### 4.3 Facteur dénivelé

```
gain_per_100m = (elevationGainMeters / distanceMeters) × 100
ElevationFactor = 1.0 + gain_per_100m × elevationSensitivity × 0.01
```

`elevationSensitivity = 0` pour home trainer, natation, muscu, mobilité.

---

### 4.4 Coefficients par sport

| Sport | SportBase | SportFactor | defaultIF | elevSens | threshPace | threshPower |
|---|---|---|---|---|---|---|
| run | 100 | 1.00 | 0.75 | 8 | 300 s/km | — |
| trail_run | 100 | 1.15 | 0.75 | 12 | 330 s/km | — |
| walk | 60 | 0.50 | 0.50 | 10 | — | — |
| hike | 60 | 0.65 | 0.55 | 14 | — | — |
| road_ride | 80 | 0.75 | 0.70 | 5 | — | 220 W |
| gravel_ride | 80 | 0.85 | 0.70 | 7 | — | 220 W |
| mountain_bike | 90 | 1.00 | 0.75 | 9 | — | 220 W |
| indoor_ride | 80 | 0.70 | 0.70 | 0 | — | 220 W |
| swim | 120 | 1.10 | 0.75 | 0 | — | — |
| strength | 80 | 0.90 | 0.70 | 0 | — | — |
| mobility | 40 | 0.40 | 0.50 | 0 | — | — |
| cardio_other | 80 | 0.80 | 0.65 | 0 | — | — |
| other | 70 | 0.70 | 0.60 | 0 | — | — |

---

### 4.5 Labels d'effort CES

| CES | Label technique | Label utilisateur |
|---|---|---|
| 0–30 | recovery | Récupération |
| 31–60 | endurance | Endurance |
| 61–90 | steady | Soutenu |
| 91–130 | intense | Intense |
| 131–180 | very_hard | Très dur |
| > 180 | extreme | Extrême |

---

### 4.6 Charge cardio / charge musculaire

```
cardioLoad = round(BaseScore × SportFactor)
muscleLoad = round(CES × MUSCLE_LOAD_RATIO)     (MUSCLE_LOAD_RATIO = 0.6)
```

---

## 5. Charge d'entraînement et fatigue

### 5.1 EWMA (Exponentially Weighted Moving Average)

Fichier : `web/lib/analytics/fatigue.ts` — `buildDailyMetrics()`

Utilise une EWMA à décroissance exponentielle pour éviter les sauts liés aux jours sans activité.

```
alpha = 1 − exp(−1 / periodDays)

EWMA_i = EWMA_{i−1} + alpha × (CES_i − EWMA_{i−1})
```

Deux périodes :

| Indicateur | Période | Alpha | Rôle |
|---|---|---|---|
| ATL (Acute Training Load) | 7 jours | 1 − e^(−1/7) ≈ 0.133 | Fatigue récente |
| CTL (Chronic Training Load) | 42 jours | 1 − e^(−1/42) ≈ 0.023 | Capacité / forme |

**Important :** les jours sans activité (CES = 0) sont inclus dans le calcul. Ils représentent la récupération physiologique. Les omettre fausserait les courbes.

---

### 5.2 Fraîcheur (TSB)

```
TSB = CTL − ATL
```

| TSB | État |
|---|---|
| > +15 | Très frais (risque de sous-charge) |
| +5 à +15 | Frais, prêt à performer |
| −5 à +5 | Équilibré |
| −10 à −5 | Légèrement fatigué |
| < −10 | Fatigué (risque surentraînement) |

---

### 5.3 Load Ratio

```
LoadRatio = ATL / CTL
```

| LoadRatio | Statut |
|---|---|
| < 0.70 | Sous-charge |
| 0.70–0.90 | Charge légère |
| 0.90–1.20 | Équilibré |
| 1.20–1.35 | Productif |
| 1.35–1.50 | Fatigue élevée |
| > 1.50 | Surcharge |

---

## 6. Normalisation des sports

Fichier : `web/lib/analytics/effort-score.ts` — `normalizeSportType()`

Convertit le type Strava/Garmin en `SportCategory` interne :

| Type brut (contient) | SportCategory |
|---|---|
| trail | trail_run |
| run (+ titre trail) | trail_run |
| run | run |
| walk | walk |
| hike | hike |
| gravel | gravel_ride |
| mountain, mtb | mountain_bike |
| virtualride, indoor, trainer | indoor_ride |
| ride, bike, cycling | road_ride |
| swim | swim |
| strength, weight, muscu | strength |
| yoga, mobility, stretch | mobility |
| cardio | cardio_other |
| autre | other |

---

## 7. Où chaque calcul est utilisé

| Calcul | Fichier | Contexte |
|---|---|---|
| Zones FC profil | `hr-zones.ts` | Profil, détail activité, liste activités |
| Zone depuis avg_hr | `hr-zones.ts` | `guessIntensity`, dashboard |
| Distribution temps zones | `ActivityHeartRateZones.tsx` | Onglet Zones du détail activité |
| Intensité activité (`IntensityKey`) | `intensity.ts` — `guessIntensity()` | Emoji intensité sur les cartes activité ; édition manuelle dans le modal |
| Type de séance (`WorkoutType`) | `intensity.ts` — `guessWorkoutType()` | Emoji type sur les cartes activité ; édition manuelle dans le modal |
| Label intensité dashboard | `dashboard.ts` — `getIntensityLabel()` | Graphique répartition intensité (30j) |
| CES | `effort-score.ts` | Calculé à l'import via webhook/sync |
| ATL/CTL/TSB | `fatigue.ts` | Onglet Charge (graphiques) |
| Profil HR localStorage | `ProfileCardioSection.tsx` | Sauvegardé à chaque save profil |

---

## 8. Améliorations prévues (Blueprint non encore implémentées)

Le Blueprint complet est dans `docs/BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md`.

**Phase 2 (non implémentée) :**
- Coefficient cardio K_cardio (ajustement si FC élevée vs IF)
- Coefficient terrain automatique par titre (technique, boue, neige)
- Coefficient musculaire K_muscular (dénivelé négatif, sensibilité par sport)
- Coefficient fatigue K_fatigue (surcoût si LoadRatio > 1)
- Coefficient RPE K_rpe (perception de l'effort 1–10)
- Charge musculaire séparée de la charge cardio
- Fatigue 7j pondérée (poids décroissants J à J-6)
- Fitness 42j avec valeurs cardio et musculaire

**Version complète du CES (Blueprint) :**

```
CES = DurationHours × SportBase × IF²
    × SportFactor
    × K_elevation
    × K_cardio
    × K_terrain
    × K_muscular
    × K_fatigue
    × K_rpe
```

**Version simplifiée actuellement implémentée :**

```
CES = DurationHours × SportBase × IF²
    × SportFactor
    × ElevationFactor
```

---

## 9. Calcul FC relative (Karvonen normalisé)

Utilisé dans le Blueprint pour le coefficient cardio et l'IF FC fallback.

```
HR_relative = (avgHr − restingHr) / (maxHr − restingHr)
```

Représente le % de réserve cardiaque utilisé.
À IF = 1.0 (seuil), HR_relative typique ≈ 0.80–0.85.

IF FC fallback :

```
IF_FC = clamp(HR_relative / 0.85, 0.30, 1.25)
```

---

## 10. Résumé des clés localStorage

| Clé | Contenu | Mis à jour par |
|---|---|---|
| `tc_hr_zone_method` | Méthode zones FC (`karvonen`, `pct_max`, etc.) | `HrZoneMethod.tsx` |
| `tc_athlete_hr` | Profil HR (maxHr, restingHr, seuils, birthYear) | `ProfileCardioSection.tsx` |
