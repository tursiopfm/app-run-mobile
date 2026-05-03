# i18n — Internationalisation de Trail Cockpit (FR + EN)

**Date :** 2026-04-28  
**Scope :** Migration complète de ~640 strings hardcodées vers `strings.xml`, support FR/EN avec détection automatique de la langue système.

---

## Objectif

Permettre à l'app d'afficher sa UI dans la langue système de l'utilisateur. Anglais comme base universelle (fallback), Français comme traduction principale.

---

## Architecture

### Fichiers de resources

```
res/
  values/           ← base anglaise (fallback universel)
    strings.xml     ← toutes les clés EN
  values-fr/
    strings.xml     ← traductions FR (même clés, textes FR)
```

Android sélectionne automatiquement le bon fichier selon `Locale` système. Aucun code de sélection nécessaire.

### Fichiers Kotlin modifiés

| Fichier | Strings estimées | Notes |
|---|---|---|
| `AuthScreen.kt` | ~22 | Écran isolé, bon point de départ |
| `WeekTable.kt` | ~8 | Headers tableau |
| `KpiTiles.kt` | ~8 | Labels progression, formats |
| `Charts.kt` | ~8 | Legend, formats numériques |
| `DraftCards.kt` | ~30 | Labels connexion Strava, draft |
| `DashboardScreen.kt` | ~563 | Tout le dashboard, tous les onglets |

`RemoteDashboard.kt` — **non modifié** (lecture seule selon CLAUDE.md).

---

## Convention de nommage des clés

```
<screen>_<composant>_<description>
```

### Groupes de préfixes

| Préfixe | Contenu |
|---|---|
| `auth_` | AuthScreen (tabs, labels, erreurs) |
| `dashboard_tab_` | Labels des 6 onglets |
| `dashboard_cockpit_` | Tab Cockpit (KPIs, objectifs, historique) |
| `dashboard_stats_` | Tab Stats (graphiques, périodes) |
| `dashboard_charge_` | Tab Charge (EWMA, fraîcheur, intensités) |
| `dashboard_activities_` | Tab Activités (liste, détail, édition, filtres) |
| `dashboard_settings_` | Tab Réglages (profil, zones, Strava) |
| `common_` | Boutons et labels partagés (Enregistrer, Annuler…) |
| `unit_` | Unités de mesure (km, m, km/h, D+…) |
| `error_` | Messages de validation et d'erreur |
| `sport_` | Types de sport et abréviations |
| `hr_zone_` | Zones cardio (noms, descriptions, protocole) |
| `format_` | Patterns date/heure localisés |
| `charts_` | Composant Charts.kt |
| `week_table_` | Composant WeekTable.kt |

### Exemples de clés

```xml
<string name="auth_tab_login">Login</string>
<string name="auth_tab_create_account">Create account</string>
<string name="dashboard_tab_cockpit">Cockpit</string>
<string name="common_button_save">Save</string>
<string name="unit_km">km</string>
<string name="error_invalid_distance">Invalid distance.</string>
<string name="hr_zone_z1_name">Easy jog / Base</string>
<string name="format_date_placeholder">MM/DD/YYYY</string>
```

---

## Strings formatées (avec arguments)

Utiliser les placeholders XML `%s`, `%d`, `%1$s` :

```xml
<!-- EN -->
<string name="activity_suffer_score">Suffer %d</string>
<string name="kpi_progress_label">%1$s • %2$s / %3$s (%4$d%%)</string>
<string name="dashboard_sort_label">Sort: %1$s %2$s</string>
```

```kotlin
// Usage Compose
stringResource(R.string.activity_suffer_score, activity.sufferScore)
stringResource(R.string.kpi_progress_label, label, current, target, pct)
```

---

## Dates et formats numériques

### Mois abrégés

Supprimer les arrays hardcodés `["janv", "fév", ...]` et utiliser Java Time natif :

```kotlin
// Automatiquement "Jan" en EN, "janv." en FR selon Locale système
Month.of(monthIndex).getDisplayName(TextStyle.SHORT, Locale.getDefault())
```

### Pattern de date (placeholder formulaire)

```xml
<!-- res/values/strings.xml -->
<string name="format_date_placeholder">MM/DD/YYYY</string>

<!-- res/values-fr/strings.xml -->
<string name="format_date_placeholder">JJ/MM/AAAA</string>
```

### Séparateurs décimaux / milliers

Remplacer les `","` hardcodés dans `formatDouble()` / `formatDistance()` par `NumberFormat.getInstance(Locale.getDefault())` — automatique, aucune string resource nécessaire.

---

## Strings qui restent en dur (non traduisibles)

| Valeur | Raison |
|---|---|
| `"TSB"`, `"ATL"`, `"CTL"`, `"LTHR"`, `"VO₂max"` | Termes techniques universels |
| `"🏃"`, `"🚴"`, `"🏊"` | Emojis |
| `"© OpenStreetMap"` | Attribution légale |
| `"%.0f"`, `"%,.0f"`, `"%.1f"` | Patterns numériques internes, remplacés par NumberFormat |
| Noms de classes, variables Kotlin | Code, pas UI |

---

## Pas de pluriels

L'app n'a pas de patterns "1 activité / 2 activités" dans les strings identifiées. Pas besoin de `<plurals>` XML.

---

## Ordre d'implémentation

1. Créer `res/values/strings.xml` complet (EN) + `res/values-fr/strings.xml` complet (FR)
2. Migrer `AuthScreen.kt`
3. Migrer `WeekTable.kt`, `KpiTiles.kt`, `Charts.kt`
4. Migrer `DraftCards.kt`
5. Migrer `DashboardScreen.kt` (onglet par onglet : Cockpit → Stats → Charge → Activités → Réglages)

---

## Critères de succès

- L'app affiche en français sur un téléphone en FR, en anglais sur un téléphone en EN
- Les strings hardcodées sont éliminées des fichiers Kotlin (hors exceptions listées ci-dessus)
- Aucune régression UI visible
- Les mois dans les graphiques sont localisés automatiquement
- Les formats de date (placeholder) changent selon la langue
