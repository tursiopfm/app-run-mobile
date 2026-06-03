# Modèle mathématique : Intensité, CES, Charge

> Doc vivante · fusion de MODELE_MATHEMATIQUE_INTENSITE_CES + REFERENCE_EFFORT_FC_INTENSITE le 2026-05-14
> Source de vérité pour les calculs d'intensité, CES, charge et fatigue
> Code source : [web/lib/health/hr-zones.ts](../../web/lib/health/hr-zones.ts), [web/lib/analytics/](../../web/lib/analytics/)

---

## 1. Les deux dimensions orthogonales de l'effort

Trail Cockpit distingue rigoureusement deux grandeurs souvent confondues :

| Dimension | Nom | Mesure | Unité |
|---|---|---|---|
| **Intensité physiologique** | Zone FC | Sollicitation du système cardiovasculaire | Zone 1–5 |
| **Charge d'entraînement** | CES | Stress total infligé à l'organisme | Score sans unité |

Ces deux grandeurs sont **orthogonales** : on peut avoir une charge élevée avec une intensité faible (longue sortie trail en endurance), ou une charge faible avec une intensité haute (5 km all-out court).

**Exemple de référence (activité Franck) :**
- Distance : 12,2 km | D+ : 527 m | Durée : 1h37 | Allure : 7:58/km
- FC moy : 142 bpm | FC max activité : 162 bpm
- CES calculé : **135** → charge élevée
- Zone FC moyenne : **Z2** → intensité endurance

---

## 2. Zones de fréquence cardiaque

Fichier : `web/lib/health/hr-zones.ts` — `calculateHrZones()`.

### 2.1 Méthodes disponibles

Sept méthodes, de la plus précise à la plus approximative (plus deux modes dérivés) :

| Méthode | Clé | Données requises | Confiance |
|---|---|---|---|
| Seuils mesurés | `seuils` | FC max + AeT + LTHR | Excellente |
| Test 30 min | `test30` | FC max + LTHR | Très bien |
| Karvonen | `karvonen` | FC max + FC repos | Bien |
| % FC max | `pct_max` | FC max | Correcte |
| Automatique (Tanaka) | `auto` | Année naissance | Approximative |
| Déduit | `deduced` | FC max observée + FC repos estimée | Adaptative |
| Personnalisé | `custom` | 5 bornes Z1–Z5 saisies | Personnalisée |

Le mode actif est stocké dans la colonne profil utilisateur ; la priorité de recommandation est calculée par `getRecommendedHeartRateZoneMode()` (`seuils > test30 > karvonen > pct_max > auto`).

### 2.2 Méthode `seuils` (la plus précise)

Utilise les seuils mesurés en laboratoire ou test terrain : FC max, seuil aérobie (AeT), seuil anaérobie (LTHR).

```
Z1 : [—,         AeT − 11]
Z2 : [AeT − 10,  AeT]
Z3 : [AeT + 1,   LTHR − 8]
Z4 : [LTHR − 7,  LTHR + 3]
Z5 : [LTHR + 4,  FCmax]
```

### 2.3 Méthode `test30`

Basée sur la LTHR mesurée par un test 30 min all-out (Coggan). Pourcentages de LTHR plafonnés à FC max.

```
Z1 : [0,           0,85 × LTHR]
Z2 : [0,85 × LTHR, 0,89 × LTHR]
Z3 : [0,90 × LTHR, 0,94 × LTHR]
Z4 : [0,95 × LTHR, 0,99 × LTHR]
Z5 : [LTHR,        FCmax]
```

### 2.4 Méthode `karvonen` (Fréquence Cardiaque de Réserve)

Intègre la FC de repos pour la **réserve cardiaque** : `FCR = FCmax − FCrepos`. Chaque borne :
`FC_zone = FCrepos + pct × FCR`.

```
Z1 : [—,                      FCrepos + 0,60 × FCR]
Z2 : [FCrepos + 0,60 × FCR,   FCrepos + 0,70 × FCR]
Z3 : [FCrepos + 0,70 × FCR,   FCrepos + 0,80 × FCR]
Z4 : [FCrepos + 0,80 × FCR,   FCrepos + 0,90 × FCR]
Z5 : [FCrepos + 0,90 × FCR,   FCmax]
```

**Exemple — FCmax = 195, FCrepos = 57 → FCR = 138 :**
- Z1 ≤ 140 · Z2 : 141 – 154 · Z3 : 155 – 167 · Z4 : 168 – 181 · Z5 : 182 – 195

### 2.5 Méthode `pct_max`

```
Z1 : [—,            0,72 × FCmax]
Z2 : [0,72 × FCmax, 0,78 × FCmax]
Z3 : [0,78 × FCmax, 0,85 × FCmax]
Z4 : [0,85 × FCmax, 0,92 × FCmax]
Z5 : [0,92 × FCmax, FCmax]
```

**Exemple — FCmax = 195 :** Z1 ≤ 140 · Z2 ≤ 152 · Z3 ≤ 166 · Z4 ≤ 179 · Z5 ≤ 195.

### 2.6 Méthode `auto` (Tanaka)

```
FCmax_estimée = 208 − 0,7 × âge
```

Puis applique les mêmes pourcentages que `pct_max` sur cette FC max estimée.

### 2.7 Méthodes `deduced` et `custom`

- **`deduced`** : applique la formule Karvonen sur une FC max **observée** dans les activités et une FC repos **estimée** (mode adaptatif quand l'utilisateur n'a rien renseigné mais a un historique).
- **`custom`** : l'utilisateur saisit les 5 bornes Z1–Z5 directement.

### 2.8 Noms, couleurs et libellés

```
Z1 Récupération            #4caf50  vert
Z2 Endurance fondamentale  #38bdf8  bleu ciel
Z3 Endurance active        #f59e0b  ambre
Z4 Seuil                   #e8651a  orange
Z5 Très intense            #ef4444  rouge
```

---

## 3. Déterminer la zone et la distribution dans une activité

### 3.1 `hrZoneForAvgHr(avgHr, zones)`

Algorithme :

```
Pour chaque zone z dans [Z1..Z5] (ordre croissant) :
  Si avgHr ≤ z.max → retourner z.numéro
Si avgHr > Z5.max → retourner 5  (clamp)
```

Retourne `null` si le tableau de zones est vide.

**Application activité de référence (pct_max, FCmax = 195) :**
FCmoy = 142 → Z1.max = 140 (continue) → Z2.max = 152 → **Zone 2** (Endurance active).

### 3.2 Distribution du temps par zone — loi normale tronquée

Fichier : `distributeTimeInZones()` dans `web/lib/health/hr-zones.ts`.

La FC instantanée d'une activité est modélisée par une loi normale tronquée sur `[FCrepos, FCmax_activité]` :

```
FC ~ N(μ, σ²)  tronquée sur [FCrepos, FCmax_activité]

μ = avgHr                                                 (centre)
σ = max((FCmax_activité − avgHr) / 2, 3)                  (plancher 3 bpm)
```

**Justification du σ** : le max observé est ~2σ au-dessus de la moyenne (règle empirique : 95 % des valeurs d'une loi normale dans [μ − 2σ, μ + 2σ]).

**Fonction CDF (Abramowitz & Stegun, erreur < 1,5·10⁻⁷) :**

```
Φ(z) = ½ × [1 + erf(z / √2)]      avec z = (x − μ) / σ

erf(x) ≈ 1 − (a₁t + a₂t² + a₃t³ + a₄t⁴ + a₅t⁵) × e^(−x²)
t  = 1 / (1 + 0,3275911 × |x|)
a₁ =  0,254829592   a₂ = −0,284496736   a₃ =  1,421413741
a₄ = −1,453152027   a₅ =  1,061405429
Pour x < 0 : erf(x) = −erf(|x|)
```

**Poids puis temps par zone `[zMin, zMax]` :**

```
zMin_eff = max(zMin, FCrepos)
zMax_eff = min(zMax, FCmax_activité)
Si zMin ≥ FCmax_activité → Poids = 0   (zone inaccessible)

Poids_k = Φ((zMax_eff − μ)/σ) − Φ((zMin_eff − μ)/σ)
Temps_k = round((Poids_k / Σ Poids) × movingTimeSec)
```

Le dernier bucket absorbe les secondes restantes pour que la somme soit exacte.

**Si `FCrepos` est inconnu :** `FCrepos_estimé = max(avgHr − 3σ, 40)`.

### 3.3 Application numérique (activité de référence)

```
μ = 142,  σ = 10,  FCmax_activité = 162,  Durée = 97 min
Zones pct_max avec FCmax_athlète = 195

Z1 (max=140) : Φ(−0,20) = 0,421
Z2 (max=152) : Φ(1,00) − 0,421 = 0,420
Z3 (max=162) : Φ(2,00) − Φ(1,00) = 0,136
Z4/Z5 : zMin ≥ 162 → 0

Σ = 0,977 → normalisation 1/0,977

Z1 ≈ 42 min · Z2 ≈ 42 min · Z3 ≈ 13 min · Z4/Z5 : 0
```

---

## 4. Intensité d'une activité — `guessIntensity`

> **Refonte 2026-05-11** : `guessIntensity` est désormais **purement FC**. Pas de mot-clé, pas de fallback CES. Si la FC moyenne ou les zones sont absentes → `null`. La structure de séance va dans le type orthogonal `WorkoutType` (section 5).

Fichier : `web/lib/activities/intensity.ts`.

### 4.1 Type `IntensityKey`

Cinq valeurs strictement physiologiques, chacune une zone FC :

| Clé | Emoji | Libellé | Zone FC |
|---|---|---|---|
| `recuperation` | 😴 | Récupération | Z1 |
| `footing` | 🦶 | Footing | Z2 |
| `endurance_active` | 🔄 | Endurance active | Z3 |
| `seuil` | 🎯 | Seuil | Z4 |
| `vma` | 🔥 | VMA | Z5 |

Override utilisateur : colonne `manual_intensity` de la table `activities`.

### 4.2 Chaîne de priorité (ordre strict)

```
1. Override manuel (colonne `manual_intensity` en DB)
       ↓ sinon
2. guessIntensity(avgHr, hrZones, { activityMaxHr, movingTimeSec, restingHr })
   ├─ Mode distribution : classifyIntensityFromZoneTimes(...) si max_hr + durée OK
   └─ Mode fallback     : hrZoneForAvgHr(avgHr, zones)
       ↓ si avgHr absent OU hrZones vide
3. null  (aucun chip actif dans l'UI)
```

### 4.3 Mode 1 — Distribution (préféré)

Si `activityMaxHr > avgHr` et `movingTimeSec > 0`, on calcule la distribution (section 3.2) puis on applique une **cascade par zone supérieure significative** (premier match gagne) :

```
total = Z1 + Z2 + Z3 + Z4 + Z5

Si  Z5 / total       ≥ 15 %  →  vma
Si (Z4 + Z5) / total ≥ 20 %  →  seuil
Si (Z3 + Z4 + Z5) / total ≥ 40 %  →  endurance_active
Si  Z2 ≥ Z1                    →  footing
Sinon                            →  recuperation
```

**Justification des seuils (littérature) :**

| Seuil | Référence | Logique |
|---|---|---|
| Z5 ≥ 15 % | Daniels (2014) — prescription VO₂max = 3×5 min en Z5 ≈ 25 % d'une séance d'1 h | Empreinte VO₂max stable |
| Z4+Z5 ≥ 20 % | Seiler & Kjerland (2006), Stöggl & Sperlich (2014) — TID HIT élite : 15-20 % du volume hebdo en zones hautes | Séance "qualité" HIT |
| Z3+ ≥ 40 % | Empirique — au-delà de 40 % au-dessus de Z2, la séance n'est plus "endurance fondamentale" | Capture trail vallonné, sortie progressive |

**Pourquoi cascade et pas `max(Z3, Z4, Z5)` ?**
Le maximum numérique reflète la zone la plus représentée, pas la plus haute intensité atteinte. Une séance 30 % Z3 + 25 % Z4 + 8 % Z5 a Z3 dominant mais Z4+Z5 = 33 % signe un travail supra-seuil. La cascade reflète la nature physiologique (Coggan, Foster, Lucia).

**Cas fractionnés courts** (300-400 m, ~1 min) : la FC met 20-30 s à monter en Z4-Z5 → l'empreinte cardio moyenne reste dominée par Z3-Z4. Ces séances sont classées `seuil` (correct au sens Daniels — c'est du travail "R" Repetition / sub-VO₂max). Le caractère "fractionné" est capturé séparément par `WorkoutType`.

### 4.4 Mode 2 — FC moyenne (fallback)

Si `activityMaxHr` ou `movingTimeSec` manque :

1. `hrZoneForAvgHr(avgHr, hrZones)` → numéro de zone 1–5.
2. Mapping `zoneToIntensity(zone)` → `IntensityKey`.

```
Z1 → recuperation   ·  Z2 → footing  ·  Z3 → endurance_active
Z4 → seuil          ·  Z5 → vma
```

Algorithme historique, plus simple mais aveugle à la distribution.

### 4.5 Exemples

**Profil Karvonen, FCmax 195, FCrepos 57** (zones Z1≤140, Z2≤154, Z3≤167, Z4≤181, Z5≤195) :

| Cas | avg_hr | max_hr | durée | Mode | Distribution Z1/Z2/Z3/Z4/Z5 (min) | IntensityKey |
|---|---|---|---|---|---|---|
| Footing stable | 148 | 152 | 60 min | distribution | 7/52/1/0/0 (88 % Z1+Z2) | `footing` |
| Trail vallonné* | 153 | 177 | 4h17 | distribution | 34/102/97/23/0 (47 % en Z3+) | **`endurance_active`** |
| Récup pure | 125 | 135 | 45 min | distribution | 45/0/0/0/0 (100 % Z1) | `recuperation` |
| Seuil 30 min | 172 | 178 | 30 min | distribution | 0/0/4/26/0 | `seuil` |
| VMA 10×400 | 165 | 188 | 50 min | distribution | 0/2/12/16/20 | `vma` |
| Sans max_hr | 153 | — | — | FC moyenne | — | `footing` |
| avgHr sans zones | 153 | — | — | — | — | `null` |

*"Trail des lavoirs" : FC moy en limite Z2/Z3 mais 47 % en Z3+ → `endurance_active`. Le fallback FC moyenne classerait à tort en `footing`.

### 4.6 Suppressions historiques

- **Fallback CES supprimé** : on ne déduit plus l'intensité depuis le score d'effort (`CES > 120 → seuil` etc.). Le CES mesure la charge globale (durée × intensité × dénivelé) ; en déduire l'intensité classait les longues Z1/Z2 en "seuil".
- **Mots-clés intensité supprimés** : ils décrivent la structure de séance, pas l'intensité cardiaque réelle. Ils sont désormais dans `WorkoutType`.
- **`IntensityKey` réduit aux 5 zones** : `sortie_longue`, `cotes`, `autre` retirées (déplacées vers `WorkoutType`). Migration `011_add_manual_workout_type.sql`.

---

## 5. Type de séance — `WorkoutType` (orthogonal à `IntensityKey`)

Sept valeurs, avec restrictions par sport pour runtaf et velotaf :

| Clé | Emoji | Libellé | Sports autorisés |
|---|---|---|---|
| `sortie_longue` | 🐢 | Sortie longue | tous |
| `fractionne` | ⌚ | Fractionné (200-800 m, VMA) | tous |
| `seuil_tempo` | ⏱️ | Seuil / Tempo (1000-5000 m) | tous |
| `cotes` | ⛰️ | Côtes | tous |
| `course` | 🏆 | Course | tous |
| `runtaf` | 🏃‍♂️💻 | Runtaf | `Run`, `TrailRun` |
| `velotaf` | 🚴🏻💻 | Velotaf | `Ride`, `EBikeRide`, `VirtualRide` |

Override utilisateur : colonne `manual_workout_type` (migration `011`).

**Sémantique :** `WorkoutType` répond à *"Quelle structure de séance ?"* (volume / intervalles / déplacement / compétition). `IntensityKey` répond à *"Quelle intensité physiologique ?"*. Une sortie longue peut être en `footing` (Z2) **ou** `endurance_active` (Z3) — les deux dimensions sont indépendantes.

### 5.1 `guessWorkoutType(name, sport)` — détection depuis le titre

Ordre de priorité (premier match gagne) :

| Priorité | Détection | `WorkoutType` |
|:-:|---|---|
| 1 | sport ∈ {Run, TrailRun} ET nom contient `runtaf`, `run taf`, `taf`, ou exact `Home 🏃‍♂️` / `🏃‍♂️ Home` | `runtaf` |
| 2 | sport ∈ {Ride, EBikeRide, VirtualRide} ET nom contient `vélotaf`, `velotaf`, `vélo taf`, `taf`, ou exact `Home 🚴🏻` / `🚴🏻 Home` | `velotaf` |
| 3 | nom contient `côtes`, `cotes`, `côte`, `cote`, `montée`, `montee`, `hill` | `cotes` |
| 4 | nom contient `vma`, `interval`, `fractionné`, `fractionnée`, `répétition`, `repetition` (explicites) | `fractionne` |
| 5 | nom contient `seuil`, `tempo`, `threshold` (explicites) | `seuil_tempo` |
| 6 | distance isolée 200/300/400/500/800 m (non collée à d'autres chiffres) | `fractionne` |
| 7 | distance isolée 1000/2000/3000/5000 m | `seuil_tempo` |
| 8 | nom contient `race`, `compét`, `compet`, `dossard`, `chrono`, ` pb `, ` pr `, `10k`, `semi`, `marathon` (et pas `course à pied`) | `course` |
| 9 | nom contient `sortie longue`, mot exact `sl`, `long run`, `lsl` | `sortie_longue` |
| 10 | aucun match | `null` |

**Logique cascade fractionné / seuil** : les mots-clés explicites (4-5) priment sur les distances (6-7). "Seuil 8×400m" est une séance seuil même avec fractions de 400 m ; "VMA 5×1000m" reste VMA.

Dans l'UI, les options sont filtrées par sport. Si le sport change et rend le type incompatible, il est réinitialisé à `null`.

---

## 6. CES — Cockpit Effort Score

### 6.1 Formule générale

```
CES = DuréeHeures × SportBase × IF² × SportFactor × FacteurDénivelé
```

Avec `DuréeHeures = movingTimeSeconds / 3600`. **Principe** : 1 heure à intensité seuil (IF = 1,0) ≈ 100 points pour un sport au `SportBase` 100.

Fichier : `web/lib/analytics/effort-score.ts` — `computeCesResult()`.

### 6.2 Facteur d'Intensité (IF) — CES v2 profile-aware

Depuis CES v2, l'IF privilégie les valeurs du **profil utilisateur** avant de retomber sur les défauts. `calcIF()` retourne `value`, `source` lisible et `model: 'power' | 'pace_threshold' | 'legacy'`.

**Vélo (road / gravel / mtb / indoor)** — priorité décroissante :

```
1. profile.ftp_watts        + normalizedPowerWatts  →  NP / FTP_user
2. profile.ftp_watts        + averageWatts          →  avg / FTP_user
3. cfg.thresholdPower (220) + NP                    →  NP / FTP_default
4. cfg.thresholdPower (220) + avg                   →  avg / FTP_default
5. cfg.defaultIF                                    →  legacy
```

**Course route :**

```
1. profile.threshold_pace_run_sec_per_km  →  pace_seuil_user / pace_activité
2. cfg.thresholdPaceSecPerKm (300)        →  pace_seuil_default / pace_activité
3. cfg.defaultIF                          →  legacy
```

**Trail :**

```
1. profile.threshold_pace_trail_sec_per_km  →  pace_seuil_trail_user / pace_activité
2. cfg.thresholdPaceSecPerKm (330)          →  pace_seuil_trail_default / pace_activité
3. cfg.defaultIF                            →  legacy
```

Clamping systématique : `IF = clamp(IF, cfg.minIF, cfg.maxIF)`.

### 6.3 Facteur dénivelé

```
GradientPour100m = (D+_m / Distance_m) × 100
FacteurDénivelé  = 1,0 + GradientPour100m × SensiElev × 0,01
```

`SensiElev = 0` pour home trainer, natation, muscu, mobilité (pas d'effet du dénivelé).

### 6.4 Coefficients par sport

| Sport (`SportCategory`) | SportBase | SportFactor | defaultIF | minIF | maxIF | SensiElev | threshPace (s/km) | threshPower (W) |
|---|---|---|---|---|---|---|---|---|
| `run` | 100 | 1,00 | 0,75 | 0,4 | 1,3 | 8  | 300 | — |
| `trail_run` | 100 | 1,15 | 0,75 | 0,4 | 1,3 | 12 | 330 | — |
| `walk` | 60  | 0,50 | 0,50 | 0,3 | 0,8 | 10 | — | — |
| `hike` | 60  | 0,65 | 0,55 | 0,3 | 0,9 | 14 | — | — |
| `road_ride` | 80  | 0,75 | 0,70 | 0,3 | 1,2 | 5  | — | 220 |
| `gravel_ride` | 80  | 0,85 | 0,70 | 0,3 | 1,2 | 7  | — | 220 |
| `mountain_bike` | 90  | 1,00 | 0,75 | 0,4 | 1,3 | 9  | — | 220 |
| `indoor_ride` | 80  | 0,70 | 0,70 | 0,3 | 1,2 | 0  | — | 220 |
| `swim` | 120 | 1,10 | 0,75 | 0,4 | 1,2 | 0  | — | — |
| `strength` | 80  | 0,90 | 0,70 | 0,4 | 1,1 | 0  | — | — |
| `mobility` | 40  | 0,40 | 0,50 | 0,2 | 0,7 | 0  | — | — |
| `cardio_other` | 80  | 0,80 | 0,65 | 0,3 | 1,1 | 0  | — | — |
| `other` | 70  | 0,70 | 0,60 | 0,3 | 1,0 | 0  | — | — |

### 6.5 Confidence et warnings

Chaque calcul retourne `confidence: 'high' | 'medium' | 'low'` et `warnings: string[]` :

| Cas | Confidence | Warning |
|---|---|---|
| Run sans `threshold_pace_run_sec_per_km` user | `low` | « Score calculé avec une allure seuil par défaut. Renseigne ton allure seuil. » |
| Trail sans `threshold_pace_trail_sec_per_km` user | `medium` | « Score trail calculé avec une allure seuil par défaut. » |
| Trail avec D+ > 0 | dégradé à `medium` | « Le score trail utilise uniquement le D+. La descente et la technicité ne sont pas encore prises en compte. » |
| Vélo avec `model = 'legacy'` (pas de puissance) | `low` | « Score vélo calculé sans données de puissance. Renseigne ton FTP. » |

### 6.6 Charge cardio / charge musculaire

```
cardioLoad = round(BaseScore × SportFactor)            où BaseScore = DuréeHeures × SportBase × IF²
muscleLoad = round(CES × MUSCLE_LOAD_RATIO)            MUSCLE_LOAD_RATIO = 0,6
```

### 6.7 Application numérique complète (activité de référence)

```
Sport détecté : trail_run  (nom contient "trail")
SportBase     = 100
SportFactor   = 1,15
SensiElev     = 12
AllureSeuil   = 330 s/km

Durée         = 5820 s  →  1,617 h
Allure réelle = 5820 / (12200/1000) = 477,0 s/km

IF  = 330 / 477,0 = 0,692     (clamped [0,4 ; 1,3] → 0,692)
IF² = 0,479

GradientPour100m = (527 / 12200) × 100 = 4,32
FacteurDénivelé  = 1,0 + 4,32 × 12 × 0,01 = 1,519

BaseScore = 1,617 × 100 × 0,479 = 77,5
CES final = 77,5 × 1,15 × 1,519 ≈ 135
```

**Contribution du dénivelé** : CES plat équivalent = 89,1 → Δ = +46 points (+52 %). Grimper sollicite les muscles indépendamment de la FC, le CES capture ce stress mécanique.

### 6.8 Labels d'effort CES

| CES | Label technique | Label utilisateur | Exemples |
|---|---|---|---|
| 0 – 30 | `recovery` | Récupération | Récup 30 min, mobilité, yoga |
| 31 – 60 | `endurance` | Endurance | Footing 1h plat, vélo 45 min |
| 61 – 90 | `steady` | Soutenu | Sortie 1h tempo modéré |
| 91 – 130 | `intense` | Intense | Sortie longue 1h30, tempo 1h |
| 131 – 180 | `very_hard` | Très dur | Trail avec D+, compétition |
| > 180 | `extreme` | Extrême | Ultra, effort prolongé > 3h |

> **Attention** : ces plages mesurent la **charge globale (volume × intensité × dénivelé)**, pas l'intensité seule.
> Une sortie Z1/Z2 de 2h trail = CES 150 (charge élevée, intensité basse).
> Une course 5 km all-out = CES ≈ 50 (charge modérée, intensité maximale).

### 6.9 Couleur du badge d'effort (cohérence visuelle)

| Intensité détectée | Zone FC | Couleur badge « ⚡ Effort X » | Hex |
|---|---|---|---|
| recuperation 😴 | Z1 | Vert pâle | `#86efac` |
| footing 🦶 | Z2 | Vert | `#4ade80` |
| endurance_active 🔄 | Z3 | Bleu clair | `#38bdf8` |
| seuil 🎯 | Z4 | Orange | `#ffa500` |
| vma 🔥 | Z5 | Rouge | `#ef4444` |
| `null` | — | Jaune (défaut) | `#ffc107` |

### 6.10 Normalisation des sports — `normalizeSportType()`

Convertit le type brut Strava/Garmin en `SportCategory` interne (première règle qui matche dans le `name.toLowerCase()` + `rawSportType.toLowerCase()`) :

| Type brut contient | SportCategory |
|---|---|
| `trail` | `trail_run` |
| `run` + titre contient `trail` | `trail_run` |
| `run` | `run` |
| `walk` | `walk` |
| `hike` | `hike` |
| `gravel` | `gravel_ride` |
| `mountain` ou `mtb` | `mountain_bike` |
| `virtualride`, `indoor`, `trainer` | `indoor_ride` |
| `ride`, `bike`, `cycling` | `road_ride` |
| `swim` | `swim` |
| `strength`, `weight`, `muscu` | `strength` |
| `yoga`, `mobility`, `stretch` | `mobility` |
| `cardio` | `cardio_other` |
| (aucun match) | `other` |

---

## 7. Charge chronique et fatigue (EWMA)

Fichier : `web/lib/analytics/fatigue.ts` — `buildDailyMetrics()`, `buildFatigueResult()`.

### 7.1 Modèle EWMA

Moyennes exponentiellement pondérées pour éviter les sauts liés aux jours sans activité.

```
alpha   = 1 − exp(−1 / periodDays)
EWMA_i  = EWMA_{i−1} + alpha × (CES_i − EWMA_{i−1})
```

Deux périodes :

| Indicateur | Période | Alpha | Rôle |
|---|---|---|---|
| **ATL** (Acute Training Load — fatigue) | 7 jours | 1 − e^(−1/7) ≈ 0,1331 | Fatigue récente |
| **CTL** (Chronic Training Load — forme) | 42 jours | 1 − e^(−1/42) ≈ 0,0233 | Capacité / fitness |

**Invariant critique** — les jours sans activité (`CES = 0`) sont **inclus** dans l'agrégation. Ils représentent la récupération physiologique. Les omettre fausserait les courbes (sauts artificiels).

### 7.2 Fraîcheur (TSB) et LoadRatio

```
TSB       = CTL − ATL
LoadRatio = ATL / CTL
```

Seuils TSB (`FRESHNESS` dans `charge-thresholds.ts`) :

| TSB | État | Status id |
|---|---|---|
| ≥ +15 | Très frais (risque sous-charge) | `very-fresh` |
| +5 à +15 | Frais, prêt à performer | `fresh` |
| −10 à +5 | Équilibré | `balanced` |
| −25 à −10 | Légèrement fatigué | `normal-fatigue` |
| < −25 | Fatigué (risque surentraînement) | `high-fatigue` |

Seuils LoadRatio (`LOAD_BALANCE`) :

| LoadRatio | Statut |
|---|---|
| < 0,75 | Sous-charge |
| 0,75 – 1,25 | Équilibré |
| 1,25 – 1,5 | Productif / charge élevée |
| > 1,5 | Surcharge |

### 7.3 Confidence sur la fatigue

`buildFatigueResult()` ajoute :

| Historique | Confidence | Warning |
|---|---|---|
| < 14 jours | `low` | « Historique de N jours insuffisant. Les courbes ATL/CTL sont peu fiables. » |
| 14 – 41 jours | `medium` | « Historique de N jours. 42 jours minimum pour des courbes CTL stables. » |
| ≥ 42 jours | `high` | — |

### 7.4 Status KPIs (`kpiStatus*`)

Fichier : `charge-kpi-status.ts`.

- **Fatigue** : `high` si `atl > ctl × 1.15` · `low` si `atl < ctl × 0.85` · sinon `usual`.
- **Fitness** (CTL) : `building` < 20 · `progressing` 20-39 · `solid` 40-59 · `very-solid` ≥ 60.
- **Freshness** (TSB) : mapping aux seuils `FRESHNESS` ci-dessus.

### 7.5 Conséquence pratique

Un CES élevé fait monter l'ATL même si l'intensité physiologique était faible. Une longue sortie trail en Z1/Z2 (CES = 135) augmente l'ATL autant qu'une séance seuil plus courte — les deux provoquent un stress comparable par des mécanismes différents (musculaire + dénivelé vs cardiovasculaire + acide lactique).

---

## 8. Calcul FC relative (Karvonen normalisé)

> ⚠️ **Non implémenté à date (vérifié 2026-06-03).** La formule ci-dessous est une **spec cible**.
> Dans `effort-score.ts`, `calcIF()` n'a **aucune branche FC** : la cascade réelle est
> `puissance/FTP (vélo) → allure/allure_seuil (run/trail) → cfg.defaultIF (model 'legacy')`.
> Quand ni puissance ni allure ne sont disponibles (walk, hike, swim sans allure seuil, cardio_other…),
> l'IF retombe sur `defaultIF` constant — **jamais** sur la FC. Le « coefficient cardio » (`K_cardio`, §10)
> et l'« IF FC fallback » restent donc à brancher.

Formule cible — % de réserve cardiaque utilisé :

```
HR_relative = (avgHr − restingHr) / (maxHr − restingHr)
```

Représente le % de réserve cardiaque utilisé. À IF = 1,0 (seuil), `HR_relative` typique ≈ 0,80 – 0,85.

**IF FC fallback (cible, non branché) :**

```
IF_FC = clamp(HR_relative / 0.85, 0.30, 1.25)
```

---

## 9. Synthèse — articulation des trois niveaux

```
┌─────────────────────────────────────────────────────────────────┐
│ NIVEAU 1 — Intensité physiologique instantanée                  │
│                                                                 │
│   FC + zones ─→ guessIntensity() ─→ recuperation / footing /    │
│                                      endurance_active / seuil / │
│                                      vma                        │
│                                                                 │
│   Répond à : "À quelle intensité ai-je couru ?"                 │
│   Exprimé par : emoji 😴 🦶 🔄 🎯 🔥 + couleur du badge         │
├─────────────────────────────────────────────────────────────────┤
│ NIVEAU 2 — Charge de la séance (CES)                            │
│                                                                 │
│   CES = Durée × SportBase × IF² × SportFactor × FacteurD+       │
│                                                                 │
│   Répond à : "Quel stress total cette séance a-t-elle causé ?"  │
│   Exprimé par : chiffre ⚡ coloré selon le Niveau 1             │
├─────────────────────────────────────────────────────────────────┤
│ NIVEAU 3 — Charge chronique (fatigue / forme / fraîcheur)       │
│                                                                 │
│   ATL  = EWMA 7j  des CES quotidiens                            │
│   CTL  = EWMA 42j des CES quotidiens                            │
│   TSB  = CTL − ATL                                              │
│   LoadRatio = ATL / CTL                                         │
│                                                                 │
│   Répond à : "Suis-je frais ou fatigué sur les dernières        │
│               semaines ?"                                       │
│   Exprimé par : graphiques Charge / Fatigue / Fraîcheur         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Améliorations prévues (Blueprint, non implémentées)

Blueprint complet : `docs/BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md`. Phase 2 ajoutera :

- `K_cardio` — ajustement si FC élevée vs IF
- `K_terrain` — coefficient terrain automatique par titre (technique, boue, neige)
- `K_muscular` — dénivelé négatif, sensibilité par sport
- `K_fatigue` — surcoût si `LoadRatio > 1`
- `K_rpe` — perception de l'effort (1–10)
- Charge musculaire séparée de la charge cardio (déjà calculée mais non utilisée en aval)
- Fatigue 7j pondérée (poids décroissants J à J-6)
- Fitness 42j avec valeurs cardio et musculaire séparées

**Version complète future :**

```
CES = DurationHours × SportBase × IF²
    × SportFactor × K_elevation × K_cardio
    × K_terrain × K_muscular × K_fatigue × K_rpe
```

**Version simplifiée actuelle :**

```
CES = DurationHours × SportBase × IF² × SportFactor × ElevationFactor
```

---

## 11. Implémentation — pointeurs fichiers

| Calcul | Fichier |
|---|---|
| Zones FC (7 méthodes : seuils, test30, karvonen, pct_max, auto, deduced, custom) | `web/lib/health/hr-zones.ts` |
| `hrZoneForAvgHr()` | `web/lib/health/hr-zones.ts` |
| `distributeTimeInZones()` (loi normale tronquée) | `web/lib/health/hr-zones.ts` |
| Mode zones recommandé | `web/lib/health/hr-zones.ts` (`getRecommendedHeartRateZoneMode`) |
| `guessIntensity()`, `classifyIntensityFromZoneTimes()`, `zoneToIntensity()`, `IntensityKey` | `web/lib/activities/intensity.ts` |
| `guessWorkoutType()`, `WorkoutType`, `WORKOUT_TYPE_OPTIONS` | `web/lib/activities/intensity.ts` |
| Tests classification | `web/__tests__/activities/classification.test.ts` |
| Affichage zones FC (UI activité) | `web/components/ui/ActivityHeartRateZones.tsx` |
| Formule CES v2 (profile-aware, confidence, warnings) | `web/lib/analytics/effort-score.ts` |
| Types `CesResult`, `UserProfileForCes`, `CesConfidence`, `CesModel` | `web/lib/analytics/types.ts` |
| Recalcul batch CES + fatigue | `web/lib/sync/recalculate-scores.ts` |
| Endpoint recalcul | `web/app/api/profile/recalculate/route.ts` |
| EWMA ATL/CTL, TSB, `buildFatigueResult` | `web/lib/analytics/fatigue.ts` |
| Seuils numériques charge (TSB, LoadRatio, monotony, strain, ramp rate) | `web/lib/analytics/charge-thresholds.ts` |
| Status KPIs (Fatigue / Fitness / Freshness) | `web/lib/analytics/charge-kpi-status.ts` |
| Insights charge | `web/lib/analytics/charge-insights.ts` |
| Badge d'effort coloré (détail activité) | `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` |
| Badge d'effort coloré (carte activité) | `web/components/ui/ActivityCard.tsx` |
| Popup explication CES | `web/components/ui/ActivityPopups.tsx` |
| Dashboard : `intensityBreakdown`, `sportOverviews` | `web/lib/data/dashboard.ts` |
| Colonne `manual_workout_type` (DB) | `web/supabase/migrations/011_add_manual_workout_type.sql` |
| Migrations Supabase (threshold_pace, version, soft-delete) | `web/supabase/migrations/005..008_*.sql` |

---

## 12. Glossaire

| Terme | Définition |
|---|---|
| **AeT** | Aerobic Threshold — seuil aérobie, FC limite haute de l'endurance fondamentale. |
| **ATL** | Acute Training Load — fatigue aiguë, EWMA 7 jours du CES quotidien. |
| **CES** | Cockpit Effort Score — score de charge par activité (multi-sport, remplace le suffer score Strava). |
| **CTL** | Chronic Training Load — forme chronique, EWMA 42 jours du CES quotidien. |
| **FCR** | Fréquence Cardiaque de Réserve = `FCmax − FCrepos` (méthode Karvonen). |
| **FTP** | Functional Threshold Power — puissance soutenue 1 h en vélo. |
| **HIT** | High Intensity Training. |
| **HR_relative** | `(avgHr − restingHr) / (maxHr − restingHr)` — % de réserve cardiaque utilisé. |
| **IF** | Intensity Factor — ratio intensité de l'activité / intensité seuil (0,4 – 1,3). |
| **IntensityKey** | Intensité physiologique de la séance (5 valeurs, basé sur la FC). |
| **LoadRatio** | `ATL / CTL` — indicateur de surcharge / sous-charge. |
| **LTHR** | Lactate Threshold Heart Rate — FC au seuil anaérobie. |
| **NP** | Normalized Power (vélo) — puissance normalisée. |
| **SportFactor** | Coefficient multiplicateur de charge par sport. |
| **TID** | Training Intensity Distribution — répartition de l'intensité dans le volume d'entraînement. |
| **TSB** | Training Stress Balance — fraîcheur, `CTL − ATL`. |
| **VAP** | Velocity-Adjusted Pace — allure corrigée du dénivelé. |
| **WorkoutType** | Structure de la séance (7 valeurs, basé sur titre + sport). |
| **σ** | Écart-type de la loi normale tronquée modélisant la FC instantanée. |
| **Φ** | Fonction de répartition (CDF) de la loi normale standard. |
