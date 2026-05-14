# BLUEPRINT — Cockpit Trail : Modèle Effort, Charge, Fatigue et Recommandations

## Objectif

Intégrer dans l'application **Cockpit Trail** un modèle mathématique lisible pour l'utilisateur, capable de remplacer ou compléter les indicateurs techniques ATL / CTL / TSB par des indicateurs plus compréhensibles :

- Effort activité
- Charge jour
- Charge semaine
- Fatigue récente
- Capacité d'entraînement
- Fraîcheur
- Indice de surcharge
- Charge musculaire trail
- Recommandation de prochaine séance

Le modèle doit fonctionner à partir des activités synchronisées depuis Strava, Garmin ou une autre source équivalente.

---

## 1. Principes généraux

Chaque activité reçoit un score unique : **CES — Cockpit Effort Score**.

Ce score représente le niveau d'effort global de l'activité en tenant compte :

- de la durée
- de l'intensité
- de la fréquence cardiaque
- du dénivelé
- du terrain
- de la fatigue déjà accumulée
- de la charge musculaire spécifique au trail

Le score doit rester lisible :

| CES activité | Label utilisateur | Signification |
|---:|---|---|
| 0–30 | Récupération | Très facile |
| 31–60 | Endurance | Sortie facile utile |
| 61–90 | Soutenu | Bon stimulus d'entraînement |
| 91–130 | Intense | Séance exigeante |
| 131–180 | Très dur | Grosse charge |
| 180+ | Extrême | Course, trail long ou surcharge |

---

## 2. Variables nécessaires par activité

### Variables obligatoires V1

```ts
type ActivityInput = {
  id: string;
  source: 'strava' | 'garmin' | 'manual' | 'other';
  sportType: 'run' | 'trail_run' | 'ride' | 'gravel_ride' | 'walk' | 'hike' | 'other';
  name?: string;
  startDate: string; // ISO date
  distanceMeters: number;
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
  calories?: number;
  sufferScore?: number;
  perceivedEffort?: number; // optionnel, 1 à 10
};
```

### Variables profil utilisateur

```ts
type AthleteProfile = {
  userId: string;
  restingHeartRate?: number;
  maxHeartRate?: number;
  thresholdHeartRate?: number;
  thresholdPaceSecPerKm?: number; // course
  ftpWatts?: number; // vélo
  weightKg?: number;
};
```

Valeurs par défaut si profil incomplet :

```ts
const DEFAULT_PROFILE = {
  restingHeartRate: 55,
  maxHeartRate: 185,
  thresholdHeartRate: 165,
  thresholdPaceSecPerKm: 300, // 5:00/km
  ftpWatts: 220,
};
```

---

## 3. Score activité — CES

### Formule officielle

```txt
CES = DurationHours × 100 × IF² × K_elevation × K_cardio × K_terrain × K_fatigue
```

Avec :

```txt
DurationHours = movingTimeSeconds / 3600
```

---

## 4. Calcul de l'intensité IF

### 4.1 Course à pied / trail

Si on dispose d'une allure seuil utilisateur :

```txt
averagePaceSecPerKm = movingTimeSeconds / (distanceMeters / 1000)
IF_pace = thresholdPaceSecPerKm / averagePaceSecPerKm
```

Bornage recommandé :

```txt
IF = clamp(IF_pace, 0.45, 1.25)
```

### 4.2 Vélo

Si puissance disponible :

```txt
IF_power = normalizedPower / FTP
```

Fallback si seulement puissance moyenne :

```txt
IF_power = averageWatts / FTP
```

Bornage :

```txt
IF = clamp(IF_power, 0.40, 1.30)
```

### 4.3 Fallback cardio

Si pas d'allure exploitable ou pas de puissance :

```txt
HR_relative = (averageHeartrate - restingHeartRate) / (maxHeartRate - restingHeartRate)
```

Puis :

```txt
IF_hr = clamp(HR_relative / 0.85, 0.40, 1.20)
```

---

## 5. Coefficient cardio

Le cardio corrige une activité où l'allure semble facile mais où le corps travaille fort.

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

---

## 6. Coefficient dénivelé

```txt
distanceKm = distanceMeters / 1000
verticalGainPerKm = elevationGainMeters / distanceKm
```

Formule :

```txt
K_elevation = 1 + min(0.35, (verticalGainPerKm / 1000) × 2.5)
```

Barème indicatif :

| D+ / km | K_elevation |
|---:|---:|
| 0–10 m/km | 1.00 |
| 10–25 m/km | 1.05 |
| 25–50 m/km | 1.10 |
| 50–80 m/km | 1.18 |
| 80+ m/km | 1.25 à 1.35 |

Si pas de dénivelé :

```txt
K_elevation = 1.00
```

---

## 7. Coefficient terrain

À déduire de `sportType`, du nom de l'activité ou d'un tag utilisateur.

```ts
function getTerrainFactor(activity: ActivityInput): number {
  const name = (activity.name || '').toLowerCase();

  if (activity.sportType === 'trail_run') return 1.08;
  if (activity.sportType === 'gravel_ride') return 1.04;
  if (name.includes('trail')) return 1.08;
  if (name.includes('montagne')) return 1.15;
  if (name.includes('boue') || name.includes('neige')) return 1.15;
  if (name.includes('chemin')) return 1.04;

  return 1.00;
}
```

Valeurs recommandées :

| Terrain | K_terrain |
|---|---:|
| Route | 1.00 |
| Chemin / gravel | 1.04 |
| Trail roulant | 1.08 |
| Trail technique | 1.12 |
| Montagne / boue / neige | 1.15 |

---

## 8. Coefficient fatigue préalable

Si l'utilisateur est déjà en surcharge, une même séance coûte plus cher.

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

## 9. Charge musculaire trail

Le score CES mesure l'effort global. Pour le trail, ajouter un score musculaire séparé.

```txt
K_descent = 1 + min(0.25, (elevationLossMeters / distanceKm / 1000) × 1.8)
TrailMuscleScore = CES × K_descent
```

Si pas de D- disponible :

```txt
K_descent = 1.00
TrailMuscleScore = CES × K_elevation
```

Affichage recommandé :

```txt
Effort activité : 96 — Intense
Charge cardio : élevée
Charge musculaire : très élevée
```

---

## 10. Implémentation TypeScript du CES

Créer un fichier :

```txt
src/domain/training/effortScore.ts
```

```ts
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateEffortScore(
  activity: ActivityInput,
  profile: AthleteProfile,
  currentLoadRatio?: number
): EffortScoreResult {
  const distanceKm = Math.max(activity.distanceMeters / 1000, 0.1);
  const durationHours = Math.max(activity.movingTimeSeconds / 3600, 0.01);

  const intensityFactor = calculateIntensityFactor(activity, profile);
  const elevationFactor = calculateElevationFactor(activity, distanceKm);
  const cardioFactor = calculateCardioFactor(activity, profile, intensityFactor);
  const terrainFactor = getTerrainFactor(activity);
  const fatigueFactor = calculateFatigueFactor(currentLoadRatio);

  const baseScore = durationHours * 100 * Math.pow(intensityFactor, 2);
  const finalScore = baseScore * elevationFactor * cardioFactor * terrainFactor * fatigueFactor;

  const descentFactor = calculateDescentFactor(activity, distanceKm);
  const muscleScore = finalScore * descentFactor;

  return {
    activityId: activity.id,
    ces: Math.round(finalScore),
    baseScore: Math.round(baseScore),
    muscleScore: Math.round(muscleScore),
    label: getEffortLabel(finalScore),
    durationHours,
    intensityFactor,
    elevationFactor,
    cardioFactor,
    terrainFactor,
    fatigueFactor,
    descentFactor,
  };
}
```

Résultat attendu :

```ts
type EffortScoreResult = {
  activityId: string;
  ces: number;
  baseScore: number;
  muscleScore: number;
  label: 'recovery' | 'endurance' | 'steady' | 'intense' | 'very_hard' | 'extreme';
  durationHours: number;
  intensityFactor: number;
  elevationFactor: number;
  cardioFactor: number;
  terrainFactor: number;
  fatigueFactor: number;
  descentFactor: number;
};
```

---

## 11. Labels activité

```ts
export function getEffortLabel(score: number): EffortLabel {
  if (score <= 30) return 'recovery';
  if (score <= 60) return 'endurance';
  if (score <= 90) return 'steady';
  if (score <= 130) return 'intense';
  if (score <= 180) return 'very_hard';
  return 'extreme';
}
```

Libellés UI français :

```ts
export const EFFORT_LABEL_FR = {
  recovery: 'Récupération',
  endurance: 'Endurance',
  steady: 'Soutenu',
  intense: 'Intense',
  very_hard: 'Très dur',
  extreme: 'Extrême',
};
```

---

## 12. Charge quotidienne

```txt
Daily_Load(date) = somme des CES de toutes les activités du jour
```

```ts
type DailyTrainingLoad = {
  date: string;
  dailyLoad: number;
  activityCount: number;
  muscleLoad: number;
};
```

---

## 13. Charge hebdomadaire

```txt
Weekly_Load(week) = somme des Daily_Load de la semaine ISO
```

```ts
type WeeklyTrainingLoad = {
  weekStartDate: string;
  weekEndDate: string;
  weeklyLoad: number;
  weeklyMuscleLoad: number;
  activityCount: number;
};
```

---

## 14. Fatigue récente — moyenne pondérée 7 jours

Version officielle demandée :

```txt
Fatigue_7j = moyenne pondérée des CES sur 7 jours
```

Les jours récents doivent compter plus que les jours anciens.

### Poids recommandés

| Jour | Poids |
|---:|---:|
| J | 1.00 |
| J-1 | 0.85 |
| J-2 | 0.70 |
| J-3 | 0.55 |
| J-4 | 0.40 |
| J-5 | 0.25 |
| J-6 | 0.10 |

Formule :

```txt
Fatigue_7j = Σ(Daily_Load_J-i × Weight_i) / Σ(Weight_i)
```

Important : pour obtenir une valeur comparable à une charge hebdomadaire, créer aussi une version normalisée semaine :

```txt
Fatigue_7j_TotalEquivalent = Fatigue_7j × 7
```

Dans l'UI, utiliser surtout `Fatigue_7j_TotalEquivalent`, plus parlant pour comparer à la charge semaine.

### Implémentation

Créer :

```txt
src/domain/training/trainingLoad.ts
```

```ts
const FATIGUE_7D_WEIGHTS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.25, 0.10];

export function calculateWeightedFatigue7d(
  dailyLoads: DailyTrainingLoad[],
  targetDate: string
): Fatigue7dResult {
  const loadByDate = new Map(dailyLoads.map(d => [d.date, d.dailyLoad]));

  let weightedSum = 0;
  let weightSum = 0;

  for (let i = 0; i < 7; i++) {
    const date = subtractDays(targetDate, i);
    const load = loadByDate.get(date) ?? 0;
    const weight = FATIGUE_7D_WEIGHTS[i];

    weightedSum += load * weight;
    weightSum += weight;
  }

  const weightedDailyAverage = weightSum > 0 ? weightedSum / weightSum : 0;

  return {
    date: targetDate,
    fatigue7d: Math.round(weightedDailyAverage),
    fatigue7dTotalEquivalent: Math.round(weightedDailyAverage * 7),
  };
}
```

```ts
type Fatigue7dResult = {
  date: string;
  fatigue7d: number;
  fatigue7dTotalEquivalent: number;
};
```

---

## 15. Capacité d'entraînement — 42 jours

La capacité représente ce que l'utilisateur est habitué à encaisser.

```txt
Fitness_42j = moyenne pondérée des Daily_Load sur 42 jours
```

Utiliser un EWMA ou une moyenne pondérée décroissante.

Version simple recommandée V1 :

```txt
Fitness_42j = moyenne simple des 42 derniers jours × 7
```

Pourquoi ×7 ? Pour comparer à une charge hebdomadaire.

```ts
export function calculateFitness42d(
  dailyLoads: DailyTrainingLoad[],
  targetDate: string
): Fitness42dResult {
  const loadByDate = new Map(dailyLoads.map(d => [d.date, d.dailyLoad]));

  let sum = 0;

  for (let i = 0; i < 42; i++) {
    const date = subtractDays(targetDate, i);
    sum += loadByDate.get(date) ?? 0;
  }

  const averageDailyLoad = sum / 42;

  return {
    date: targetDate,
    fitness42d: Math.round(averageDailyLoad),
    fitness42dWeeklyEquivalent: Math.round(averageDailyLoad * 7),
  };
}
```

---

## 16. Indice de surcharge

```txt
LoadRatio = Fatigue_7j_TotalEquivalent / Fitness_42j_WeeklyEquivalent
```

Protection division par zéro :

```ts
if (fitness42dWeeklyEquivalent < 20) {
  loadRatio = null;
  status = 'insufficient_data';
}
```

Barème :

| LoadRatio | Statut Cockpit | Message court |
|---:|---|---|
| < 0.70 | Sous-charge | Tu peux relancer progressivement |
| 0.70–0.90 | Charge légère | Bon moment pour construire |
| 0.90–1.20 | Équilibré | Zone idéale |
| 1.20–1.35 | Productif | Progression, surveiller la récupération |
| 1.35–1.50 | Fatigue élevée | Alléger la prochaine séance |
| > 1.50 | Surcharge | Récupération conseillée |

---

## 17. Fraîcheur

```txt
Freshness = Fitness_42j_WeeklyEquivalent - Fatigue_7j_TotalEquivalent
```

Barème :

| Freshness | État |
|---:|---|
| > +60 | Très frais |
| +20 à +60 | Frais |
| -20 à +20 | Équilibré |
| -60 à -20 | Fatigué |
| < -60 | Très fatigué |

---

## 18. Synthèse quotidienne TrainingStatus

```ts
type TrainingStatus = {
  date: string;
  dailyLoad: number;
  weeklyLoad: number;
  fatigue7d: number;
  fatigue7dTotalEquivalent: number;
  fitness42d: number;
  fitness42dWeeklyEquivalent: number;
  loadRatio: number | null;
  freshness: number | null;
  status: 'insufficient_data' | 'underload' | 'light' | 'balanced' | 'productive' | 'high_fatigue' | 'overload';
  recommendationLevel: 'normal' | 'reduce_volume' | 'easy_only' | 'rest';
};
```

---

## 19. Recommandations de séance

La recommandation doit croiser :

- séance prévue dans le plan
- statut de charge
- fatigue récente
- fraîcheur
- dernière séance intense
- charge musculaire trail récente

### Règles V1

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
      suggestedWorkout: 'Repos ou 30 à 40 min très facile.',
    };
  }

  if (status.loadRatio !== null && status.loadRatio > 1.35) {
    return {
      decision: 'replace_by_easy',
      message: 'Fatigue élevée. Remplace la séance intense par de l’endurance fondamentale.',
      suggestedWorkout: '45 min endurance fondamentale + mobilité.',
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

---

## 20. Règles spécifiques trail

Si la charge musculaire trail des dernières 48 h est élevée :

```txt
recentMuscleLoad48h > 140
```

Alors éviter :

- VMA
- côtes intenses
- seuil long
- descente rapide

Recommandation :

```txt
Endurance fondamentale, vélo souple, marche active ou repos.
```

Message utilisateur :

```txt
Ta fatigue cardio est correcte, mais la charge musculaire trail reste élevée. Évite une séance intense aujourd’hui.
```

---

## 21. Graphiques à créer dans l'app

### Graphique 1 — Charge semaine

Données :

- semaine ISO
- weeklyLoad
- zone cible basse
- zone cible haute

Affichage :

```txt
Charge semaine : 412 pts
Objectif conseillé : 380–460 pts
État : productif
```

### Graphique 2 — Fatigue vs capacité

Courbes :

- Fatigue récente 7j pondérée, équivalent hebdo
- Capacité 42j, équivalent hebdo

### Graphique 3 — Fraîcheur

Barres :

- freshness

Couleurs UI :

- positif : frais
- proche zéro : équilibré
- négatif : fatigué

### Graphique 4 — Répartition intensité

Sur les 4 dernières semaines :

- récupération
- endurance
- soutenu
- intense
- très dur
- extrême

### Graphique 5 — Charge musculaire trail

Courbe ou barres :

- TrailMuscleScore par activité
- cumul 7 jours

---

## 22. UI recommandée

### Carte activité

```txt
Trail — 12,4 km — 1h18 — D+ 420 m

Effort : 96 — Intense
Charge cardio : élevée
Charge musculaire : très élevée
Impact récupération : 36 h

Analyse :
Belle séance trail. L’intensité cardio reste maîtrisée, mais le dénivelé augmente fortement la charge musculaire.
```

### Carte semaine

```txt
Charge semaine : 412 pts
Objectif conseillé : 380–460 pts
État : Productif
Fatigue : Modérée
Fraîcheur : Correcte
```

### Carte recommandation

```txt
Prochaine séance recommandée :
45 min endurance fondamentale + 6 lignes droites.

Pourquoi :
Ta charge 7 jours est en hausse et ta dernière sortie trail a créé une fatigue musculaire élevée.
```

---

## 23. Base de données suggérée

### Table `activity_effort_scores`

```sql
create table activity_effort_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_id text not null,
  activity_date date not null,
  ces integer not null,
  base_score integer,
  muscle_score integer,
  effort_label text not null,
  duration_hours numeric,
  intensity_factor numeric,
  elevation_factor numeric,
  cardio_factor numeric,
  terrain_factor numeric,
  fatigue_factor numeric,
  descent_factor numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, activity_id)
);
```

### Table `daily_training_loads`

```sql
create table daily_training_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  daily_load integer not null,
  muscle_load integer not null default 0,
  activity_count integer not null default 0,
  fatigue_7d integer,
  fatigue_7d_total_equivalent integer,
  fitness_42d integer,
  fitness_42d_weekly_equivalent integer,
  load_ratio numeric,
  freshness integer,
  status text,
  recommendation_level text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, date)
);
```

---

## 24. Pipeline de calcul

Après chaque synchronisation d'activité :

1. Récupérer les nouvelles activités
2. Calculer ou recalculer le CES de chaque activité
3. Sauvegarder dans `activity_effort_scores`
4. Recalculer les charges quotidiennes sur la période impactée
5. Recalculer Fatigue_7j pondérée
6. Recalculer Fitness_42j
7. Recalculer LoadRatio et Freshness
8. Générer recommandation
9. Mettre à jour les cartes et graphiques

Période à recalculer après nouvelle activité :

```txt
activityDate - 1 jour jusqu'à aujourd'hui
```

Pour sécurité, recalculer les 60 derniers jours.

---

## 25. Tests unitaires recommandés

Créer :

```txt
src/domain/training/effortScore.test.ts
src/domain/training/trainingLoad.test.ts
```

Cas à tester :

1. Sortie EF 45 min route
2. Séance VMA courte intense
3. Sortie longue 2h route
4. Trail 1h30 avec D+ 600 m
5. Vélo avec puissance
6. Activité sans cardio
7. Activité sans dénivelé
8. Fatigue_7j pondérée avec plusieurs jours chargés
9. LoadRatio > 1.50 donne surcharge
10. LoadRatio 0.90–1.20 donne équilibré

---

## 26. Exemple de calcul

Activité :

```txt
Trail 12 km
Durée 1h20
D+ 420 m
FC moy 150
FC repos 55
FC max 185
Allure seuil 5:00/km
```

Calcul :

```txt
DurationHours = 1.33
Pace = 6:40/km = 400 sec/km
IF = 300 / 400 = 0.75
BaseScore = 1.33 × 100 × 0.75² = 75
D+ / km = 35 m/km
K_elevation ≈ 1.09
K_terrain = 1.08
HR_relative = (150 - 55) / (185 - 55) = 0.73
K_cardio ≈ 1.00
K_fatigue = 1.00
CES = 75 × 1.09 × 1.08 = 88
```

Résultat UI :

```txt
Effort : 88 — Soutenu
Charge musculaire : élevée
```

---

## 27. Priorité d'implémentation

### Phase 1 — obligatoire

- CES par activité
- labels utilisateur
- charge jour
- charge semaine
- Fatigue_7j pondérée
- Fitness_42j
- LoadRatio
- Freshness
- carte recommandation simple

### Phase 2

- charge musculaire trail avancée
- détection terrain automatique par titre
- graphiques dédiés
- comparaison charge prévue vs charge réalisée

### Phase 3

- intégration sommeil / HRV Garmin
- RPE utilisateur après séance
- ajustement automatique des coefficients
- prédiction de risque surcharge/blessure

---

## 28. Règles importantes

- Ne pas afficher ATL / CTL / TSB en priorité.
- Garder ces valeurs en backend si elles existent déjà.
- Afficher en priorité les noms Cockpit :
  - Effort activité
  - Fatigue récente
  - Capacité d'entraînement
  - Fraîcheur
  - Indice de surcharge
- Toujours expliquer la recommandation avec une phrase simple.
- Ne jamais recommander une séance intense si LoadRatio > 1.35.
- Ne jamais recommander une séance intense si charge musculaire trail très élevée sur 48 h.
- Si données insuffisantes, afficher une recommandation prudente.

---

## 29. Résultat attendu pour l'utilisateur

L'utilisateur doit pouvoir comprendre immédiatement :

```txt
Est-ce que ma séance était facile ou dure ?
Est-ce que ma semaine est trop chargée ?
Est-ce que je suis frais ou fatigué ?
Est-ce que je peux faire la prochaine séance prévue ?
Dois-je réduire, remplacer ou récupérer ?
```

Ce modèle doit devenir le cœur intelligent de Cockpit Trail.
