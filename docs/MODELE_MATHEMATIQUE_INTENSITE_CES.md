# Trail Cockpit — Modèle mathématique complet : Intensité, Zones FC et Charge d'entraînement (CES)

## 1. Les deux dimensions orthogonales de l'effort

Trail Cockpit distingue rigoureusement deux grandeurs souvent confondues :

| Dimension | Nom | Mesure | Unité |
|---|---|---|---|
| **Intensité physiologique** | Zone FC | Sollicitation du système cardiovasculaire | Zone 1–5 |
| **Charge d'entraînement** | CES | Stress total infligé à l'organisme | Score sans unité |

Ces deux grandeurs sont **orthogonales** : on peut avoir une charge élevée avec une intensité faible (longue sortie trail en endurance), ou une charge faible avec une intensité haute (5 km all-out court).

**Exemple concret (activité de référence) :**
- Distance : 12,2 km | D+ : 527 m | Durée : 1h37 | Allure : 7:58/km
- FC moy : 142 bpm | FC max activité : 162 bpm
- CES calculé : **135** → charge élevée
- Zone FC moyenne : **Z2** → intensité endurance

---

## 2. Calcul des zones de fréquence cardiaque

### 2.1 Méthode `pct_max` (défaut)

Les 5 zones sont définies comme pourcentages de la FC maximale de l'athlète :

```
Z1 : [0,             0.72 × FCmax]
Z2 : [0.72 × FCmax,  0.78 × FCmax]
Z3 : [0.78 × FCmax,  0.85 × FCmax]
Z4 : [0.85 × FCmax,  0.92 × FCmax]
Z5 : [0.92 × FCmax,  FCmax]
```

**Exemple avec FCmax = 195 bpm :**
```
Z1 : [—,   140]   (0 → 72% = 140,4)
Z2 : [140, 152]   (72% → 78% = 152,1)
Z3 : [152, 166]   (78% → 85% = 165,75)
Z4 : [166, 179]   (85% → 92% = 179,4)
Z5 : [179, 195]   (92% → 100%)
```

### 2.2 Méthode `karvonen` (Fréquence Cardiaque de Réserve)

Plus précise, elle intègre la FC de repos pour calculer la **réserve cardiaque (FCR)** :

```
FCR = FCmax − FCrepos

Borne de zone k = FCrepos + pct_k × FCR
```

Les pourcentages utilisés :
```
Z1 : [—,                      FCrepos + 0,60 × FCR]
Z2 : [FCrepos + 0,60 × FCR,   FCrepos + 0,70 × FCR]
Z3 : [FCrepos + 0,70 × FCR,   FCrepos + 0,80 × FCR]
Z4 : [FCrepos + 0,80 × FCR,   FCrepos + 0,90 × FCR]
Z5 : [FCrepos + 0,90 × FCR,   FCmax]
```

**Exemple : FCmax = 195, FCrepos = 57 → FCR = 138**
```
Z1 : [—,   140]   (57 + 0,60 × 138 = 139,8 ≈ 140)
Z2 : [140, 154]   (57 + 0,70 × 138 = 153,6 ≈ 154)
Z3 : [154, 167]   (57 + 0,80 × 138 = 167,4 ≈ 167)
Z4 : [167, 181]   (57 + 0,90 × 138 = 181,2 ≈ 181)
Z5 : [181, 195]
```

### 2.3 Méthode `seuils` (la plus précise)

Nécessite : FCmax, Seuil aérobie (AeT), Seuil anaérobie (LTHR).

```
Z1 : [—,         AeT − 11]
Z2 : [AeT − 10,  AeT]
Z3 : [AeT + 1,   LTHR − 8]
Z4 : [LTHR − 7,  LTHR + 3]
Z5 : [LTHR + 4,  FCmax]
```

### 2.4 Méthode `test30` (test lactate terrain)

Basée sur le LTHR mesuré par un test de 30 min all-out :

```
Z1 : [0,           0,85 × LTHR]
Z2 : [0,85 × LTHR, 0,89 × LTHR]
Z3 : [0,90 × LTHR, 0,94 × LTHR]
Z4 : [0,95 × LTHR, 0,99 × LTHR]
Z5 : [LTHR,        FCmax]
```

### 2.5 Méthode `auto` (estimation par âge)

```
FCmax_estimée = 208 − 0,7 × âge
```
puis zones identiques à `pct_max` sur cette FCmax estimée.

### 2.6 Comparaison des méthodes

| Méthode | Données requises | Précision | Cas d'usage |
|---|---|---|---|
| `auto` | Année de naissance | Approximative | Démarrage sans mesures |
| `pct_max` | FCmax | Correcte | FCmax mesurée ou estimée |
| `karvonen` | FCmax + FCrepos | Bien | Profil athlète partiellement renseigné |
| `test30` | FCmax + LTHR | Très bien | Test terrain régulier |
| `seuils` | FCmax + AeT + LTHR | Excellente | Athlète avec bilan physiologique |

---

## 3. Détermination de la zone depuis la FC moyenne

### Algorithme `hrZoneForAvgHr`

```
Pour chaque zone z dans [Z1, Z2, Z3, Z4, Z5] (ordre croissant de seuils) :
  Si FCmoy ≤ z.max → retourner z.numéro
Si FCmoy > Z5.max → retourner 5  (clamp au plafond)
```

**Application à l'activité de référence (pct_max, FCmax = 195) :**
```
FCmoy = 142
Z1.max = 140  →  142 > 140, continuer
Z2.max = 152  →  142 ≤ 152 ✓  →  Zone 2
```
→ Zone 2 = **Endurance active**

---

## 4. Distribution du temps par zone (loi normale tronquée)

### 4.1 Modèle probabiliste

La FC d'une activité n'est pas constante — elle fluctue autour de la moyenne. On modélise la **distribution instantanée de la FC** par une loi normale tronquée :

```
FC ~ N(μ, σ²)  tronquée sur [FCrepos, FCmax_activité]

μ = FCmoy            (centre de la distribution)
σ = (FCmax_activité − FCmoy) / 2
```

**Justification du σ** : le max observé est statistiquement à ~2σ au-dessus de la moyenne (règle empirique : 95 % des valeurs d'une loi normale se trouvent dans [μ − 2σ, μ + 2σ]).

**Pour l'activité de référence :**
```
μ = 142 bpm
σ = (162 − 142) / 2 = 10 bpm
```

### 4.2 Fonction CDF normale — approximation Abramowitz & Stegun

La probabilité d'être en dessous d'un seuil x est :

```
Φ(z) = ½ × [1 + erf(z / √2)]      avec z = (x − μ) / σ
```

L'approximation de la fonction erf utilisée (erreur < 1,5 × 10⁻⁷) :

```
erf(x) ≈ 1 − (a₁t + a₂t² + a₃t³ + a₄t⁴ + a₅t⁵) × e^(−x²)

t  = 1 / (1 + 0,3275911 × |x|)

a₁ =  0,254829592
a₂ = −0,284496736
a₃ =  1,421413741
a₄ = −1,453152027
a₅ =  1,061405429

Pour x < 0 : erf(x) = −erf(|x|)
```

### 4.3 Calcul du temps dans chaque zone

```
Poids_zone_k = Φ((z_k.max − μ) / σ) − Φ((z_k.min − μ) / σ)

Contrainte : si z_k.min ≥ FCmax_activité  →  Poids_k = 0  (zone inaccessible)

Temps_zone_k = (Poids_k / Σ Poids) × Durée_totale
```

### 4.4 Application numérique complète (activité de référence)

```
μ = 142,  σ = 10,  FCmax_activité = 162,  Durée = 97 min
Zones pct_max avec FCmax_athlète = 195

Z1 (max=140) : Φ((140−142)/10) − Φ(−∞) = Φ(−0,20) = 0,421
Z2 (max=152) : Φ((152−142)/10) − Φ(−0,20) = Φ(1,00) − 0,421 = 0,841 − 0,421 = 0,420
Z3 (max=162) : Φ((162−142)/10) − Φ(1,00)  = Φ(2,00) − 0,841 = 0,977 − 0,841 = 0,136
Z4/Z5 : z_k.min ≥ 162  →  Poids = 0

Somme = 0,977  →  facteur de normalisation = 1/0,977 = 1,024

Temps effectifs :
  Z1 : 0,421 × 1,024 × 97 ≈ 42 min
  Z2 : 0,420 × 1,024 × 97 ≈ 42 min
  Z3 : 0,136 × 1,024 × 97 ≈ 13 min
```
→ Résultat affiché : Z1 ≈ 41 min, Z2 ≈ 46 min, Z3 ≈ 9 min ✓

---

## 5. Détermination de l'intensité d'une activité (`guessIntensity`)

> **Refonte 2026-05-11** : séparation stricte des deux notions.
> - `guessIntensity` n'utilise **plus aucun mot-clé** — c'est désormais une fonction **purement FC**. Si la FC moyenne ou les zones sont absentes, elle retourne `null`.
> - `IntensityKey` ne contient plus que les 5 zones physiologiques (`recuperation`, `footing`, `endurance_active`, `seuil`, `vma`). Les valeurs `sortie_longue`, `cotes`, `autre` ont été retirées.
> - Un nouveau type `WorkoutType` et la fonction `guessWorkoutType` capturent la dimension contextuelle (titre + sport) — voir section 5.5.
> - Migration Supabase `011_add_manual_workout_type.sql` : ajout de la colonne `manual_workout_type`, rapatriement des `manual_intensity = 'sortie_longue' / 'cotes'` vers cette nouvelle colonne.
> - Le fallback CES a été supprimé : on ne déduit plus jamais l'intensité depuis le score d'effort.

### 5.1 Chaîne de priorité (ordre strict)

```
1. Override manuel (colonne `manual_intensity` en base de données)
        ↓  sinon
2. guessIntensity(avgHr, hrZones, { activityMaxHr, movingTimeSec, restingHr })
   ├─ Mode distribution : classifyIntensityFromZoneTimes(...) si max_hr + durée OK
   └─ Mode fallback     : hrZoneForAvgHr(FCmoy, zones)
        ↓  si FCmoy absent OU zones non disponibles
3. null         (aucun chip actif dans l'UI)
```

Aucune étape par mot-clé. Aucun fallback CES.

### 5.2 Type `IntensityKey`

```ts
type IntensityKey =
  | 'recuperation'      // 😴  Z1
  | 'footing'           // 🦶  Z2
  | 'endurance_active'  // 🔄  Z3
  | 'seuil'             // 🎯  Z4
  | 'vma'               // 🔥  Z5
```

Cinq valeurs strictement physiologiques. `null` est utilisé pour "indéterminable".

### 5.3 Algorithme `guessIntensity` (pur FC)

```ts
function guessIntensity(
  avgHr?:   number | null,
  hrZones?: HrZone[],
  opts?: {
    activityMaxHr?: number | null
    movingTimeSec?: number | null
    restingHr?:     number | null
  },
): IntensityKey | null
```

La fonction a **deux modes** selon les données disponibles :

#### Mode 1 — Distribution (préféré, refonte 2026-05-12)

Si `activityMaxHr` et `movingTimeSec` sont fournis et cohérents (`activityMaxHr > avgHr`, `movingTimeSec > 0`) :

1. Calculer `restingHr` (depuis le profil, ou estimé : `max(avgHr − 3σ, 40)` où `σ = max((activityMaxHr − avgHr) / 2, 3)`).
2. Calculer la distribution temps/zones via `distributeTimeInZones(zones, avgHr, activityMaxHr, movingTimeSec, restingHr)` (section 4).
3. Appliquer `classifyIntensityFromZoneTimes(distribution)` — cascade par zone supérieure significative (premier match gagne) :

```
total = Σ zoneTimesSec

Si  Z5 / total       ≥ 15 %  →  vma
Si (Z4 + Z5) / total ≥ 20 %  →  seuil
Si (Z3 + Z4 + Z5) / total ≥ 40 %  →  endurance_active
Si  Z2 ≥ Z1                    →  footing
Sinon                            →  recuperation
```

**Justification des seuils (littérature) :**

| Seuil | Référence | Logique |
|---|---|---|
| Z5 ≥ 15 % | Daniels (2014) — prescription VO₂max = 3×5 min en Z5 ≈ 25 % d'une séance d'1 h ; 15 % capture les vraies séances VO₂max sans inclure les pics fugaces | Empreinte VO₂max stable |
| Z4+Z5 ≥ 20 % | Seiler & Kjerland (2006), Stöggl & Sperlich (2014) — TID HIT chez l'élite endurance : 15-20 % du volume en zones hautes par semaine ; 20 % en intra-séance = stimulus supra-seuil clairement marqué | Séance "qualité" (HIT au sens Seiler) |
| Z3+ ≥ 40 % | Empirique — au-delà de 40 % du temps au-dessus de l'endurance fondamentale, la séance change de nature même si la FC moyenne reste basse | Capture trail vallonné, sortie progressive |

**Pourquoi cascade et pas "max(Z3, Z4, Z5)" ?**
Le maximum numérique en Z3-Z4-Z5 reflète la **zone la plus représentée**, pas la **plus haute intensité atteinte**. Une séance avec 30 % en Z3 + 25 % en Z4 + 8 % en Z5 a Z3 dominant numériquement, mais l'empreinte Z4+Z5 = 33 % signe un travail supra-seuil clair. La cascade par zone supérieure (Coggan, Foster, Lucia) reflète la nature physiologique de la séance.

**Cas particulier — fractionnés courts :**
Sur fractions courtes (300-400 m, ~1 min d'effort), la FC met 20-30 s à monter en Z4-Z5. La fraction est presque terminée quand le pic FC est atteint. L'empreinte cardio moyenne reste dominée par Z3-Z4 → ces séances sont classées `seuil` (physiologiquement correct au sens Daniels — c'est du travail "R" Repetition / sub-VO₂max). Le caractère "fractionné" est capturé séparément par `WorkoutType` (chip ⌚ Fractionné).

#### Mode 2 — FC moyenne (fallback)

Si `activityMaxHr` ou `movingTimeSec` manque (par ex. liste pré-2026-05-11 sans `max_hr` en base, ou activité sans capteur cardio sur tout le parcours) :

1. `hrZoneForAvgHr(avgHr, hrZones)` retourne le numéro de zone 1–5.
2. `zoneToIntensity(zone)` → `IntensityKey`.

C'est l'algorithme historique. Plus simple mais aveugle à la distribution — peut classer "footing" une activité qui passe 40 % du temps en Z3+.

#### Cas pratique — "Trail des lavoirs"

```
FC moy = 153 bpm  |  FC max activité = 177 bpm  |  Durée = 4h17

Distribution calculée :
  Z1 : 34 min  (13 %)
  Z2 : 102 min (40 %)
  Z3 : 97 min  (38 %)
  Z4 : 23 min  (9 %)
  Z5 : 0
  
  upperRatio = (97 + 23 + 0) / 256 = 47 %  ≥  40 %  →  BASCULE

  max(Z3=97, Z4=23, Z5=0) = Z3  →  endurance_active
```

→ Sans la règle de bascule (mode FC moyenne) : 153 bpm tombe en Z2 → footing. La règle redresse correctement vers `endurance_active`.

### 5.4 Mapping Zone FC → Intensité

```
Zone 1  →  recuperation     😴  (très facile, récup active)
Zone 2  →  footing          🦶  (endurance fondamentale)
Zone 3  →  endurance_active 🔄  (tempo, effort soutenu mais aérobie)
Zone 4  →  seuil            🎯  (proche du seuil anaérobie)
Zone 5  →  vma              🔥  (VO₂max, effort maximal)
```

> **Cohérence** : une zone FC est une intensité physiologique instantanée, pas une catégorie de séance. Z1 → `recuperation` (et non `footing`), Z3 → `endurance_active` (et non `sortie_longue`).

### 5.5 Type `WorkoutType` (orthogonal à `IntensityKey`)

```ts
type WorkoutType =
  | 'sortie_longue'  // 🐢
  | 'fractionne'     // ⌚
  | 'cotes'          // ⛰️
  | 'course'         // 🏆
  | 'runtaf'         // 🏃‍♂️💻  (sport ∈ {Run, TrailRun} uniquement)
  | 'velotaf'        // 🚴🏻💻  (sport ∈ {Ride, EBikeRide, VirtualRide} uniquement)
```

Six valeurs. Pas de `'autre'` — l'absence de type = `null`.

Override manuel : colonne `manual_workout_type` en base de données.

**Restrictions par sport** :

| `WorkoutType` | Sports autorisés |
|---|---|
| `sortie_longue`, `fractionne`, `cotes`, `course` | tous |
| `runtaf` | `Run`, `TrailRun` |
| `velotaf` | `Ride`, `EBikeRide`, `VirtualRide` |

Dans l'UI, les options affichées sont filtrées par sport ; si le sport change et que le type sélectionné devient incompatible, il est réinitialisé à `null`.

`WorkoutType` répond à *"Quelle structure de séance ?"* (volume / intervalles / déplacement quotidien / compétition).
`IntensityKey` répond à *"Quelle intensité physiologique ?"*.

Une "Sortie longue" peut être en `footing` (Z2) **ou** `endurance_active` (Z3) — les deux dimensions sont indépendantes.

### 5.5 bis Détection `guessWorkoutType(name, sport)`

Ordre de priorité (premier match gagne) :

| Priorité | Détection | `WorkoutType` |
|:-:|---|---|
| 1 | sport ∈ {Run, TrailRun} ET nom contient `runtaf`, `run taf`, `taf`, ou nom exact `Home 🏃‍♂️` / `🏃‍♂️ Home` | `runtaf` |
| 2 | sport ∈ {Ride, EBikeRide, VirtualRide} ET nom contient `vélotaf`, `velotaf`, `vélo taf`, `taf`, ou nom exact `Home 🚴🏻` / `🚴🏻 Home` | `velotaf` |
| 3 | nom contient `côtes`, `cotes`, `côte`, `cote`, `montée`, `montee`, `hill` | `cotes` |
| 4 | nom contient une distance isolée (200/300/400/500/800/1000), ou `vma`, `interval`, `fractionné`, `fractionnée`, `répétition`, `repetition` | `fractionne` |
| 5 | nom contient `race`, `compét`, `compet`, `dossard`, `chrono`, ` pb `, ` pr `, `10k`, `semi`, `marathon` (et pas `course à pied`) | `course` |
| 6 | nom contient `sortie longue`, mot exact `sl`, `long run`, `lsl` | `sortie_longue` |
| 7 | aucun match | `null` |

### 5.6 Fallback CES & mots-clés intensité — SUPPRIMÉS

L'ancienne règle (`CES > 120 → seuil`, `CES ≥ 70 → runtaf`, etc.) **et** la table de mots-clés intensité (vma/seuil/footing/récup) ont été retirées de `guessIntensity`.

**Justifications :**
- Le CES est une mesure de **charge globale** (durée × intensité × dénivelé). En déduire l'intensité physiologique conduisait à classer les longues sorties Z1/Z2 en "seuil" parce que leur CES dépasse 120.
- Les mots-clés du titre décrivent la **structure de la séance** (fractionné, sortie longue, runtaf…), pas l'intensité cardiaque réelle. Mélanger les deux brouillait l'analyse.

Désormais : pas de FC ou pas de zones ⇒ `null`. La structure de séance va dans `WorkoutType`.

### 5.7 Application à l'activité de référence

```
Nom        = "Sortie trail vallonné - 🎯 500m D+"
FCmoy      = 142
FCmax act. = 162
Durée      = 97 min
Zones      = pct_max (FCmax=195) → Z1≤140, Z2≤152, Z3≤166, Z4≤179, Z5≤195

guessIntensity(142, zones, { activityMaxHr=162, movingTimeSec=5820 }) :
  → distributeTimeInZones → [41, 46, 9, 0, 0] (en min, approx.)
  → upperRatio = (9+0+0)/96 ≈ 9 %  <  40 %  →  pas de bascule
  → max(Z1=41, Z2=46) = Z2  →  footing  🦶

guessWorkoutType("Sortie trail vallonné - 🎯 500m D+", "TrailRun") :
  → Aucun mot-clé typé ne correspond
  → null  (aucun chip actif dans l'UI)
```

Sur cet exemple : 9 % de Z3+ → reste en `footing` (cohérent). Sur une activité plus vallonnée avec Z3+ ≥ 40 %, on basculerait en `endurance_active`.

---

## 6. Calcul du CES (Cockpit Effort Score)

### 6.1 Formule générale

```
CES = DuréeHeures × SportBase × IF² × SportFactor × FacteurDénivelé
```

### 6.2 Facteur d'Intensité (IF) — CES v2 profile-aware

Depuis CES v2 (commit `5e7f9eff`), l'IF privilégie les valeurs du **profil utilisateur** avant de retomber sur les valeurs par défaut. Le résultat de `calcIF()` retourne aussi un `model` (`'power' | 'pace_threshold' | 'legacy'`) et un `source` lisible (ex: `"FTP utilisateur 250W (NP)"`).

**Vélo (road / gravel / mtb / indoor)** — priorité décroissante :
```
1. profile.ftp_watts        + normalizedPowerWatts  →  NP / FTP_user
2. profile.ftp_watts        + averageWatts           →  avg / FTP_user
3. cfg.thresholdPower (220) + NP                     →  NP / FTP_default
4. cfg.thresholdPower (220) + avg                    →  avg / FTP_default
5. cfg.defaultIF                                     →  legacy
```

**Course route** :
```
1. profile.threshold_pace_run_sec_per_km  →  pace_seuil_user / pace_activité
2. cfg.thresholdPaceSecPerKm (300)        →  pace_seuil_default / pace_activité
3. cfg.defaultIF                          →  legacy
```

**Trail** :
```
1. profile.threshold_pace_trail_sec_per_km  →  pace_seuil_trail_user / pace_activité
2. cfg.thresholdPaceSecPerKm (330)          →  pace_seuil_trail_default / pace_activité
3. cfg.defaultIF                            →  legacy
```

Clamping systématique : `IF = max(cfg.minIF, min(IF, cfg.maxIF))`.

### 6.2 bis Confidence et warnings

Chaque calcul retourne `confidence: 'high' | 'medium' | 'low'` et `warnings: string[]` :

| Cas | Confidence | Warning |
|---|---|---|
| Run sans `threshold_pace_run_sec_per_km` user | `low` | "Score calculé avec une allure seuil par défaut. Renseigne ton allure seuil." |
| Trail sans `threshold_pace_trail_sec_per_km` user | `medium` | "Score trail calculé avec une allure seuil par défaut." |
| Trail avec D+ > 0 | dégradé à `medium` | "Le score trail utilise uniquement le D+. La descente et la technicité ne sont pas encore prises en compte." |
| Vélo avec `model = 'legacy'` (pas de puissance) | `low` | "Score vélo calculé sans données de puissance. Renseigne ton FTP." |

### 6.3 Paramètres par sport

| Sport | SportBase | SportFactor | AllureSeuil (s/km) | PuissanceSeuil (W) | IFmin | IFmax | SensiElev |
|---|---|---|---|---|---|---|---|
| Run (route) | 100 | 1,00 | 300 (5:00/km) | — | 0,4 | 1,3 | 8 |
| Trail run | 100 | 1,15 | 330 (5:30/km) | — | 0,4 | 1,3 | 12 |
| Marche | 60 | 0,50 | — | — | 0,3 | 0,8 | 10 |
| Randonnée | 60 | 0,65 | — | — | 0,3 | 0,9 | 14 |
| Vélo route | 80 | 0,75 | — | 220 | 0,3 | 1,2 | 5 |
| Vélo gravel | 80 | 0,85 | — | 220 | 0,3 | 1,2 | 7 |
| VTT | 90 | 1,00 | — | 220 | 0,4 | 1,3 | 9 |
| Vélo indoor | 80 | 0,70 | — | 220 | 0,3 | 1,2 | 0 |
| Natation | 120 | 1,10 | — | — | 0,4 | 1,2 | 0 |
| Muscu | 80 | 0,90 | — | — | 0,4 | 1,1 | 0 |
| Mobilité | 40 | 0,40 | — | — | 0,2 | 0,7 | 0 |
| Cardio autre | 80 | 0,80 | — | — | 0,3 | 1,1 | 0 |
| Autre | 70 | 0,70 | — | — | 0,3 | 1,0 | 0 |

### 6.4 Facteur dénivelé

```
GradientPour100m = (D+_m / Distance_m) × 100

FacteurDénivelé = 1,0 + GradientPour100m × SensiElev × 0,01
```

### 6.5 Application numérique complète (activité de référence)

```
Sport détecté : TrailRun (nom contient "trail")
SportBase     = 100
SportFactor   = 1,15
SensiElev     = 12
AllureSeuil   = 330 s/km

Durée         = 5820 s  →  1,617 h
Allure réelle = 5820 / (12200/1000) = 477,0 s/km

IF = 330 / 477,0 = 0,692     (clamped [0,4 ; 1,3] → 0,692)
IF² = 0,479

GradientPour100m = (527 / 12200) × 100 = 4,32
FacteurDénivelé  = 1,0 + 4,32 × 12 × 0,01 = 1,519

BaseScore = 1,617 × 100 × 0,479 = 77,5
CES final = 77,5 × 1,15 × 1,519 = 135,4  ≈  135
```

### 6.6 Décomposition de la contribution de chaque facteur

```
CES sans dénivelé (terrain plat équivalent) :
  CES_plat = 1,617 × 100 × 0,479 × 1,15 × 1,0 = 89,1

Contribution du dénivelé +527 m :
  Δ = 135 − 89 = +46 points (+52%)

Interprétation : grimper sollicite davantage les muscles
(coût énergétique ~+10% par 1% de pente) même si la FC
reste en zone endurance. Le CES capture ce stress mécanique
indépendamment de l'intensité cardiovasculaire.
```

---

## 7. Niveaux de charge CES et leur signification

| Plage CES | Label | Exemples typiques |
|---|---|---|
| 0 – 40 | Séance légère | Récup 30 min, mobilité, yoga |
| 41 – 80 | Charge modérée | Footing 1h plat, vélo 45 min |
| 81 – 130 | Charge significative | Sortie longue 1h30, tempo 1h |
| 131 – 200 | Charge élevée | Trail avec D+, compétition |
| 200+ | Charge très élevée | Ultra, effort prolongé > 3h |

> **Attention** : ces plages mesurent la **charge globale (volume × intensité × dénivelé)**, pas l'intensité seule.
> Une sortie Z1/Z2 de 2h trail = CES 150 (charge élevée, intensité basse).
> Une course 5 km all-out = CES ≈ 50 (charge modérée, intensité maximale).

---

## 8. Cohérence visuelle : couleur du badge d'effort selon l'intensité FC

La liaison entre charge et intensité est exprimée par la **couleur du badge CES** :

| Intensité détectée | Zone FC | Couleur du badge "⚡ Effort X" | Code hex |
|---|---|---|---|
| recuperation 😴 | Z1 | Vert pâle | `#86efac` |
| footing 🦶 | Z2 | Vert | `#4ade80` |
| endurance_active 🔄 | Z3 | Bleu clair | `#38bdf8` |
| seuil 🎯 | Z4 | Orange | `#ffa500` |
| vma 🔥 | Z5 | Rouge | `#ef4444` |
| `null` (pas de données FC ou zones non configurées) | — | Jaune (défaut) | `#ffc107` |

**Lecture correcte pour l'activité de référence :**
- Zone FC = 2 → Intensité = footing → Badge **vert "⚡ Effort 135"**
- Signal : charge élevée (135) réalisée à intensité basse (vert)

---

## 9. Intégration dans le modèle de fatigue (EWMA)

Le CES de chaque activité alimente le calcul de la **charge chronique** via des moyennes exponentielles pondérées (EWMA) :

```
ATL_j = ATL_{j-1} × (1 − α₇)  + CES_j × α₇       (Fatigue aiguë,    7 jours)
CTL_j = CTL_{j-1} × (1 − α₄₂) + CES_j × α₄₂      (Forme chronique, 42 jours)

α₇  = 1 − e^(−1/7)  ≈ 0,1331
α₄₂ = 1 − e^(−1/42) ≈ 0,0233

TSB (Fraîcheur)  = CTL − ATL
LoadRatio        = ATL / CTL
```

**Conséquence importante** : un CES élevé fait monter l'ATL (fatigue à court terme) même si l'intensité physiologique était faible. Une longue sortie trail en Z1/Z2 (CES = 135) augmente l'ATL autant qu'une séance seuil plus courte — les deux provoquent un stress comparable, par des mécanismes différents (musculaire + dénivelé vs cardiovasculaire + acide lactique).

---

## 10. Synthèse : articulation des trois niveaux

```
┌─────────────────────────────────────────────────────────────────┐
│ NIVEAU 1 — Intensité physiologique instantanée                  │
│                                                                 │
│   FCmoy ─→ hrZoneForAvgHr() ─→ Zone 1-5                        │
│         ─→ zoneToIntensity()  ─→ recuperation / footing /       │
│                                   endurance_active / seuil / vma│
│                                                                 │
│   Répond à : "À quelle intensité ai-je couru ?"                 │
│   Exprimé par : emoji 😴 🦶 🔄 🎯 🔥 + couleur du badge        │
├─────────────────────────────────────────────────────────────────┤
│ NIVEAU 2 — Charge de la séance (CES)                            │
│                                                                 │
│   CES = Durée × SportBase × IF² × SportFactor × FacteurD+      │
│                                                                 │
│   Répond à : "Quel stress total cette séance a-t-elle causé ?"  │
│   Exprimé par : chiffre ⚡ coloré selon le Niveau 1             │
├─────────────────────────────────────────────────────────────────┤
│ NIVEAU 3 — Charge chronique (fatigue / forme / fraîcheur)       │
│                                                                 │
│   ATL  = EWMA 7j  des CES quotidiens                           │
│   CTL  = EWMA 42j des CES quotidiens                           │
│   TSB  = CTL − ATL  (fraîcheur)                                │
│   LoadRatio = ATL / CTL                                         │
│                                                                 │
│   Répond à : "Suis-je frais ou fatigué sur les dernières        │
│               semaines ?"                                        │
│   Exprimé par : graphiques Charge / Fatigue / Fraîcheur         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Fichiers d'implémentation

| Calcul | Fichier |
|---|---|
| Zones FC (5 méthodes) | `web/lib/health/hr-zones.ts` |
| `hrZoneForAvgHr()` | `web/lib/health/hr-zones.ts` |
| Mode zones recommandé (priorité auto) | `web/lib/analytics/hr-zones.ts` (`getRecommendedHeartRateZoneMode`) |
| Distribution temps par zone (loi normale tronquée + plafond FCmax_activité) | `web/components/ui/ActivityHeartRateZones.tsx` |
| `guessIntensity()`, `classifyIntensityFromZoneTimes()`, `zoneToIntensity()`, `IntensityKey`, `INTENSITY_OPTIONS` | `web/lib/activities/intensity.ts` |
| `distributeTimeInZones()` (loi normale tronquée — utilisée par `guessIntensity` mode distribution) | `web/lib/health/hr-zones.ts` |
| `guessWorkoutType()`, `WorkoutType`, `WORKOUT_TYPE_OPTIONS` | `web/lib/activities/intensity.ts` |
| Tests classification (intensité + type de séance) | `web/__tests__/activities/classification.test.ts` |
| Colonne `manual_workout_type` (DB) | `web/supabase/migrations/011_add_manual_workout_type.sql` |
| Formule CES v2 (profile-aware, confidence, warnings) | `web/lib/analytics/effort-score.ts` |
| Types `CesResult`, `UserProfileForCes`, `CesConfidence` | `web/lib/analytics/types.ts` |
| Recalcul batch CES + fatigue après modif profil | `web/lib/sync/recalculate-scores.ts` |
| Endpoint recalcul | `web/app/api/profile/recalculate/route.ts` |
| EWMA ATL/CTL, TSB, `buildFatigueResult` (avec confidence) | `web/lib/analytics/fatigue.ts` |
| Badge d'effort coloré (détail activité) | `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` |
| Badge d'effort coloré (carte activité) | `web/components/ui/ActivityCard.tsx` |
| Popup explication CES | `web/components/ui/ActivityPopups.tsx` |
| Dashboard : `intensityBreakdown`, `sportOverviews` | `web/lib/data/dashboard.ts` |
| Migrations Supabase (threshold_pace, version, soft-delete) | `web/supabase/migrations/005..008_*.sql` |
