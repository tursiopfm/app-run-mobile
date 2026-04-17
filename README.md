# Trail Cockpit — Android

Application Android (Jetpack Compose) reproduisant le tableau de bord de suivi de course à pied / trail « TRAIL COCKPIT — FRANCK 2026 ».

## Ce que l'app affiche

- **En-tête** : titre et statut de charge (« Zone OK — TSB 7 »).
- **Tuiles KPI semaine** : RUN km, RUN D+, VÉLO km.
- **Tableau hebdo** : 7 jours × (séance / volume km / D+ m) + total.
- **Tuiles YTD** : RUN cumul, CHARGE (ATL / CTL / TSB), VÉLO.
- **Barres d'objectifs** : km année, volume semaine, D+ semaine.
- **Graphiques** (dessinés en Jetpack Compose `Canvas`, aucune dépendance de chart externe) :
  - RUN km — 16 semaines (line)
  - RUN D+ (m) — 16 semaines (bar)
  - ATL / CTL / TSB — 16 semaines (multi-line)
  - Répartition des intensités — 30 j glissants (donut)
  - RUN Suffer — 16 semaines (bar)
  - Ratio D+/km — tendance (line)
  - Cumul km par année (13 saisons + 2026)
  - Cumul km par mois (4 derniers mois)

Les valeurs sont un jeu de données d'exemple (`data/SampleData.kt`) calqué sur la capture d'écran fournie.

## Stack

- Kotlin 2.0 + Android Gradle Plugin 8.5
- Jetpack Compose BOM 2024.09, Material 3
- minSdk 26, targetSdk/compileSdk 34

## Lancer le projet

1. Ouvrir le dossier dans Android Studio (Koala+).
2. Laisser Gradle se synchroniser (le wrapper sera généré au premier build).
3. `Run` sur un émulateur ou un appareil Android ≥ 8.0.

## Architecture

```
app/src/main/java/com/franck/trailcockpit/
├── MainActivity.kt
├── data/
│   ├── Models.kt           # data classes (WeekOverview, YtdData, WeeklyPoint…)
│   └── SampleData.kt       # données d'exemple
└── ui/
    ├── theme/              # palette + thème Material3
    ├── components/         # ChartCard, LineChart, BarChart, PieChart,
    │                       # KpiTile, ProgressRow, WeekTable, SmallBarStrip
    └── screens/
        └── DashboardScreen.kt
```

## Étapes suivantes possibles

- Brancher une source de données réelle (export Strava / CSV / Google Sheets).
- Ajouter la persistance locale (Room).
- Ajouter un écran de saisie rapide d'une séance.
- Notifications hebdomadaires de bilan.
