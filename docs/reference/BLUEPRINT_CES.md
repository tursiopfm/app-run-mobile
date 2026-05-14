# BLUEPRINT — Cockpit Trail : Modèle Multi-Sports Effort, Charge, Fatigue et Recommandations

> Doc vivante · dernière vérification: 2026-05-14 vs code
> Code source: [web/lib/analytics/](../../web/lib/analytics/) (effort-score, load, fatigue, charge-insights, ultra-ready)

## Objectif

Mettre à jour l'application **Cockpit Trail** avec un moteur mathématique **multi-sports** capable de calculer un score d'effort par activité, puis une charge d'entraînement quotidienne, hebdomadaire et long terme.

Le modèle ne doit pas être limité à la course à pied. Il doit fonctionner pour :

- course route
- trail
- marche
- randonnée
- vélo route
- gravel
- VTT
- home trainer
- natation
- renforcement / musculation
- mobilité / yoga
- autre activité cardio

Le modèle doit produire des indicateurs lisibles pour l'utilisateur :

- Effort activité
- Intensité activité
- Charge jour
- Charge semaine
- Fatigue récente
- Capacité d'entraînement
- Fraîcheur
- Indice de surcharge
- Charge musculaire
- Recommandation de prochaine séance

Le modèle doit remplacer l'affichage prioritaire ATL / CTL / TSB par des noms compréhensibles, tout en permettant de conserver les anciennes valeurs en backend.

---

# 0. CES v2 — Profile-aware (état au 2026-05-09)

L'implémentation web (`web/lib/analytics/effort-score.ts`) intègre une **version 2** du modèle CES qui s'appuie sur le profil utilisateur réel et expose une **confiance** + des **avertissements**.

## 0.1 Profil utilisateur étendu

```ts
type UserProfileForCes = {
  ftp_watts?: number                          // vélo
  threshold_pace_run_sec_per_km?: number      // course route
  threshold_pace_trail_sec_per_km?: number    // trail
  // FC max, AeT, LTHR, FC repos viennent du profil global (table profiles)
}
```

Migrations Supabase associées :
- `005_profile_threshold_pace.sql` — colonnes `threshold_pace_run_sec_per_km` et `threshold_pace_trail_sec_per_km`
- `004_profile_cardio_fields.sql` — colonne `aerobic_threshold_hr` et autres champs cardio
- `006_activity_effort_score_version.sql` — colonne `effort_score_version` sur `activities` (permet le recalcul ciblé)

## 0.2 Priorité de calcul de l'IF (mise à jour)

L'ordre de priorité a été précisé :

**Vélo (road / gravel / mtb / indoor)**
1. FTP utilisateur + puissance normalisée (`normalizedPowerWatts / ftp`)
2. FTP utilisateur + puissance moyenne (`averageWatts / ftp`)
3. FTP par défaut (220 W) + NP ou avg
4. `defaultIF` du sport

**Course route**
1. Allure seuil utilisateur (`profile.threshold_pace_run_sec_per_km / paceActivité`)
2. Allure seuil par défaut (300 s/km = 5:00/km)
3. `defaultIF`

**Trail**
1. Allure seuil trail utilisateur (`profile.threshold_pace_trail_sec_per_km / paceActivité`)
2. Allure seuil trail par défaut (330 s/km = 5:30/km)
3. `defaultIF`

Le résultat de `calcIF()` retourne :
```ts
type IFResult = {
  value:  number      // IF clamped [minIF, maxIF]
  source: string      // ex: "FTP utilisateur 250W (NP)"
  model:  'power' | 'pace_threshold' | 'legacy'
}
```

## 0.3 Confiance et avertissements

Chaque calcul CES retourne une `confidence` (`'high' | 'medium' | 'low'`) et un `warnings: string[]`.

Règles principales :

| Cas | Confidence | Warning |
|---|---|---|
| Run sans `threshold_pace_run_sec_per_km` | `low` | "Score calculé avec une allure seuil par défaut. Renseigne ton allure seuil pour améliorer la précision." |
| Trail sans `threshold_pace_trail_sec_per_km` | `medium` | "Score trail calculé avec une allure seuil par défaut. Renseigne ton allure seuil trail pour plus de précision." |
| Trail avec D+ > 0 | dégradé à `medium` si `high` | "Le score trail utilise uniquement le D+. La descente et la technicité ne sont pas encore prises en compte." |
| Vélo sans puissance (model = `legacy`) | `low` | "Score vélo calculé sans données de puissance. Renseigne ton FTP pour améliorer la précision." |

L'UI peut afficher un badge ou un tooltip "données manquantes" plutôt que d'afficher silencieusement un score imprécis.

## 0.4 Résultat retourné

```ts
type CesResult = {
  ces:               number                          // score arrondi
  cardioLoad:        number                          // baseScore × sportFactor
  muscleLoad:        number                          // finalScore × 0.6
  label:             EffortLabel                     // recovery → extreme
  intensityFactor:   number                          // IF arrondi à 2 décimales
  model:             'power' | 'pace_threshold' | 'legacy'
  confidence:        'high' | 'medium' | 'low'
  components: {
    durationHours, intensityFactor, thresholdSource,
    elevationFactor, sportFactor
  }
  warnings:          string[]
  version:           'v2.0'
}
```

## 0.5 Recalcul historique

Quand l'utilisateur met à jour son profil (FTP, allure seuil, FC max), un endpoint dédié recalcule **toute son historique** :

```
POST /api/profile/recalculate
  → recalculateUserEffortScores(userId)   // batch CES sur toutes les activités
  → recalculateUserFatigue(userId)        // recalc EWMA daily_metrics
```

L'utilisateur voit ainsi ses anciennes activités refléter son nouveau profil sans attendre une nouvelle sync.

## 0.6 Fatigue avec confidence (historique < 42j)

`buildFatigueResult()` (`web/lib/analytics/fatigue.ts`) retourne :
```ts
type FatigueResult = {
  metrics:    DailyMetrics[]            // série complète { date, dailyLoad, atl, ctl, tsb }
  confidence: 'high' | 'medium' | 'low'
  warnings:   string[]
}
```

Règles confidence (basées sur la longueur d'historique consécutif) :
- `low` si `historyDays < 14`
- `medium` si `14 ≤ historyDays < 42`
- `high` sinon

L'EWMA est calculée avec `alpha = 1 - exp(-1/k)` (k=7 pour ATL, k=42 pour CTL), initialisée sur la première valeur de la série. **Les jours manquants sont remplis à `ces = 0`** (cf. `fillConsecutiveDays`) — invariant critique pour la stabilité des courbes.

---

# 1. Principe général

Chaque activité reçoit un score unique :

```txt
CES = Cockpit Effort Score
```

Le score représente le coût physiologique global de l'activité.

Formule actuelle (CES v2.0, simplifiée par rapport à la vision long terme) :

```txt
CES = DurationHours × SportBase × IF² × SportFactor × ElevationFactor
```

Avec :

```txt
DurationHours = movingTimeSeconds / 3600
```

Le modèle garde la logique suivante :

```txt
1 heure à intensité seuil (IF = 1) pour un run ≈ 100 points
```

Mais il adapte `SportBase` et `SportFactor` selon le sport (cf. §7).

Roadmap (non implémentés à date) : `K_cardio`, `K_terrain`, `K_muscular` (descente), `K_fatigue` (préalable), `K_rpe`. Voir §9, §11, §12, §13, §14 pour la spec cible.

---

# 2. Labels utilisateur

| CES activité | Label utilisateur | Signification |
|---:|---|---|
| 0–30 | Récupération | Très facile |
| 31–60 | Endurance | Sortie facile utile |
| 61–90 | Soutenu | Bon stimulus d'entraînement |
| 91–130 | Intense | Séance exigeante |
| 131–180 | Très dur | Grosse charge |
| 180+ | Extrême | Course, sortie longue ou surcharge |

Libellés techniques :

```ts
export type EffortLabel =
  | 'recovery'
  | 'endurance'
  | 'steady'
  | 'intense'
  | 'very_hard'
  | 'extreme';
```

---

# 3. Sports supportés

Créer une normalisation des sports, car Strava, Garmin et autres sources n'utilisent pas toujours les mêmes noms.

```ts
export type SportCategory =
  | 'run'
  | 'trail_run'
  | 'walk'
  | 'hike'
  | 'road_ride'
  | 'gravel_ride'
  | 'mountain_bike'
  | 'indoor_ride'
  | 'swim'
  | 'strength'
  | 'mobility'
  | 'cardio_other'
  | 'other';
```

Exemples de mapping :

```ts
export function normalizeSportType(rawSportType: string, name?: string): SportCategory {
  const raw = rawSportType.toLowerCase();
  const title = (name || '').toLowerCase();

  if (raw.includes('trail')) return 'trail_run';
  if (raw.includes('run')) return title.includes('trail') ? 'trail_run' : 'run';
  if (raw.includes('walk')) return 'walk';
  if (raw.includes('hike')) return 'hike';
  if (raw.includes('gravel')) return 'gravel_ride';
  if (raw.includes('mountain') || raw.includes('mtb')) return 'mountain_bike';
  if (raw.includes('virtualride') || raw.includes('indoor') || raw.includes('trainer')) return 'indoor_ride';
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycling')) return 'road_ride';
  if (raw.includes('swim')) return 'swim';
  if (raw.includes('strength') || raw.includes('weight') || raw.includes('muscu')) return 'strength';
  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('stretch')) return 'mobility';

  return 'other';
}
```

---

# 4. Variables nécessaires par activité

```ts
export type ActivityInput = {
  id: string;
  source: 'strava' | 'garmin' | 'manual' | 'other';
  rawSportType: string;
  sportCategory?: SportCategory;
  name?: string;
  startDate: string; // ISO date

  distanceMeters?: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds?: number;

  elevationGainMeters?: number;
  elevationLossMeters?: number;

  averageSpeedMetersPerSecond?: number;
  maxSpeedMetersPerSecond?: number;

  averageHeartrate?: number;
  maxHeartrate?: number;

  averageCadence?: number;
  averageWatts?: number;
  weightedAverageWatts?: number;
  normalizedPowerWatts?: number;

  calories?: number;
  sufferScore?: number;

  perceivedEffort?: number; // RPE 1 à 10

  poolLengthMeters?: number;
  swimStrokeCount?: number;
  averageSwolf?: number;

  strengthSets?: number;
  strengthReps?: number;
  totalLoadKg?: number;
};
```

---

# 5. Profil utilisateur

```ts
export type AthleteProfile = {
  userId: string;

  restingHeartRate?: number;
  maxHeartRate?: number;
  thresholdHeartRate?: number;

  thresholdPaceSecPerKm?: number; // course route
  trailThresholdPaceSecPerKm?: number; // optionnel

  ftpWatts?: number; // vélo
  swimThresholdPaceSecPer100m?: number; // natation CSS ou allure seuil natation

  weightKg?: number;

  defaultRpeBySport?: Partial<Record<SportCategory, number>>;
};
```

Valeurs par défaut si profil incomplet :

```ts
export const DEFAULT_PROFILE = {
  restingHeartRate: 55,
  maxHeartRate: 185,
  thresholdHeartRate: 165,
  thresholdPaceSecPerKm: 300, // 5:00/km
  trailThresholdPaceSecPerKm: 330, // 5:30/km
  ftpWatts: 220,
  swimThresholdPaceSecPer100m: 120, // 2:00/100m
};
```

---

# 6. Priorité des données pour calculer l'intensité

L'intensité est appelée :

```txt
IF = Intensity Factor
```

La logique dépend du sport.

Ordre de priorité :

## Course / trail / marche / randonnée

1. allure ou GAP si disponible
2. fréquence cardiaque
3. RPE utilisateur
4. vitesse moyenne + barème par défaut

## Vélo / gravel / VTT / home trainer

1. puissance normalisée ou pondérée
2. puissance moyenne
3. fréquence cardiaque
4. RPE utilisateur
5. vitesse uniquement en dernier recours

## Natation

1. allure au 100 m vs allure seuil natation
2. fréquence cardiaque si disponible
3. RPE utilisateur
4. barème par défaut

## Renforcement / mobilité

1. RPE utilisateur
2. durée
3. volume musculation, si disponible
4. barème par défaut

---

# 7. Coefficients par sport

Implémentation : `SPORT_CONFIGS` dans `web/lib/analytics/effort-score.ts`.

```ts
export type SportConfig = {
  sportBase:             number
  sportFactor:           number
  defaultIF:             number
  minIF:                 number
  maxIF:                 number
  elevationSensitivity:  number        // appliqué par 100m de D+ (× 0.01)
  thresholdPaceSecPerKm: number | null // seuil défaut run/trail
  thresholdPower:        number | null // FTP défaut vélo
}
```

Valeurs actuelles :

| Sport          | sportBase | sportFactor | defaultIF | minIF | maxIF | elevSens | thresholdPace | thresholdPower |
|----------------|----------:|------------:|----------:|------:|------:|---------:|--------------:|---------------:|
| run            | 100       | 1.00        | 0.75      | 0.4   | 1.3   | 8        | 300           | —              |
| trail_run      | 100       | 1.15        | 0.75      | 0.4   | 1.3   | 12       | 330           | —              |
| walk           |  60       | 0.50        | 0.50      | 0.3   | 0.8   | 10       | —             | —              |
| hike           |  60       | 0.65        | 0.55      | 0.3   | 0.9   | 14       | —             | —              |
| road_ride      |  80       | 0.75        | 0.70      | 0.3   | 1.2   | 5        | —             | 220            |
| gravel_ride    |  80       | 0.85        | 0.70      | 0.3   | 1.2   | 7        | —             | 220            |
| mountain_bike  |  90       | 1.00        | 0.75      | 0.4   | 1.3   | 9        | —             | 220            |
| indoor_ride    |  80       | 0.70        | 0.70      | 0.3   | 1.2   | 0        | —             | 220            |
| swim           | 120       | 1.10        | 0.75      | 0.4   | 1.2   | 0        | —             | —              |
| strength       |  80       | 0.90        | 0.70      | 0.4   | 1.1   | 0        | —             | —              |
| mobility       |  40       | 0.40        | 0.50      | 0.2   | 0.7   | 0        | —             | —              |
| cardio_other   |  80       | 0.80        | 0.65      | 0.3   | 1.1   | 0        | —             | —              |
| other          |  70       | 0.70        | 0.60      | 0.3   | 1.0   | 0        | —             | —              |

Notes :
- `sportBase` n'est **pas** uniforme à 100 — il intègre déjà une part de la pénibilité intrinsèque du sport (natation 120, mobilité 40).
- `elevationSensitivity` s'applique par **100 m de distance** (cf. §10), pas par km.
- Pas (encore) de `descentSensitivity` / `defaultTerrainFactor` / `muscularSensitivity` séparés : la version actuelle simplifie la formule (cf. §15).

---

# 8. Calcul de l'intensité IF par sport

Implémentation actuelle dans `web/lib/analytics/effort-score.ts` → `calcIF()`. La fonction retourne `{ value, source, model }` où `model ∈ { 'power', 'pace_threshold', 'legacy' }`.

Ordre de priorité réel (cf. §0.2 pour le détail) :

1. **Vélo** (sport avec `thresholdPower` non null) : FTP utilisateur → FTP défaut (220 W) → `defaultIF`. Préfère `normalizedPowerWatts`, sinon `averageWatts`.
2. **Run** : allure seuil utilisateur (`threshold_pace_run_sec_per_km`) → 300 s/km par défaut → `defaultIF`.
3. **Trail** : allure seuil trail utilisateur (`threshold_pace_trail_sec_per_km`) → 330 s/km par défaut → `defaultIF`.
4. **Tous les autres sports** (walk, hike, swim, strength, mobility, cardio_other, other) : `defaultIF` du sport — pas encore de calcul HR/RPE/pace seuil natation.

Le résultat est ensuite clampé entre `cfg.minIF` et `cfg.maxIF`.

> Les fonctions `calculateRunIntensity`, `calculateBikeIntensity`, `calculateSwimIntensity`, `calculateHeartRateIntensity`, `calculateRpeIntensity` listées ci-dessous sont la **spec cible** ; l'implémentation actuelle est plus compacte (une seule fonction `calcIF`).

## 8.1 Fonction principale (spec cible)

```ts
export function calculateIntensityFactor(
  activity: ActivityInput,
  profile: AthleteProfile
): number {
  const sport = activity.sportCategory ?? normalizeSportType(activity.rawSportType, activity.name);
  const config = SPORT_EFFORT_CONFIG[sport];

  let rawIF: number | null = null;

  if (sport === 'run' || sport === 'trail_run') {
    rawIF = calculateRunIntensity(activity, profile, sport);
  } else if (sport === 'walk' || sport === 'hike') {
    rawIF = calculateWalkHikeIntensity(activity, profile, sport);
  } else if (
    sport === 'road_ride' ||
    sport === 'gravel_ride' ||
    sport === 'mountain_bike' ||
    sport === 'indoor_ride'
  ) {
    rawIF = calculateBikeIntensity(activity, profile);
  } else if (sport === 'swim') {
    rawIF = calculateSwimIntensity(activity, profile);
  } else if (sport === 'strength' || sport === 'mobility') {
    rawIF = calculateRpeIntensity(activity, config.defaultIF);
  } else {
    rawIF = calculateGenericIntensity(activity, profile, config.defaultIF);
  }

  return clamp(rawIF ?? config.defaultIF, config.minIF, config.maxIF);
}
```

## 8.2 Course route / trail

```ts
export function calculateRunIntensity(
  activity: ActivityInput,
  profile: AthleteProfile,
  sport: SportCategory
): number | null {
  const distanceKm = (activity.distanceMeters ?? 0) / 1000;
  if (distanceKm > 0.2 && activity.movingTimeSeconds > 0) {
    const avgPaceSecPerKm = activity.movingTimeSeconds / distanceKm;
    const threshold =
      sport === 'trail_run'
        ? profile.trailThresholdPaceSecPerKm ?? profile.thresholdPaceSecPerKm
        : profile.thresholdPaceSecPerKm;

    if (threshold && avgPaceSecPerKm > 0) {
      return threshold / avgPaceSecPerKm;
    }
  }

  return calculateHeartRateIntensity(activity, profile);
}
```

## 8.3 Marche / randonnée

Ne pas utiliser la même logique que la course. Une randonnée lente avec D+ peut être fatigante même si l'allure est faible.

```ts
export function calculateWalkHikeIntensity(
  activity: ActivityInput,
  profile: AthleteProfile,
  sport: SportCategory
): number | null {
  const hrIF = calculateHeartRateIntensity(activity, profile);
  if (hrIF !== null) return hrIF;

  const rpeIF = calculateRpeIntensity(activity, SPORT_EFFORT_CONFIG[sport].defaultIF);
  if (rpeIF !== null) return rpeIF;

  return SPORT_EFFORT_CONFIG[sport].defaultIF;
}
```

## 8.4 Vélo route / gravel / VTT / home trainer

```ts
export function calculateBikeIntensity(activity: ActivityInput, profile: AthleteProfile): number | null {
  const ftp = profile.ftpWatts;
  const power = activity.normalizedPowerWatts ?? activity.weightedAverageWatts ?? activity.averageWatts;

  if (ftp && ftp > 0 && power && power > 0) {
    return power / ftp;
  }

  return calculateHeartRateIntensity(activity, profile);
}
```

## 8.5 Natation

```ts
export function calculateSwimIntensity(activity: ActivityInput, profile: AthleteProfile): number | null {
  const distanceMeters = activity.distanceMeters ?? 0;

  if (distanceMeters > 50 && activity.movingTimeSeconds > 0 && profile.swimThresholdPaceSecPer100m) {
    const avgPaceSecPer100m = activity.movingTimeSeconds / (distanceMeters / 100);
    return profile.swimThresholdPaceSecPer100m / avgPaceSecPer100m;
  }

  return calculateHeartRateIntensity(activity, profile);
}
```

## 8.6 Cardio fallback

```ts
export function calculateHeartRateIntensity(
  activity: ActivityInput,
  profile: AthleteProfile
): number | null {
  if (!activity.averageHeartrate || !profile.restingHeartRate || !profile.maxHeartRate) return null;

  const hrRelative =
    (activity.averageHeartrate - profile.restingHeartRate) /
    (profile.maxHeartRate - profile.restingHeartRate);

  return clamp(hrRelative / 0.85, 0.30, 1.25);
}
```

## 8.7 RPE fallback

RPE = perception d'effort de 1 à 10.

```ts
export function calculateRpeIntensity(activity: ActivityInput, defaultIF: number): number | null {
  if (!activity.perceivedEffort) return null;

  const rpe = clamp(activity.perceivedEffort, 1, 10);

  // RPE 1 = 0.30, RPE 10 = 1.10 environ
  return 0.22 + rpe * 0.088;
}
```

---

# 9. Coefficient cardio

> Statut : **non implémenté** dans la version v2.0 actuelle. Section conservée comme spec cible.

Le cardio corrige une activité dont l'allure, la puissance ou le sport semblent faciles, mais où le corps travaille fort.

```txt
HR_relative = (averageHeartrate - restingHeartRate) / (maxHeartRate - restingHeartRate)
K_cardio = 1 + 0.35 × max(0, HR_relative - IF)
```

Bornage :

```txt
K_cardio = clamp(K_cardio, 0.95, 1.20)
```

Si pas de cardio :

```txt
K_cardio = 1.00
```

Code :

```ts
export function calculateCardioFactor(
  activity: ActivityInput,
  profile: AthleteProfile,
  intensityFactor: number
): number {
  if (!activity.averageHeartrate || !profile.restingHeartRate || !profile.maxHeartRate) return 1.0;

  const hrRelative =
    (activity.averageHeartrate - profile.restingHeartRate) /
    (profile.maxHeartRate - profile.restingHeartRate);

  return clamp(1 + 0.35 * Math.max(0, hrRelative - intensityFactor), 0.95, 1.20);
}
```

---

# 10. Coefficient dénivelé multi-sports

Le dénivelé ne doit pas impacter tous les sports de la même manière.

Implémentation actuelle (`calcElevationFactor` dans `effort-score.ts`) :

```ts
function calcElevationFactor(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.elevationSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return 1.0
  const gain    = a.elevationGainMeters ?? 0
  const per100m = (gain / a.distanceMeters) * 100      // mètres D+ par 100m parcourus
  return 1.0 + per100m * cfg.elevationSensitivity * 0.01
}
```

Formule équivalente :

```txt
ElevationFactor = 1 + (D+_par_100m) × elevationSensitivity × 0.01
```

Pour home trainer, natation, musculation, mobilité (`elevationSensitivity = 0`) :

```txt
ElevationFactor = 1.00
```

**Note :** pas de cap à 0.35 dans le code actuel — le facteur peut donc dépasser 1.35 sur une sortie très pentue (ex. trail à 100m D+/km ⇒ +12 % seulement, mais 500 m D+/km ⇒ +60 %). À border si nécessaire.

---

# 11. Coefficient terrain multi-sports

> Statut : **non implémenté** dans la v2.0 actuelle. Spec cible :

```ts
export function getTerrainFactor(activity: ActivityInput, sport: SportCategory): number {
  const name = (activity.name || '').toLowerCase();
  const base = SPORT_EFFORT_CONFIG[sport].defaultTerrainFactor;

  if (sport === 'trail_run') {
    if (name.includes('technique') || name.includes('montagne')) return 1.15;
    if (name.includes('boue') || name.includes('neige')) return 1.15;
    return base;
  }

  if (sport === 'gravel_ride') return 1.04;
  if (sport === 'mountain_bike') return 1.10;
  if (sport === 'hike') return 1.08;
  if (sport === 'walk') return name.includes('rando') ? 1.05 : 1.00;

  return base;
}
```

---

# 12. Coefficient musculaire

> Statut actuel : `muscleLoad = finalScore × 0.6` (constante `MUSCLE_LOAD_RATIO` dans `effort-score.ts`). La formule riche ci-dessous reste la spec cible.

Le score CES mesure la charge globale. Le modèle doit aussi calculer une charge musculaire séparée, utile pour le trail, la randonnée, le VTT et la musculation.

```txt
K_descent = 1 + min(0.25, (elevationLossMeters / distanceKm / 1000) × descentSensitivity)
K_muscular = 1 + ((K_elevation - 1) + (K_descent - 1)) × muscularSensitivity
```

Pour musculation :

```txt
K_muscular_strength = 1 + min(0.35, RPE / 10 × 0.35)
```

Pour mobilité :

```txt
K_muscular = 1.00
```

Code :

```ts
export function calculateMuscularFactor(
  activity: ActivityInput,
  sport: SportCategory,
  elevationFactor: number
): number {
  const config = SPORT_EFFORT_CONFIG[sport];

  if (sport === 'mobility' || sport === 'swim' || sport === 'indoor_ride') return 1.0;

  if (sport === 'strength') {
    const rpe = activity.perceivedEffort ? clamp(activity.perceivedEffort, 1, 10) : 6;
    const volumeBonus = activity.totalLoadKg ? Math.min(0.15, activity.totalLoadKg / 20000) : 0;
    return clamp(1 + (rpe / 10) * 0.35 + volumeBonus, 1.0, 1.45);
  }

  const distanceKm = Math.max((activity.distanceMeters ?? 0) / 1000, 0.1);
  const elevationLoss = activity.elevationLossMeters ?? 0;

  const descentFactor =
    1 + Math.min(0.25, (elevationLoss / distanceKm / 1000) * config.descentSensitivity);

  const muscularFactor =
    1 + ((elevationFactor - 1) + (descentFactor - 1)) * config.muscularSensitivity;

  return clamp(muscularFactor, 1.0, 1.45);
}
```

---

# 13. Coefficient fatigue préalable

> Statut : **non implémenté** dans la v2.0. Spec cible :

Si l'utilisateur est déjà en surcharge, une même séance coûte légèrement plus cher.

```txt
K_fatigue = 1 + max(0, LoadRatio - 1) × 0.10
```

Bornage :

```txt
K_fatigue = clamp(K_fatigue, 1.00, 1.08)
```

Si pas d'historique :

```txt
K_fatigue = 1.00
```

---

# 14. Coefficient RPE

> Statut : **non implémenté** (RPE/`perceivedEffort` est typé en entrée mais pas encore utilisé dans le calcul). Spec cible :

Si l'utilisateur renseigne son ressenti après séance, on ajuste légèrement le score.

```txt
K_rpe = 1 + ((RPE - expectedRPE) / 10) × 0.20
```

Avec :

```txt
expectedRPE = IF × 10
```

Bornage :

```txt
K_rpe = clamp(K_rpe, 0.90, 1.15)
```

Si pas de RPE :

```txt
K_rpe = 1.00
```

Code :

```ts
export function calculateRpeFactor(activity: ActivityInput, intensityFactor: number): number {
  if (!activity.perceivedEffort) return 1.0;

  const rpe = clamp(activity.perceivedEffort, 1, 10);
  const expectedRpe = clamp(intensityFactor * 10, 1, 10);

  return clamp(1 + ((rpe - expectedRpe) / 10) * 0.20, 0.90, 1.15);
}
```

---

# 15. Calcul officiel du CES multi-sports (v2.0 actuelle)

Implémenté dans `web/lib/analytics/effort-score.ts` (`computeCesResult`) :

```ts
export function computeCesResult(a: ActivityInput, profile: UserProfileForCes = {}): CesResult {
  const durationHours = Math.max(a.movingTimeSeconds / 3600, 0.01)
  const sport         = normalizeSportType(a.rawSportType, a.name)
  const cfg           = SPORT_CONFIGS[sport]
  const ifResult      = calcIF(a, cfg, sport, profile)        // {value, source, model}
  const elevFactor    = calcElevationFactor(a, cfg)
  const baseScore     = durationHours * cfg.sportBase * (ifResult.value ** 2)
  const finalScore    = baseScore * cfg.sportFactor * elevFactor
  const ces           = Math.round(finalScore)

  const { confidence, warnings } = buildConfidenceAndWarnings(sport, ifResult, a, profile)

  return {
    ces,
    cardioLoad:      Math.round(baseScore * cfg.sportFactor),   // sans elevationFactor
    muscleLoad:      Math.round(finalScore * 0.6),              // MUSCLE_LOAD_RATIO
    label:           effortLabel(ces),
    intensityFactor: Math.round(ifResult.value * 100) / 100,
    model:           ifResult.model,
    confidence,
    components: { durationHours, intensityFactor: ifResult.value,
                  thresholdSource: ifResult.source,
                  elevationFactor: elevFactor, sportFactor: cfg.sportFactor },
    warnings,
    version: 'v2.0',
  }
}
```

Type résultat (cf. `web/lib/analytics/types.ts`) :

```ts
export type CesResult = {
  ces:             number
  cardioLoad:      number
  muscleLoad:      number
  label:           EffortLabel
  intensityFactor: number
  model:           'power' | 'pace_threshold' | 'pace_effort_distance' | 'hr_proxy' | 'legacy'
  confidence:      'high' | 'medium' | 'low'
  components: {
    durationHours:   number
    intensityFactor: number
    thresholdSource: string
    elevationFactor: number
    sportFactor:     number
  }
  warnings: string[]
  version:  string
}
```

**Différences vs spec long terme** : pas de `cardioFactor / terrainFactor / muscularFactor / fatigueFactor / rpeFactor` à date — `muscleLoad` est simplement `finalScore × 0.6`, `cardioLoad = baseScore × sportFactor`.

---

# 16. Charge quotidienne

```txt
Daily_Load(date) = somme des CES de toutes les activités du jour
```

Pour les **jours sans activités sportives** (jours de repos) :

```txt
Daily_Load(rest_day) = 0
```

Les jours de repos (CES = 0) représentent la récupération physiologique et doivent être inclus dans les graphiques 30 jours, car ils contribuent à la fraîcheur générale et affectent les courbes d'EWMA.

Ajouter une séparation par type de charge :

```txt
Daily_Cardio_Load = somme cardioLoad
Daily_Muscle_Load = somme muscleLoad
```

```ts
export type DailyTrainingLoad = {
  date: string;
  dailyLoad: number;
  dailyCardioLoad: number;
  dailyMuscleLoad: number;
  activityCount: number;
  sportBreakdown: Partial<Record<SportCategory, number>>;
};
```

---

# 17. Charge hebdomadaire

```txt
Weekly_Load(week) = somme des Daily_Load de la semaine ISO
```

```ts
export type WeeklyTrainingLoad = {
  weekStartDate: string;
  weekEndDate: string;
  weeklyLoad: number;
  weeklyCardioLoad: number;
  weeklyMuscleLoad: number;
  activityCount: number;
  sportBreakdown: Partial<Record<SportCategory, number>>;
};
```

---

# 18. Fatigue récente — EWMA 7 jours (ATL)

Implémentation actuelle : **EWMA** (Exponentially Weighted Moving Average) avec période 7 jours, et non une moyenne pondérée à poids fixes.

```txt
alpha_ATL = 1 - exp(-1/7)         ≈ 0.1331
ATL_t = ATL_{t-1} + alpha_ATL × (Daily_Load_t - ATL_{t-1})
```

`ATL` (Acute Training Load) joue le rôle de **fatigue récente**.

Code (`web/lib/analytics/fatigue.ts`, `buildDailyMetrics`) :

```ts
export function buildDailyMetrics(loads: DailyLoad[]): DailyMetrics[] {
  const filled   = fillConsecutiveDays(loads)        // jours manquants → ces = 0
  if (filled.length === 0) return []
  const alphaAtl = 1 - Math.exp(-1 / 7)
  const alphaCtl = 1 - Math.exp(-1 / 42)
  let atl = filled[0].ces
  let ctl = filled[0].ces
  return filled.map((d, i) => {
    if (i > 0) {
      atl = atl + alphaAtl * (d.ces - atl)
      ctl = ctl + alphaCtl * (d.ces - ctl)
    }
    return { date: d.date, dailyLoad: d.ces,
             atl: Math.round(atl * 10) / 10,
             ctl: Math.round(ctl * 10) / 10,
             tsb: Math.round((ctl - atl) * 10) / 10 }
  })
}
```

**Invariant critique** : `fillConsecutiveDays` remplit chaque jour manquant à `ces = 0` avant d'appliquer l'EWMA. Sauter les jours zéro corromprait les courbes.

> Note : les versions cardio/musculaire séparées (`Fatigue_7j_Cardio_TotalEquivalent`, `Fatigue_7j_Muscle_TotalEquivalent`) ne sont pas implémentées à ce jour — seul `atl` global existe.

---

# 19. Capacité d'entraînement — EWMA 42 jours (CTL)

Implémentation actuelle : **EWMA** sur 42 jours, calculée dans la même passe que l'ATL (cf. §18).

```txt
alpha_CTL = 1 - exp(-1/42)        ≈ 0.0235
CTL_t = CTL_{t-1} + alpha_CTL × (Daily_Load_t - CTL_{t-1})
```

`CTL` (Chronic Training Load) joue le rôle de **capacité / fitness**.

`TSB` (Training Stress Balance = freshness) :

```txt
TSB_t = CTL_t - ATL_t
```

> Note : versions cardio/musculaire séparées non implémentées à ce jour.

---

# 20. Indice de surcharge

Implémentation actuelle (`computeLoadBalanceRatio` dans `charge-insights.ts`) — **deux ratios** sont exposés :

```txt
ewmaRatio      = ATL / CTL                  (jamais 0/0 : 0 si CTL = 0)
sumRatio7vs28  = sum(Daily_Load_7j) / (sum(Daily_Load_28j) / 4)
```

`sumRatio7vs28` mesure la charge des 7 derniers jours par rapport à la moyenne hebdo des 4 dernières semaines (`avg7Week = sum28 / 4`). C'est ce ratio qui pilote la majorité des statuts.

Seuils actuels (`web/lib/analytics/charge-thresholds.ts`) :

```ts
export const LOAD_BALANCE = {
  low:      0.75,
  balanced: 1.25,
  high:     1.5,
} as const
```

Statuts dérivés (cf. `pickStatus` dans `charge-insights.ts`) :

| Condition | Status |
|---|---|
| `historyDays < 14` | `insufficient` |
| `tsb ≤ -25` (FRESHNESS.highFatigue) | `overloaded` |
| `sumRatio7vs28 > 1.5` | `peak` |
| `tsb ≤ -10` (FRESHNESS.normalFatigue) | `loaded` |
| `tsb ≥ 15` & `ctl < 30` | `under-trained` |
| `tsb ≥ 15` | `very-fresh` |
| `0 < sumRatio7vs28 < 0.75` | `light` |
| `1.25 ≤ sumRatio7vs28 ≤ 1.5` | `progressing` |
| sinon | `balanced` |

> Note : la spec long terme (CardioLoadRatio / MuscleLoadRatio séparés) n'est pas implémentée.

---

# 21. Fraîcheur

Implémentation : `computeFreshness` retourne `{ tsb, deltaVsWeekAgo, zone }` où `tsb = ctl - atl` et `deltaVsWeekAgo = tsb_today - tsb_J-7`.

Zones (`charge-thresholds.ts` → `FRESHNESS`) :

```ts
export const FRESHNESS = {
  veryFresh:     15,
  fresh:         5,
  normalFatigue: -10,
  highFatigue:   -25,
} as const
```

| TSB | Zone |
|---:|---|
| ≥ +15 | `very-fresh` |
| +5 à +15 | `fresh` |
| -10 à +5 | `balanced` |
| -25 à -10 | `normal-fatigue` |
| < -25 | `high-fatigue` |

> Note : `CardioFreshness` / `MuscleFreshness` séparés ne sont pas implémentés.

---

# 21bis. Autres indicateurs implémentés (Charge Insights)

`web/lib/analytics/charge-insights.ts` calcule plusieurs indicateurs additionnels exposés par la page Charge :

- **Monotony 7j** = `mean / std` des `Daily_Load` sur 7 jours (cap à `MONOTONY.repetitiveMin = 2.0` quand `std = 0`).
- **Strain 7j** = `sum(Daily_Load_7j) × Monotony` ; seuil d'alerte `STRAIN.high = 6000`.
- **Active days 7j** = nombre de jours avec `ces > 0`.
- **Peak day 7j** = jour de charge max sur 7 jours.
- **Ramp Rate** = `(weekN - weekN-1) / weekN-1`, classé via :
  ```ts
  RAMP_RATE = { fastRise: 0.30, controlledRise: 0.10, decline: -0.30 }
  ```
  Labels : `progressive-resume`, `fast-rise`, `controlled-rise`, `stable`, `declining`, `sharp-decline`.
- **Sport distribution** & **Intensity distribution** sur fenêtres glissantes (7/28 jours par défaut).
- **Ultra-Ready score** (`ultra-ready.ts`) : 40 % freshness + 40 % fitness + 20 % load balance, label `not_ready → peak`.

Fenêtres de référence (`WINDOWS`) : `short=7`, `medium=28`, `long=70`.

---

# 22. Statut quotidien TrainingStatus

> Statut : **spec cible**. À date, l'app expose `DailyMetrics[]` + `InsightsResult { status, headline, notes }` (cf. §21bis) plutôt qu'un objet TrainingStatus consolidé. Les sous-mesures cardio/musculaire séparées ne sont pas calculées.

```ts
export type TrainingStatus = {
  date: string;

  dailyLoad: number;
  dailyCardioLoad: number;
  dailyMuscleLoad: number;

  weeklyLoad: number;
  weeklyCardioLoad: number;
  weeklyMuscleLoad: number;

  fatigue7d: number;
  fatigue7dTotalEquivalent: number;
  fatigue7dCardioTotalEquivalent: number;
  fatigue7dMuscleTotalEquivalent: number;

  fitness42d: number;
  fitness42dWeeklyEquivalent: number;
  fitness42dCardioWeeklyEquivalent: number;
  fitness42dMuscleWeeklyEquivalent: number;

  loadRatio: number | null;
  cardioLoadRatio: number | null;
  muscleLoadRatio: number | null;

  freshness: number | null;
  cardioFreshness: number | null;
  muscleFreshness: number | null;

  status:
    | 'insufficient_data'
    | 'underload'
    | 'light'
    | 'balanced'
    | 'productive'
    | 'high_fatigue'
    | 'overload';

  recommendationLevel:
    | 'normal'
    | 'reduce_volume'
    | 'easy_only'
    | 'rest';
};
```

---

# 23. Recommandations multi-sports

> Statut : **spec cible**. À date, l'engine de recommandation produit `InsightsResult { status, headline, notes }` (cf. `computeLoadInsights` dans `charge-insights.ts`) basé sur les statuts §20. Les règles fines par sport prévu (croisement avec `plannedWorkout`) restent à implémenter.

La recommandation doit croiser :

- séance prévue dans le plan
- sport de la séance prévue
- statut de charge global
- fatigue cardio
- fatigue musculaire
- dernière séance intense
- charge musculaire récente trail/rando/VTT/musculation

## Règles générales

```ts
export function recommendNextSession(
  status: TrainingStatus,
  plannedWorkout?: PlannedWorkout,
  recentActivities?: EffortScoreResult[]
): WorkoutRecommendation {
  if (status.status === 'insufficient_data') {
    return {
      decision: 'follow_plan_carefully',
      message: 'Données encore insuffisantes. Suis le plan mais reste à l’écoute des sensations.',
    };
  }

  if (status.loadRatio !== null && status.loadRatio > 1.50) {
    return {
      decision: 'rest_or_recovery',
      message: 'Surcharge détectée. Repos ou récupération active conseillé.',
      suggestedWorkout: 'Repos, mobilité ou 30 à 40 min très facile.',
    };
  }

  if (status.muscleLoadRatio !== null && status.muscleLoadRatio > 1.50) {
    return {
      decision: 'avoid_muscular_intensity',
      message: 'Fatigue musculaire élevée. Évite côtes, trail technique, VTT engagé et musculation lourde.',
      suggestedWorkout: 'Vélo souple, natation facile, marche douce ou repos.',
    };
  }

  if (status.cardioLoadRatio !== null && status.cardioLoadRatio > 1.50) {
    return {
      decision: 'avoid_cardio_intensity',
      message: 'Fatigue cardio élevée. Évite VMA, seuil, fractionné vélo et séances intenses.',
      suggestedWorkout: 'Endurance fondamentale courte ou repos.',
    };
  }

  if (status.loadRatio !== null && status.loadRatio > 1.35) {
    return {
      decision: 'replace_by_easy',
      message: 'Fatigue élevée. Remplace la séance intense par une séance facile.',
      suggestedWorkout: '45 min très facile, mobilité ou récupération active.',
    };
  }

  if (status.loadRatio !== null && status.loadRatio > 1.20) {
    return {
      decision: 'reduce_volume',
      message: 'Charge productive mais fatigue en hausse. Réduis le volume de 10 à 20 %.',
      suggestedWorkout: reduceWorkoutVolume(plannedWorkout, 0.15),
    };
  }

  if (status.loadRatio !== null && status.loadRatio < 0.90) {
    return {
      decision: 'ok_to_build',
      message: 'Tu es frais. Séance prévue validée, possibilité de construire progressivement.',
    };
  }

  return {
    decision: 'follow_plan',
    message: 'Charge équilibrée. Tu peux suivre le plan normalement.',
  };
}
```

## Règles selon sport prévu

### Si séance prévue = course intensive / VMA / seuil

Refuser ou remplacer si :

```txt
LoadRatio > 1.35
ou CardioLoadRatio > 1.35
ou MuscleLoadRatio > 1.50
ou grosse charge musculaire dans les dernières 48 h
```

Recommandation :

```txt
Endurance fondamentale 40–50 min ou vélo souple.
```

### Si séance prévue = trail / côtes

Refuser ou remplacer si :

```txt
MuscleLoadRatio > 1.35
ou Trail/TrailRun/Hike/MountainBike très chargé dans les dernières 48 h
```

Recommandation :

```txt
Footing plat, vélo facile, natation ou repos.
```

### Si séance prévue = vélo

Le vélo peut être recommandé comme récupération si fatigue musculaire course élevée mais fatigue cardio correcte.

```txt
Si MuscleLoadRatio élevé et CardioLoadRatio normal : vélo zone 1/2 possible.
```

### Si séance prévue = musculation

Éviter si :

```txt
MuscleLoadRatio > 1.35
ou grosse sortie trail/rando/VTT récente
```

Recommandation :

```txt
Mobilité, gainage léger ou repos.
```

### Si séance prévue = natation

Natation facile possible dans la plupart des cas, sauf surcharge globale.

```txt
Si LoadRatio < 1.50 : natation facile autorisée.
Si LoadRatio > 1.50 : repos ou mobilité douce.
```

---

# 24. Graphiques à créer dans l'app

## Graphique 1 — Charge semaine globale

- weeklyLoad
- zone cible basse
- zone cible haute
- statut

## Graphique 2 — Fatigue vs capacité

Courbes :

- Fatigue récente 7j pondérée, équivalent hebdo
- Capacité 42j, équivalent hebdo

## Graphique 3 — Fraîcheur

Barres :

- freshness
- cardioFreshness
- muscleFreshness

## Graphique 4 — Répartition par sport

Sur 4 ou 8 semaines :

- course
- trail
- vélo
- rando/marche
- natation
- musculation
- autre

## Graphique 5 — Répartition intensité

Sur 4 semaines :

- récupération
- endurance
- soutenu
- intense
- très dur
- extrême

## Graphique 6 — Charge musculaire

Courbe :

- dailyMuscleLoad
- fatigue7dMuscleTotalEquivalent
- muscleLoadRatio

---

# 25. UI recommandée

## Carte activité multi-sports

```txt
Trail — 12,4 km — 1h18 — D+ 420 m

Effort : 96 — Intense
Charge cardio : élevée
Charge musculaire : très élevée
Impact récupération : 36 h

Analyse :
Belle séance trail. L’intensité cardio reste maîtrisée, mais le dénivelé augmente fortement la charge musculaire.
```

```txt
Vélo route — 52 km — 1h55 — 186 W NP

Effort : 118 — Intense
Charge cardio : élevée
Charge musculaire : modérée

Analyse :
Séance exigeante surtout cardio. La charge musculaire reste inférieure à une sortie trail équivalente.
```

```txt
Natation — 1 800 m — 42 min

Effort : 48 — Endurance
Charge cardio : modérée
Charge musculaire : faible

Analyse :
Bonne séance d’entretien, utile pour récupérer sans ajouter beaucoup de fatigue musculaire.
```

## Carte semaine

```txt
Charge semaine : 412 pts
Objectif conseillé : 380–460 pts
État : Productif
Fatigue cardio : Modérée
Fatigue musculaire : Élevée
Fraîcheur : Correcte
```

## Carte recommandation

```txt
Prochaine séance recommandée :
45 min endurance fondamentale + 6 lignes droites.

Pourquoi :
Ta charge globale est correcte, mais ta fatigue musculaire reste élevée après ta dernière sortie trail.
```

---

# 26. Base de données suggérée

## Table `activity_effort_scores`

```sql
create table activity_effort_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_id text not null,
  activity_date date not null,
  sport_category text not null,

  ces integer not null,
  base_score integer,
  cardio_load integer,
  muscle_load integer,
  effort_label text not null,

  duration_hours numeric,
  intensity_factor numeric,
  sport_factor numeric,
  elevation_factor numeric,
  cardio_factor numeric,
  terrain_factor numeric,
  muscular_factor numeric,
  fatigue_factor numeric,
  rpe_factor numeric,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  unique(user_id, activity_id)
);
```

## Table `daily_training_loads`

```sql
create table daily_training_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,

  daily_load integer not null,
  daily_cardio_load integer not null default 0,
  daily_muscle_load integer not null default 0,
  activity_count integer not null default 0,
  sport_breakdown jsonb,

  fatigue_7d integer,
  fatigue_7d_total_equivalent integer,
  fatigue_7d_cardio_total_equivalent integer,
  fatigue_7d_muscle_total_equivalent integer,

  fitness_42d integer,
  fitness_42d_weekly_equivalent integer,
  fitness_42d_cardio_weekly_equivalent integer,
  fitness_42d_muscle_weekly_equivalent integer,

  load_ratio numeric,
  cardio_load_ratio numeric,
  muscle_load_ratio numeric,

  freshness integer,
  cardio_freshness integer,
  muscle_freshness integer,

  status text,
  recommendation_level text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  unique(user_id, date)
);
```

---

# 27. Pipeline de calcul

Après chaque synchronisation d'activité :

1. Récupérer les nouvelles activités
2. Normaliser le sport dans `sportCategory`
3. Calculer ou recalculer le CES multi-sports de chaque activité
4. Sauvegarder dans `activity_effort_scores`
5. Recalculer les charges quotidiennes sur la période impactée
6. Recalculer Fatigue_7j pondérée globale, cardio et musculaire
7. Recalculer Fitness_42j globale, cardio et musculaire
8. Recalculer LoadRatio, CardioLoadRatio, MuscleLoadRatio
9. Recalculer Freshness, CardioFreshness, MuscleFreshness
10. Générer recommandation
11. Mettre à jour les cartes et graphiques

Période à recalculer après nouvelle activité :

```txt
activityDate - 1 jour jusqu'à aujourd'hui
```

Pour sécurité :

```txt
recalculer les 60 derniers jours
```

---

# 28. Tests unitaires recommandés

Créer :

```txt
src/domain/training/effortScore.test.ts
src/domain/training/trainingLoad.test.ts
src/domain/training/sportConfig.test.ts
```

Cas à tester :

1. Sortie EF 45 min route
2. Séance VMA courte intense
3. Sortie longue 2h route
4. Trail 1h30 avec D+ 600 m
5. Vélo route avec puissance
6. Vélo sans puissance mais avec cardio
7. Gravel avec D+
8. VTT technique avec D+ et D-
9. Natation 1 500 m
10. Randonnée 3h avec D+
11. Musculation RPE 8
12. Mobilité 30 min
13. Activité sans cardio
14. Activité sans distance
15. Fatigue_7j pondérée avec plusieurs jours chargés
16. LoadRatio > 1.50 donne surcharge
17. MuscleLoadRatio > 1.50 bloque trail/VMA/musculation lourde
18. LoadRatio 0.90–1.20 donne équilibré

---

# 29. Exemples de calcul

## Exemple 1 — Trail

```txt
Trail 12 km
Durée 1h20
D+ 420 m
D- 420 m
FC moy 150
FC repos 55
FC max 185
Allure seuil trail 5:30/km
```

Résultat attendu :

```txt
Effort : 90–105 — Intense
Charge musculaire : élevée
```

## Exemple 2 — Vélo route avec puissance

```txt
Vélo 52 km
Durée 1h55
NP 186 W
FTP 250 W
D+ 450 m
```

Calcul simplifié :

```txt
IF = 186 / 250 = 0.74
BaseScore = 1.92 × 100 × 0.74² = 105
SportFactor vélo = 0.82
CES ≈ 86–100 selon D+ et cardio
```

Résultat UI :

```txt
Effort : 94 — Intense
Charge cardio : élevée
Charge musculaire : modérée
```

## Exemple 3 — Natation

```txt
Natation 1 800 m
Durée 42 min
Allure seuil natation 2:00/100m
Allure moyenne 2:20/100m
```

```txt
IF = 120 / 140 = 0.86
BaseScore = 0.70 × 100 × 0.86² = 52
SportFactor natation = 0.95
CES ≈ 49
```

Résultat UI :

```txt
Effort : 49 — Endurance
Charge musculaire : faible
```

## Exemple 4 — Randonnée

```txt
Randonnée 3h00
Distance 10 km
D+ 650 m
Pas de cardio
```

Résultat attendu :

```txt
Effort : 80–110 selon D+
Charge cardio : modérée
Charge musculaire : élevée
```

## Exemple 5 — Musculation

```txt
Musculation 45 min
RPE 8/10
```

Résultat attendu :

```txt
Effort : 35–55
Charge cardio : faible
Charge musculaire : élevée
```

---

# 30. Priorité d'implémentation

## Phase 1 — obligatoire

- normalisation des sports
- config multi-sports
- CES multi-sports par activité
- labels utilisateur
- charge jour globale, cardio et musculaire
- charge semaine globale, cardio et musculaire
- Fatigue_7j pondérée globale, cardio et musculaire
- Fitness_42j globale, cardio et musculaire
- LoadRatio, CardioLoadRatio, MuscleLoadRatio
- Freshness globale, cardio et musculaire
- carte recommandation simple

## Phase 2

- charge musculaire trail/rando/VTT avancée
- détection terrain automatique par titre
- graphiques dédiés multi-sports
- comparaison charge prévue vs charge réalisée

## Phase 3

- intégration sommeil / HRV Garmin
- RPE utilisateur après séance
- ajustement automatique des coefficients
- prédiction de risque surcharge/blessure
- personnalisation automatique par historique utilisateur

---

# 31. Règles importantes

- Ne pas limiter le modèle à la course à pied.
- Toujours normaliser le sport avant calcul.
- Ne pas utiliser l'allure course pour vélo, natation, marche, randonnée ou musculation.
- Ne pas pénaliser fortement la natation en charge musculaire.
- Le vélo facile peut servir de récupération si la fatigue musculaire course/trail est élevée.
- La musculation doit alimenter surtout la charge musculaire.
- La randonnée peut avoir une charge musculaire élevée même avec une intensité cardio modérée.
- Ne pas afficher ATL / CTL / TSB en priorité.
- Garder ces valeurs en backend si elles existent déjà.
- Afficher en priorité les noms Cockpit :
  - Effort activité
  - Fatigue récente
  - Capacité d'entraînement
  - Fraîcheur
  - Indice de surcharge
  - Fatigue cardio
  - Fatigue musculaire
- Toujours expliquer la recommandation avec une phrase simple.
- Ne jamais recommander une séance intense si LoadRatio > 1.35.
- Ne jamais recommander une séance intense cardio si CardioLoadRatio > 1.35.
- Ne jamais recommander trail, côtes ou musculation lourde si MuscleLoadRatio > 1.35.
- Si données insuffisantes, afficher une recommandation prudente.

---

# 32. Résultat attendu pour l'utilisateur

L'utilisateur doit comprendre immédiatement :

```txt
Est-ce que ma séance était facile ou dure ?
Quel type de fatigue ai-je créé : cardio ou musculaire ?
Est-ce que ma semaine est trop chargée ?
Est-ce que je suis frais ou fatigué ?
Est-ce que je peux faire la prochaine séance prévue ?
Dois-je réduire, remplacer ou récupérer ?
Quel sport peut m'aider à récupérer sans aggraver la fatigue ?
```

Ce modèle devient le cœur intelligent multi-sports de Cockpit Trail.
