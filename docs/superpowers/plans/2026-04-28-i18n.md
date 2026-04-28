# i18n — Internationalisation FR + EN

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all ~640 hardcoded UI strings into `res/values/strings.xml` (EN) + `res/values-fr/strings.xml` (FR), enabling automatic system-locale detection.

**Architecture:** Android native `strings.xml` approach. English as universal fallback, French as primary translation. Enums with hardcoded labels migrated to `@StringRes val labelRes: Int`. Non-composable functions needing localization converted to `@Composable`. Error strings produced in callbacks pre-fetched via `stringResource()` in composable scope. Month names use `java.time.Month.getDisplayName()`. Number formatting uses `NumberFormat.getInstance(Locale.getDefault())`.

**Tech Stack:** Kotlin, Jetpack Compose, `stringResource()`, `stringArrayResource()`, `@StringRes`, `java.time.Month`, `java.text.NumberFormat`

**⚠️ Do NOT translate:**
- Intensity value identifiers: `"Footing / EF"`, `"VMA"`, `"Seuil"`, `"Côtes"`, `"Sortie longue"`, `"Balade"`, `"Runtaf"`, `"Vélotaf"`, `"Autre"` — these are stored in the backend as identifiers
- Strava type codes: `"Run"`, `"TrailRun"`, `"Ride"`, `"VirtualRide"`, `"EBikeRide"`, `"Swim"`, `"Walk"`, `"Hike"`
- Technical acronyms: `"TSB"`, `"ATL"`, `"CTL"`, `"LTHR"`, `"VO₂max"`, `"D+"`, `"Load"`
- Emojis: `"🏃"`, `"🚴"`, `"🏊"`, etc.
- Attribution: `"© OpenStreetMap"`

---

## File Map

| Action | File |
|---|---|
| Modify (add entries) | `app/src/main/res/values/strings.xml` |
| Create | `app/src/main/res/values-fr/strings.xml` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/screens/AuthScreen.kt` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/components/WeekTable.kt` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/components/KpiTiles.kt` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/components/Charts.kt` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/components/DraftCards.kt` |
| Modify | `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` |

---

## Task 1: Foundation strings — common, unit, error, format, sport, hr_zone

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Create: `app/src/main/res/values-fr/strings.xml`

- [ ] **Step 1: Replace content of `res/values/strings.xml` with full English base**

```xml
<resources>
    <string name="app_name">Trail Cockpit</string>

    <!-- common -->
    <string name="common_button_save">Save</string>
    <string name="common_button_cancel">Cancel</string>
    <string name="common_button_apply">Apply</string>
    <string name="common_button_reset">Reset</string>
    <string name="common_button_validate">Validate</string>
    <string name="common_button_reconnect">Reconnect</string>
    <string name="common_button_connect">Connect</string>
    <string name="common_button_sync">Sync</string>
    <string name="common_button_search">Search</string>
    <string name="common_button_add_block">Add block</string>
    <string name="common_button_back">Back</string>
    <string name="common_label_loading">Loading</string>
    <string name="common_label_loading_dots">Loading…</string>
    <string name="common_label_saving">Saving…</string>
    <string name="common_label_all">All</string>
    <string name="common_label_all_activities">All activities</string>
    <string name="common_label_week">Week</string>
    <string name="common_label_month">Month</string>
    <string name="common_label_year">Year</string>
    <string name="common_label_total">Total</string>
    <string name="common_label_week_caps">WEEK</string>
    <string name="common_label_year_caps">YEAR</string>
    <string name="common_label_label">Label</string>

    <!-- units -->
    <string name="unit_km">km</string>
    <string name="unit_m">m</string>
    <string name="unit_km_h">km/h</string>
    <string name="unit_per_km">/km</string>
    <string name="unit_swim_pace">m:s/100m</string>
    <string name="unit_duration_ms">mm:ss</string>
    <string name="unit_duration_hms">h:mm:ss</string>
    <string name="unit_kg">kg</string>
    <string name="unit_pct_fcmax">% Max HR</string>

    <!-- errors -->
    <string name="error_email_password_required">Email and password required.</string>
    <string name="error_first_last_name_required">First and last name required.</string>
    <string name="error_gender_required">Please select a gender.</string>
    <string name="error_password_too_short">Password must be at least 6 characters.</string>
    <string name="error_unknown">Unknown error</string>
    <string name="error_invalid_title">Invalid title.</string>
    <string name="error_invalid_distance">Invalid distance.</string>
    <string name="error_invalid_duration">Invalid duration. Use mm:ss format.</string>
    <string name="error_no_activity_match">No activities match.</string>
    <string name="error_activity_load_failed">Cannot load activity.</string>
    <string name="error_map_unavailable">Route unavailable</string>
    <string name="error_detail_unavailable">Detail unavailable</string>

    <!-- formats -->
    <string name="format_date_placeholder">MM/DD/YYYY</string>
    <string name="format_duration_hint">min or min:sec</string>

    <!-- sports -->
    <string name="sport_run">Running</string>
    <string name="sport_bike">Cycling</string>
    <string name="sport_swim">Swimming</string>
    <string name="sport_run_abbr">RUN</string>
    <string name="sport_bike_abbr">BIKE</string>
    <string name="sport_swim_abbr">SWIM</string>
    <string name="sport_run_type_run">Run</string>
    <string name="sport_run_type_trail">Trail Run</string>
    <string name="sport_run_type_walk">Walk</string>
    <string name="sport_run_type_hike">Hiking</string>
    <string name="sport_bike_type_ride">Cycling</string>
    <string name="sport_bike_type_virtual">Virtual Ride</string>
    <string name="sport_bike_type_ebike">E-Bike Ride</string>
    <string name="sport_swim_type">Swimming</string>

    <!-- heart rate zones -->
    <string name="hr_zone_z1_name">Base endurance</string>
    <string name="hr_zone_z1_description">Very easy jog, recovery, warm-up.</string>
    <string name="hr_zone_z2_name">Active endurance</string>
    <string name="hr_zone_z2_description">Active endurance, sustained but controlled effort.</string>
    <string name="hr_zone_z3_name">Threshold</string>
    <string name="hr_zone_z3_description">Threshold work, hard but sustainable effort.</string>
    <string name="hr_zone_z4_name">VO₂max / Intervals</string>
    <string name="hr_zone_z4_description">VO₂max, hills, short intervals, very intense effort.</string>
    <string name="hr_zone_z5_name">Max intensity</string>
    <string name="hr_zone_z5_description">Very intense effort, sprint.</string>
    <string name="hr_zone_custom_zones">Custom zones</string>
    <string name="hr_zone_lt_hr">Anaerobic threshold / LTHR</string>
    <string name="hr_zone_aet">Aerobic threshold / AeT</string>
    <string name="hr_zone_zones_used">Heart rate zones used</string>
    <string name="hr_zone_min">Min</string>
    <string name="hr_zone_max">Max</string>
    <string name="hr_zone_optimal_range">Optimal range</string>
</resources>
```

- [ ] **Step 2: Create `res/values-fr/strings.xml` with French translations**

```xml
<resources>
    <string name="app_name">Trail Cockpit</string>

    <!-- common -->
    <string name="common_button_save">Enregistrer</string>
    <string name="common_button_cancel">Annuler</string>
    <string name="common_button_apply">Appliquer</string>
    <string name="common_button_reset">Réinitialiser</string>
    <string name="common_button_validate">Valider</string>
    <string name="common_button_reconnect">Reconnecter</string>
    <string name="common_button_connect">Connecter</string>
    <string name="common_button_sync">Sync</string>
    <string name="common_button_search">Rechercher</string>
    <string name="common_button_add_block">Ajouter un bloc</string>
    <string name="common_button_back">Retour</string>
    <string name="common_label_loading">Chargement</string>
    <string name="common_label_loading_dots">Chargement…</string>
    <string name="common_label_saving">Enregistrement…</string>
    <string name="common_label_all">Toutes</string>
    <string name="common_label_all_activities">Toutes activités</string>
    <string name="common_label_week">Semaine</string>
    <string name="common_label_month">Mois</string>
    <string name="common_label_year">Année</string>
    <string name="common_label_total">Total</string>
    <string name="common_label_week_caps">SEMAINE</string>
    <string name="common_label_year_caps">ANNÉE</string>
    <string name="common_label_label">Label</string>

    <!-- units -->
    <string name="unit_km">km</string>
    <string name="unit_m">m</string>
    <string name="unit_km_h">km/h</string>
    <string name="unit_per_km">/km</string>
    <string name="unit_swim_pace">m:s/100m</string>
    <string name="unit_duration_ms">mm:ss</string>
    <string name="unit_duration_hms">h:mm:ss</string>
    <string name="unit_kg">kg</string>
    <string name="unit_pct_fcmax">% FC max</string>

    <!-- errors -->
    <string name="error_email_password_required">Email et mot de passe requis.</string>
    <string name="error_first_last_name_required">Prénom et nom requis.</string>
    <string name="error_gender_required">Veuillez sélectionner un genre.</string>
    <string name="error_password_too_short">Le mot de passe doit faire au moins 6 caractères.</string>
    <string name="error_unknown">Erreur inconnue</string>
    <string name="error_invalid_title">Titre invalide.</string>
    <string name="error_invalid_distance">Distance invalide.</string>
    <string name="error_invalid_duration">Durée invalide. Utilise le format min:sec.</string>
    <string name="error_no_activity_match">Aucune activité ne correspond.</string>
    <string name="error_activity_load_failed">Impossible de charger l\'activité.</string>
    <string name="error_map_unavailable">Tracé indisponible</string>
    <string name="error_detail_unavailable">Détail indisponible</string>

    <!-- formats -->
    <string name="format_date_placeholder">JJ/MM/AAAA</string>
    <string name="format_duration_hint">min ou min:sec</string>

    <!-- sports -->
    <string name="sport_run">Running</string>
    <string name="sport_bike">Vélo</string>
    <string name="sport_swim">Natation</string>
    <string name="sport_run_abbr">RUN</string>
    <string name="sport_bike_abbr">VÉLO</string>
    <string name="sport_swim_abbr">NATATION</string>
    <string name="sport_run_type_run">Course</string>
    <string name="sport_run_type_trail">Trail</string>
    <string name="sport_run_type_walk">Marche</string>
    <string name="sport_run_type_hike">Randonnée</string>
    <string name="sport_bike_type_ride">Vélo</string>
    <string name="sport_bike_type_virtual">Vélo virtuel</string>
    <string name="sport_bike_type_ebike">Vélo électrique</string>
    <string name="sport_swim_type">Natation</string>

    <!-- heart rate zones -->
    <string name="hr_zone_z1_name">Endurance fondamentale</string>
    <string name="hr_zone_z1_description">Footing très facile, récupération, échauffement.</string>
    <string name="hr_zone_z2_name">Endurance active</string>
    <string name="hr_zone_z2_description">Endurance active, effort soutenu mais contrôlé.</string>
    <string name="hr_zone_z3_name">Travail au seuil</string>
    <string name="hr_zone_z3_description">Travail au seuil, effort difficile mais tenable.</string>
    <string name="hr_zone_z4_name">VO₂max / VMA</string>
    <string name="hr_zone_z4_description">VO₂max, côtes, intervalles courts, effort très intense.</string>
    <string name="hr_zone_z5_name">VMA / très intense</string>
    <string name="hr_zone_z5_description">Effort très intense, sprint.</string>
    <string name="hr_zone_custom_zones">Zones personnalisées</string>
    <string name="hr_zone_lt_hr">Seuil anaérobie / LTHR</string>
    <string name="hr_zone_aet">Seuil aérobie / AeT</string>
    <string name="hr_zone_zones_used">Zones FC utilisées</string>
    <string name="hr_zone_min">Min</string>
    <string name="hr_zone_max">Max</string>
    <string name="hr_zone_optimal_range">Plage optimale</string>
</resources>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml
git commit -m "feat(i18n): foundation strings — common, unit, error, format, sport, hr_zone"
```

---

## Task 2: Auth strings + AuthScreen.kt migration

**Files:**
- Modify: `app/src/main/res/values/strings.xml` (add auth section)
- Modify: `app/src/main/res/values-fr/strings.xml` (add auth section)
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/AuthScreen.kt`

- [ ] **Step 1: Add auth strings to both strings.xml files**

In `res/values/strings.xml`, add before `</resources>`:
```xml
    <!-- auth -->
    <string name="auth_subtitle">AI Sport Coach</string>
    <string name="auth_tab_login">Login</string>
    <string name="auth_tab_create_account">Create account</string>
    <string name="auth_field_first_name">First name</string>
    <string name="auth_field_last_name">Last name</string>
    <string name="auth_field_gender">Gender</string>
    <string name="auth_field_birth_date">Date of birth</string>
    <string name="auth_field_email">Email</string>
    <string name="auth_field_password">Password</string>
    <string name="auth_button_login">Log in</string>
    <string name="auth_button_create">Create my account</string>
    <string-array name="auth_genders">
        <item>Male</item>
        <item>Female</item>
        <item>Other</item>
    </string-array>
```

In `res/values-fr/strings.xml`, add before `</resources>`:
```xml
    <!-- auth -->
    <string name="auth_subtitle">AI Coach Sport</string>
    <string name="auth_tab_login">Connexion</string>
    <string name="auth_tab_create_account">Créer un compte</string>
    <string name="auth_field_first_name">Prénom</string>
    <string name="auth_field_last_name">Nom</string>
    <string name="auth_field_gender">Genre</string>
    <string name="auth_field_birth_date">Date de naissance</string>
    <string name="auth_field_email">Email</string>
    <string name="auth_field_password">Mot de passe</string>
    <string name="auth_button_login">Se connecter</string>
    <string name="auth_button_create">Créer mon compte</string>
    <string-array name="auth_genders">
        <item>Homme</item>
        <item>Femme</item>
        <item>Autre</item>
    </string-array>
```

- [ ] **Step 2: Migrate `AuthScreen.kt`**

Add imports at the top of the file:
```kotlin
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
```

Remove the top-level private val:
```kotlin
// DELETE this line:
private val GENRES = listOf("Homme", "Femme", "Autre")
```

Inside `AuthScreen` composable, add at the start (after the `remember` declarations):
```kotlin
val genres = stringArrayResource(R.array.auth_genders).toList()

// Pre-fetch error strings (used inside non-composable submit())
val errEmailPwd = stringResource(R.string.error_email_password_required)
val errFirstLast = stringResource(R.string.error_first_last_name_required)
val errGender = stringResource(R.string.error_gender_required)
val errPwdShort = stringResource(R.string.error_password_too_short)
```

In `submit()`, replace hardcoded error strings:
```kotlin
// BEFORE:
errorMessage = "Email et mot de passe requis."
// AFTER:
errorMessage = errEmailPwd

// BEFORE:
errorMessage = "Prénom et nom requis."
// AFTER:
errorMessage = errFirstLast

// BEFORE:
errorMessage = "Veuillez sélectionner un genre."
// AFTER:
errorMessage = errGender

// BEFORE:
errorMessage = "Le mot de passe doit faire au moins 6 caractères."
// AFTER:
errorMessage = errPwdShort

// BEFORE (in onFailure):
errorMessage = it.message ?: "Erreur inconnue"
// AFTER:
errorMessage = it.message ?: stringResource(R.string.error_unknown)
```

Wait — `stringResource` cannot be called inside a lambda (onFailure). Pre-fetch it too:
```kotlin
val errUnknown = stringResource(R.string.error_unknown)
// ...
errorMessage = it.message ?: errUnknown
```

Replace all `Text(...)` hardcoded strings:
```kotlin
// title subtitle
Text(text = "Trail Cockpit", ...) // keep — app name stays hardcoded
Text(text = "AI Coach Sport", ...) → Text(text = stringResource(R.string.auth_subtitle), ...)

// tabs
listOf("Connexion", "Créer un compte") → listOf(
    stringResource(R.string.auth_tab_login),
    stringResource(R.string.auth_tab_create_account)
)

// fields
label = { Text("Prénom") } → label = { Text(stringResource(R.string.auth_field_first_name)) }
label = { Text("Nom") } → label = { Text(stringResource(R.string.auth_field_last_name)) }
Text(text = "Genre", ...) → Text(text = stringResource(R.string.auth_field_gender), ...)

// GENRES references → genres (the new val)
GENRES.forEach { g -> ... } → genres.forEach { g -> ... }

// date of birth
label = { Text("Date de naissance") } → label = { Text(stringResource(R.string.auth_field_birth_date)) }
placeholder = { Text("JJ/MM/AAAA", ...) } → placeholder = { Text(stringResource(R.string.format_date_placeholder), ...) }

// email, password
label = { Text("Email") } → label = { Text(stringResource(R.string.auth_field_email)) }
label = { Text("Mot de passe") } → label = { Text(stringResource(R.string.auth_field_password)) }

// button
text = if (selectedTab == 0) "Se connecter" else "Créer mon compte"
→ text = if (selectedTab == 0) stringResource(R.string.auth_button_login)
         else stringResource(R.string.auth_button_create)
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/AuthScreen.kt
git commit -m "feat(i18n): migrate AuthScreen"
```

---

## Task 3: WeekTable.kt migration

**Files:**
- Modify: `app/src/main/res/values/strings.xml` (add week_table section)
- Modify: `app/src/main/res/values-fr/strings.xml` (add week_table section)
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/components/WeekTable.kt`

- [ ] **Step 1: Add week_table strings to both XML files**

In `res/values/strings.xml`:
```xml
    <!-- week table -->
    <string name="week_table_header_session">Session</string>
    <string name="week_table_header_label">Label</string>
    <string name="week_table_header_volume">Volume (km)</string>
    <string name="week_table_header_elevation">Elevation (m)</string>
    <string name="week_table_header_total">Total</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- week table -->
    <string name="week_table_header_session">Séance</string>
    <string name="week_table_header_label">Label</string>
    <string name="week_table_header_volume">Volume (km)</string>
    <string name="week_table_header_elevation">Dénivelé (m)</string>
    <string name="week_table_header_total">Total</string>
```

- [ ] **Step 2: Migrate `WeekTable.kt`**

Add import:
```kotlin
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
```

In the `WeekTable` composable, replace the `HeaderCell` string arguments:
```kotlin
// BEFORE:
HeaderCell("Séance", width = 90.dp, bg = TrailColors.HeaderBg)
// AFTER:
HeaderCell(stringResource(R.string.week_table_header_session), width = 90.dp, bg = TrailColors.HeaderBg)

// BEFORE:
HeaderCell("Label", width = 90.dp, bg = TrailColors.CardBg)
// AFTER:
HeaderCell(stringResource(R.string.week_table_header_label), width = 90.dp, bg = TrailColors.CardBg)

// BEFORE:
HeaderCell("Volume (km)", width = 90.dp, bg = TrailColors.CardBg)
// AFTER:
HeaderCell(stringResource(R.string.week_table_header_volume), width = 90.dp, bg = TrailColors.CardBg)

// BEFORE:
HeaderCell("Dénivelé (m)", width = 90.dp, bg = TrailColors.CardBg)
// AFTER:
HeaderCell(stringResource(R.string.week_table_header_elevation), width = 90.dp, bg = TrailColors.CardBg)

// BEFORE:
HeaderCell("Total", width = 70.dp, bg = TrailColors.HeaderBg, bold = true)
// AFTER:
HeaderCell(stringResource(R.string.week_table_header_total), width = 70.dp, bg = TrailColors.HeaderBg, bold = true)
```

The `"—"` (em-dash) for empty cells stays as-is — it's a symbol, not a word.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/components/WeekTable.kt
git commit -m "feat(i18n): migrate WeekTable"
```

---

## Task 4: KpiTiles.kt — NumberFormat + strings

**Files:**
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/components/KpiTiles.kt`

- [ ] **Step 1: Replace `formatDouble` with locale-aware NumberFormat**

Add import:
```kotlin
import java.text.NumberFormat
import java.util.Locale
```

Replace the `formatDouble` private function:
```kotlin
// BEFORE:
private fun formatDouble(v: Double): String {
    return if (v >= 100) "%,.0f".format(v).replace(",", " ")
    else if (v % 1.0 == 0.0) "%.0f".format(v)
    else "%.1f".format(v)
}

// AFTER:
private fun formatDouble(v: Double): String {
    val nf = NumberFormat.getInstance(Locale.getDefault())
    return if (v >= 100) {
        nf.maximumFractionDigits = 0
        nf.minimumFractionDigits = 0
        nf.format(v)
    } else if (v % 1.0 == 0.0) {
        nf.maximumFractionDigits = 0
        nf.minimumFractionDigits = 0
        nf.format(v)
    } else {
        nf.maximumFractionDigits = 1
        nf.minimumFractionDigits = 1
        nf.format(v)
    }
}
```

The `ProgressRow` composable uses the string template:
```kotlin
"$label • ${formatDouble(current)} / ${formatDouble(target)} ($pct%)"
```
This stays as-is — the bullet `•` and `%` are symbols, not words. The label is already passed in as a parameter from the call site, which will be localized in DashboardScreen (Task 8–12).

- [ ] **Step 2: Commit**

```bash
git add app/src/main/java/com/franck/trailcockpit/ui/components/KpiTiles.kt
git commit -m "feat(i18n): KpiTiles — locale-aware NumberFormat"
```

---

## Task 5: Charts.kt — strings + NumberFormat

**Files:**
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/components/Charts.kt`

- [ ] **Step 1: Find and replace the "Plage optimale" string in Charts.kt**

Search for `"Plage optimale"` in Charts.kt. Replace with `stringResource(R.string.hr_zone_optimal_range)` wherever it appears as a `Text()` argument.

Add import:
```kotlin
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
```

- [ ] **Step 2: Find and replace locale-hardcoded number formatters in Charts.kt**

Search Charts.kt for any occurrences of `"%,.0f"`, `"%.0f"`, `"%.1f"`, `"%.2f"` used in display functions. Replace each with `NumberFormat.getInstance(Locale.getDefault())` equivalents following the same pattern as Task 4.

Add import if not already present:
```kotlin
import java.text.NumberFormat
import java.util.Locale
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/franck/trailcockpit/ui/components/Charts.kt
git commit -m "feat(i18n): Charts — locale-aware formatting, translate legend"
```

---

## Task 6: DraftCards.kt migration

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/components/DraftCards.kt`

- [ ] **Step 1: Add draft strings to both XML files**

In `res/values/strings.xml`:
```xml
    <!-- draft cards -->
    <string name="draft_data_sources_title">Data sources</string>
    <string name="draft_data_sources_subtitle">The draft relies on the existing Excel workbook and temporarily keeps the push API.</string>
    <string name="draft_api_push_active">API push active</string>
    <string name="draft_api_push_inactive">API push inactive</string>
    <string name="draft_mode_push">Push mode</string>
    <string name="draft_mode_strava">Strava OAuth mode</string>
    <string name="draft_workbook_mapping_title">Excel file mapping</string>
    <string name="draft_workbook_mapping_subtitle">The most useful tabs have been translated into mobile app blocks.</string>
    <string name="draft_prep_cycles_title">Preparation cycles</string>
    <string name="draft_prep_cycles_subtitle">The workbook already contains the season breakdown. We can reuse it as-is in the app.</string>
    <string name="draft_delivery_title">Delivery plan</string>
    <string name="draft_delivery_subtitle">The draft sets up mobile UX and business mapping. Next step is real Strava auth.</string>
    <string name="draft_recent_activities_title">Last detected activities</string>
    <string name="draft_recent_activities_subtitle">Preview aligned with the Activities tab of the source file.</string>
    <string name="draft_strava_title">Strava connection</string>
    <string name="draft_strava_athlete">Athlete</string>
    <string name="draft_strava_auth">Auth</string>
    <string name="draft_strava_status">Status</string>
    <string name="draft_strava_connected">Connected</string>
    <string name="draft_strava_pending">To connect</string>
    <string name="draft_strava_button_connect">Connect Strava</string>
    <string name="draft_strava_button_reconnect">Reconnect Strava</string>
    <string name="draft_suffer_score">Suffer %d</string>
    <string name="draft_file_ref">Reference file: %s</string>
    <string name="draft_transition_mode">Transition mode: %s</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- draft cards -->
    <string name="draft_data_sources_title">Sources de données</string>
    <string name="draft_data_sources_subtitle">Le draft s\'appuie sur le classeur Excel existant et conserve temporairement l\'API push.</string>
    <string name="draft_api_push_active">API push active</string>
    <string name="draft_api_push_inactive">API push inactive</string>
    <string name="draft_mode_push">Mode push</string>
    <string name="draft_mode_strava">Mode Strava OAuth</string>
    <string name="draft_workbook_mapping_title">Mapping du fichier Excel</string>
    <string name="draft_workbook_mapping_subtitle">Les onglets les plus utiles ont été traduits en blocs d\'application mobile.</string>
    <string name="draft_prep_cycles_title">Cycles de préparation</string>
    <string name="draft_prep_cycles_subtitle">Le classeur contient déjà le découpage de saison. On peut donc le reprendre tel quel dans l\'app.</string>
    <string name="draft_delivery_title">Plan de livraison</string>
    <string name="draft_delivery_subtitle">Le draft pose l\'UX mobile et le mapping métier. L\'étape suivante est l\'auth Strava réelle.</string>
    <string name="draft_recent_activities_title">Dernières activités détectées</string>
    <string name="draft_recent_activities_subtitle">Aperçu aligné sur l\'onglet Activities du fichier source.</string>
    <string name="draft_strava_title">Connexion Strava</string>
    <string name="draft_strava_athlete">Athlète</string>
    <string name="draft_strava_auth">Auth</string>
    <string name="draft_strava_status">Statut</string>
    <string name="draft_strava_connected">Connecté</string>
    <string name="draft_strava_pending">À connecter</string>
    <string name="draft_strava_button_connect">Connecter Strava</string>
    <string name="draft_strava_button_reconnect">Reconnecter Strava</string>
    <string name="draft_suffer_score">Suffer %d</string>
    <string name="draft_file_ref">Fichier de référence : %s</string>
    <string name="draft_transition_mode">Mode de transition : %s</string>
```

- [ ] **Step 2: Migrate `DraftCards.kt`**

Add imports:
```kotlin
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
```

Apply the following replacements throughout the file:

```kotlin
"Sources de donnees" → stringResource(R.string.draft_data_sources_title)
"Le draft s'appuie sur le classeur Excel existant..." → stringResource(R.string.draft_data_sources_subtitle)
if (source.apiPushEnabled) "API push active" else "API push inactive"
  → if (source.apiPushEnabled) stringResource(R.string.draft_api_push_active)
     else stringResource(R.string.draft_api_push_inactive)
"Mode push" → stringResource(R.string.draft_mode_push)
"Mode Strava OAuth" → stringResource(R.string.draft_mode_strava)
"Fichier de reference: ${source.workbook.fileName}" → stringResource(R.string.draft_file_ref, source.workbook.fileName)
"Mode de transition: ${source.nextSyncWindow}" → stringResource(R.string.draft_transition_mode, source.nextSyncWindow)
"Mapping du fichier Excel" → stringResource(R.string.draft_workbook_mapping_title)
"Les onglets les plus utiles..." → stringResource(R.string.draft_workbook_mapping_subtitle)
"Cycles de preparation" → stringResource(R.string.draft_prep_cycles_title)
"Le classeur contient deja..." → stringResource(R.string.draft_prep_cycles_subtitle)
"Plan de livraison" → stringResource(R.string.draft_delivery_title)
"Le draft pose l'UX mobile..." → stringResource(R.string.draft_delivery_subtitle)
"Dernieres activites detectees" → stringResource(R.string.draft_recent_activities_title)
"Aperçu aligné sur l'onglet Activities..." → stringResource(R.string.draft_recent_activities_subtitle)
"Connexion Strava" → stringResource(R.string.draft_strava_title)
"Athlete" → stringResource(R.string.draft_strava_athlete)
"Auth" → stringResource(R.string.draft_strava_auth)
"Statut" → stringResource(R.string.draft_strava_status)
"Connecte" → stringResource(R.string.draft_strava_connected)
"A connecter" → stringResource(R.string.draft_strava_pending)
"Connecter Strava" → stringResource(R.string.draft_strava_button_connect)
"Reconnecter Strava" → stringResource(R.string.draft_strava_button_reconnect)
"Suffer ${activity.sufferScore}" → stringResource(R.string.draft_suffer_score, activity.sufferScore)
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/components/DraftCards.kt
git commit -m "feat(i18n): migrate DraftCards"
```

---

## Task 7: DashboardScreen — enums + tab labels + editableActivityTypes

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (lines 161–236, 5653–5662)

This task migrates the enums and the activity type map. All later DashboardScreen tasks build on it.

- [ ] **Step 1: Add dashboard enum strings to both XML files**

In `res/values/strings.xml`:
```xml
    <!-- dashboard tabs -->
    <string name="dashboard_tab_cockpit">Cockpit</string>
    <string name="dashboard_tab_stats">Stats</string>
    <string name="dashboard_tab_charge">Charge</string>
    <string name="dashboard_tab_plan">Plan</string>
    <string name="dashboard_tab_activities">Activities</string>
    <string name="dashboard_tab_settings">Settings</string>

    <!-- cockpit block display names -->
    <string name="block_kpis">KPIs &amp; Volume</string>
    <string name="block_goals">Goals</string>
    <string name="block_chart">Chart</string>
    <string name="block_history">History</string>
    <string name="block_km_dplus">Cumulative Km &amp; Elevation</string>
    <string name="block_cumul_months">Monthly km total</string>
    <string name="block_load">Load</string>
    <string name="block_intensities">Intensities</string>
    <string name="block_strava">Strava Sync</string>
    <string name="block_all_activities">All activities</string>

    <!-- chart period -->
    <string name="chart_period_week">Week</string>
    <string name="chart_period_month">Month</string>
    <string name="chart_period_month_year">Month (year)</string>

    <!-- stats metric -->
    <string name="stats_metric_km">Km</string>
    <string name="stats_metric_dplus">D+</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- dashboard tabs -->
    <string name="dashboard_tab_cockpit">Cockpit</string>
    <string name="dashboard_tab_stats">Stats</string>
    <string name="dashboard_tab_charge">Charge</string>
    <string name="dashboard_tab_plan">Plan</string>
    <string name="dashboard_tab_activities">Activités</string>
    <string name="dashboard_tab_settings">Réglages</string>

    <!-- cockpit block display names -->
    <string name="block_kpis">KPIs &amp; Volume</string>
    <string name="block_goals">Objectifs</string>
    <string name="block_chart">Graphique</string>
    <string name="block_history">Historique</string>
    <string name="block_km_dplus">Km &amp; D+ cumulés</string>
    <string name="block_cumul_months">Cumul km par mois</string>
    <string name="block_load">Charge</string>
    <string name="block_intensities">Intensités</string>
    <string name="block_strava">Sync Strava</string>
    <string name="block_all_activities">Toutes activités</string>

    <!-- chart period -->
    <string name="chart_period_week">Semaine</string>
    <string name="chart_period_month">Mois</string>
    <string name="chart_period_month_year">Mois (année)</string>

    <!-- stats metric -->
    <string name="stats_metric_km">Km</string>
    <string name="stats_metric_dplus">D+</string>
```

- [ ] **Step 2: Add `@StringRes` to enums in `DashboardScreen.kt`**

Add import at top of file:
```kotlin
import androidx.annotation.StringRes
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
```

Replace enum declarations (lines ~161–187):
```kotlin
// BEFORE:
private enum class DashboardTab(val label: String) {
    Cockpit("Cockpit"), Stats("Stats"), Charge("Charge"),
    Plan("Plan"), Activities("Activités"), Settings("Réglages")
}

// AFTER:
private enum class DashboardTab(@StringRes val labelRes: Int) {
    Cockpit(R.string.dashboard_tab_cockpit),
    Stats(R.string.dashboard_tab_stats),
    Charge(R.string.dashboard_tab_charge),
    Plan(R.string.dashboard_tab_plan),
    Activities(R.string.dashboard_tab_activities),
    Settings(R.string.dashboard_tab_settings)
}

// BEFORE:
private enum class ChartPeriod(val label: String) {
    Week("Semaine"), Month("Mois"), MonthYear("Mois (année)")
}

// AFTER:
private enum class ChartPeriod(@StringRes val labelRes: Int) {
    Week(R.string.chart_period_week),
    Month(R.string.chart_period_month),
    MonthYear(R.string.chart_period_month_year)
}

// BEFORE:
private enum class SportMode(val label: String, val icon: String) {
    Run("Running", "🏃"), Bike("Vélo", "🚴"), Swim("Natation", "🏊")
}

// AFTER:
private enum class SportMode(@StringRes val labelRes: Int, val icon: String) {
    Run(R.string.sport_run, "🏃"),
    Bike(R.string.sport_bike, "🚴"),
    Swim(R.string.sport_swim, "🏊")
}
```

- [ ] **Step 3: Convert `CockpitBlock.displayName()` to `@Composable`**

Replace the function at lines ~217–236:
```kotlin
// BEFORE (non-composable):
private fun CockpitBlock.displayName(): String { ... }

// AFTER:
@Composable
private fun CockpitBlock.displayName(): String {
    val base = when (type) {
        BlockType.Kpis -> stringResource(R.string.block_kpis)
        BlockType.Goals -> stringResource(R.string.block_goals)
        BlockType.Chart -> stringResource(R.string.block_chart)
        BlockType.Days -> stringResource(R.string.block_history)
        BlockType.KmDPlus -> stringResource(R.string.block_km_dplus)
        BlockType.CumulMonths -> stringResource(R.string.block_cumul_months)
        BlockType.Load -> stringResource(R.string.block_load)
        BlockType.Intensity -> stringResource(R.string.block_intensities)
        BlockType.Strava -> stringResource(R.string.block_strava)
    }
    val allActivities = stringResource(R.string.block_all_activities)
    return when {
        type == BlockType.Strava -> base
        type == BlockType.KmDPlus -> base
        type == BlockType.CumulMonths -> if (sport != null) "$base — ${stringResource(sport.labelRes)}" else "$base — $allActivities"
        sport != null -> "$base — ${stringResource(sport.labelRes)}"
        else -> "$base — $allActivities"
    }
}
```

- [ ] **Step 4: Migrate `editableActivityTypes` to use `@StringRes`**

First, check the definition of `ActivityTypeOption` (search the file or data package for it). It has `value: String, label: String`. Change it to use `@StringRes`:

If `ActivityTypeOption` is defined inside `DashboardScreen.kt`, replace:
```kotlin
// Wherever ActivityTypeOption is defined:
private data class ActivityTypeOption(val value: String, val label: String)

// Change to:
private data class ActivityTypeOption(val value: String, @StringRes val labelRes: Int)
```

Replace `editableActivityTypes` (lines ~5653–5662):
```kotlin
// BEFORE:
private val editableActivityTypes = listOf(
    ActivityTypeOption("Run", "Course"),
    ActivityTypeOption("TrailRun", "Trail"),
    ActivityTypeOption("Walk", "Marche"),
    ActivityTypeOption("Hike", "Randonnée"),
    ActivityTypeOption("Ride", "Vélo"),
    ActivityTypeOption("VirtualRide", "Vélo virtuel"),
    ActivityTypeOption("EBikeRide", "Vélo électrique"),
    ActivityTypeOption("Swim", "Natation")
)

// AFTER:
private val editableActivityTypes = listOf(
    ActivityTypeOption("Run", R.string.sport_run_type_run),
    ActivityTypeOption("TrailRun", R.string.sport_run_type_trail),
    ActivityTypeOption("Walk", R.string.sport_run_type_walk),
    ActivityTypeOption("Hike", R.string.sport_run_type_hike),
    ActivityTypeOption("Ride", R.string.sport_bike_type_ride),
    ActivityTypeOption("VirtualRide", R.string.sport_bike_type_virtual),
    ActivityTypeOption("EBikeRide", R.string.sport_bike_type_ebike),
    ActivityTypeOption("Swim", R.string.sport_swim_type)
)
```

In the non-composable `displayActivityType()` function: this now returns a `@StringRes Int`. Change the function to accept a `Context`:
```kotlin
// BEFORE:
private fun displayActivityType(type: String): String {
    return editableActivityTypes.firstOrNull { it.value == type }?.label ?: type
}

// AFTER — accept context for non-composable usage:
private fun displayActivityType(type: String, context: android.content.Context): String {
    val res = editableActivityTypes.firstOrNull { it.value == type }?.labelRes ?: return type
    return context.getString(res)
}
```

All call sites of `displayActivityType()` inside composables: replace with the `@Composable` version:
```kotlin
// In composable call sites, replace:
displayActivityType(activity.type)
// With:
editableActivityTypes.firstOrNull { it.value == activity.type }
    ?.let { stringResource(it.labelRes) } ?: activity.type
```

In any non-composable call sites, pass `LocalContext.current` captured earlier.

Update all tab label usages. Search for `.label` on enums and replace with `stringResource(.labelRes)`. Examples:
```kotlin
// Tab rendering (search for DashboardTab.entries or tab.label):
Text(tab.label) → Text(stringResource(tab.labelRes))

// ChartPeriod selector:
Text(period.label) → Text(stringResource(period.labelRes))

// SportMode label:
Text(mode.label) → Text(stringResource(mode.labelRes))
"${mode.icon} ${mode.label}" → "${mode.icon} ${stringResource(mode.labelRes)}"
```

- [ ] **Step 5: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen — enums, tab labels, activity types"
```

---

## Task 8: DashboardScreen — Cockpit tab strings

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (Cockpit tab composable)

- [ ] **Step 1: Add cockpit strings to both XML files**

In `res/values/strings.xml`:
```xml
    <!-- cockpit tab -->
    <string name="cockpit_all_activities_title">Km &amp; Elevation — All activities</string>
    <string name="cockpit_strava_connected">Account connected</string>
    <string name="cockpit_strava_pending">Connection pending</string>
    <string name="cockpit_sync_ready">User sync ready for next step.</string>
    <string name="cockpit_strava_connect">Connect Strava</string>
    <string name="cockpit_strava_reconnect">Reconnect Strava</string>
    <string name="cockpit_strava_connected_label">Connected</string>
    <string name="cockpit_strava_not_connected">Not connected</string>
    <string name="cockpit_strava_oauth_status">OAuth status</string>
    <string name="cockpit_strava_athlete">Athlete</string>
    <string name="cockpit_goals_title">Goals</string>
    <string name="cockpit_goals_bike_title">Cycling goals</string>
    <string name="cockpit_goals_swim_title">Swimming goals</string>
    <string name="cockpit_goals_set">Set goals</string>
    <string name="cockpit_goals_annual_km">Annual cumulative target — km</string>
    <string name="cockpit_goals_all_km">Total km all activities (year)</string>
    <string name="cockpit_add_block">Add a block</string>
    <string name="cockpit_configure_block">Configure block</string>
    <string name="cockpit_block_hidden">Block will be hidden in Cockpit.</string>
    <string name="cockpit_fav_metrics">Favorite metrics</string>
    <string name="cockpit_shown_first">Shown first in Cockpit</string>
    <string name="cockpit_uncheck_hides_block">Uncheck all to hide this block in Cockpit</string>
    <string name="cockpit_period_label">History period</string>
    <string name="cockpit_period_10w">10 weeks</string>
    <string name="cockpit_period_12m">12 months</string>
    <string name="cockpit_period_16w">16-week summary</string>
    <string name="cockpit_chart_period">Chart period</string>
    <string name="cockpit_default_activity">Default activity</string>
    <string name="cockpit_choose_type">Choose type</string>
    <string name="cockpit_choose_pace">Choose pace</string>
    <string name="cockpit_choose_duration">Choose duration</string>
    <string name="cockpit_choose_sport">Choose a sport.</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- cockpit tab -->
    <string name="cockpit_all_activities_title">Km &amp; D+ cumulés — Toutes activités</string>
    <string name="cockpit_strava_connected">Compte connecté</string>
    <string name="cockpit_strava_pending">Connexion en attente</string>
    <string name="cockpit_sync_ready">La sync utilisateur est prête pour la suite.</string>
    <string name="cockpit_strava_connect">Connecter Strava</string>
    <string name="cockpit_strava_reconnect">Reconnecter Strava</string>
    <string name="cockpit_strava_connected_label">Connecté</string>
    <string name="cockpit_strava_not_connected">Non connecté</string>
    <string name="cockpit_strava_oauth_status">Statut OAuth</string>
    <string name="cockpit_strava_athlete">Athlète</string>
    <string name="cockpit_goals_title">Objectifs</string>
    <string name="cockpit_goals_bike_title">Objectifs Vélo</string>
    <string name="cockpit_goals_swim_title">Objectifs Natation</string>
    <string name="cockpit_goals_set">Régler les objectifs</string>
    <string name="cockpit_goals_annual_km">Objectif cumulé (année) — km</string>
    <string name="cockpit_goals_all_km">Total km toutes activités (année)</string>
    <string name="cockpit_add_block">Ajouter un bloc</string>
    <string name="cockpit_configure_block">Configurer le bloc</string>
    <string name="cockpit_block_hidden">Le bloc sera masqué dans le Cockpit.</string>
    <string name="cockpit_fav_metrics">Choix des métriques favorites</string>
    <string name="cockpit_shown_first">Affichée en premier dans le Cockpit</string>
    <string name="cockpit_uncheck_hides_block">Tout décocher masque ce bloc dans le Cockpit</string>
    <string name="cockpit_period_label">Période de l\'historique</string>
    <string name="cockpit_period_10w">10 semaines</string>
    <string name="cockpit_period_12m">12 mois</string>
    <string name="cockpit_period_16w">Récap 16 semaines</string>
    <string name="cockpit_chart_period">Période du graphique</string>
    <string name="cockpit_default_activity">Activité par défaut</string>
    <string name="cockpit_choose_type">Choisir le type</string>
    <string name="cockpit_choose_pace">Choisir l\'allure</string>
    <string name="cockpit_choose_duration">Choisir la durée</string>
    <string name="cockpit_choose_sport">Choisis un sport.</string>
```

- [ ] **Step 2: Migrate Cockpit tab composable in `DashboardScreen.kt`**

Search the file for the `CockpitTab` (or similar) composable function. Apply the following replacements using `stringResource()`:

```kotlin
"Km & D+ cumulés — Toutes activités" or "Km & D+ cumulés" variations
  → stringResource(R.string.cockpit_all_activities_title)
"Compte connecté" → stringResource(R.string.cockpit_strava_connected)
"Connexion en attente" → stringResource(R.string.cockpit_strava_pending)
"La sync utilisateur est prête pour la suite." → stringResource(R.string.cockpit_sync_ready)
"Connecter Strava" → stringResource(R.string.cockpit_strava_connect)
"Reconnecter Strava" → stringResource(R.string.cockpit_strava_reconnect)
"Connecté" → stringResource(R.string.cockpit_strava_connected_label)
"Non connecté" → stringResource(R.string.cockpit_strava_not_connected)
"Statut OAuth" → stringResource(R.string.cockpit_strava_oauth_status)
"Athlète" → stringResource(R.string.cockpit_strava_athlete)
"Objectifs" (section title) → stringResource(R.string.cockpit_goals_title)
"Objectifs Vélo" → stringResource(R.string.cockpit_goals_bike_title)
"Objectifs Natation" → stringResource(R.string.cockpit_goals_swim_title)
"Régler les objectifs" → stringResource(R.string.cockpit_goals_set)
"Objectif cumulé (année) — km" → stringResource(R.string.cockpit_goals_annual_km)
"Total km toutes activités (année)" → stringResource(R.string.cockpit_goals_all_km)
"Ajouter un bloc" → stringResource(R.string.cockpit_add_block)
"Configurer le bloc" → stringResource(R.string.cockpit_configure_block)
"Le bloc sera masqué dans le Cockpit." → stringResource(R.string.cockpit_block_hidden)
"Choix des métriques favorites" → stringResource(R.string.cockpit_fav_metrics)
"Affichée en premier dans le Cockpit" → stringResource(R.string.cockpit_shown_first)
"Tout décocher masque ce bloc dans le Cockpit" → stringResource(R.string.cockpit_uncheck_hides_block)
"Période de l'historique" → stringResource(R.string.cockpit_period_label)
"10 semaines" → stringResource(R.string.cockpit_period_10w)
"12 mois" → stringResource(R.string.cockpit_period_12m)
"Récap 16 semaines" → stringResource(R.string.cockpit_period_16w)
"Période du graphique" → stringResource(R.string.cockpit_chart_period)
"Activité par défaut" → stringResource(R.string.cockpit_default_activity)
"Choisir le type" → stringResource(R.string.cockpit_choose_type)
"Choisir l'allure" → stringResource(R.string.cockpit_choose_pace)
"Choisir la durée" → stringResource(R.string.cockpit_choose_duration)
"Choisis un sport." → stringResource(R.string.cockpit_choose_sport)
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen Cockpit tab"
```

---

## Task 9: DashboardScreen — Stats tab strings

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (Stats tab)

- [ ] **Step 1: Add stats strings**

In `res/values/strings.xml`:
```xml
    <!-- stats tab -->
    <string name="stats_km_dplus_title">Cumulative Km &amp; Elevation</string>
    <string name="stats_km_monthly_title">Monthly cumulative km</string>
    <string name="stats_weekly_label">Weekly</string>
    <string name="stats_history_label">History</string>
    <string name="stats_period_label">Period</string>
    <string name="stats_n1">N-1</string>
    <string name="stats_n2">N-2</string>
    <string name="stats_n3">N-3</string>
    <string name="stats_n4">N-4</string>
    <string name="stats_current_week">Current week</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- stats tab -->
    <string name="stats_km_dplus_title">Km &amp; D+ cumulés</string>
    <string name="stats_km_monthly_title">Cumul km par mois</string>
    <string name="stats_weekly_label">Hebdomadaire</string>
    <string name="stats_history_label">Historique</string>
    <string name="stats_period_label">Période</string>
    <string name="stats_n1">N-1</string>
    <string name="stats_n2">N-2</string>
    <string name="stats_n3">N-3</string>
    <string name="stats_n4">N-4</string>
    <string name="stats_current_week">S en cours</string>
```

- [ ] **Step 2: Migrate Stats tab in `DashboardScreen.kt`**

Search for the Stats tab composable function. Apply:
```kotlin
"Km & D+ cumulés" (chart title) → stringResource(R.string.stats_km_dplus_title)
"Cumul km par mois" → stringResource(R.string.stats_km_monthly_title)
"Hebdomadaire" → stringResource(R.string.stats_weekly_label)
"Historique" (section) → stringResource(R.string.stats_history_label)
"Période" (period label) → stringResource(R.string.stats_period_label)
"N-1", "N-2", "N-3", "N-4" → stringResource(R.string.stats_n1) etc.
"S en cours" → stringResource(R.string.stats_current_week)
```

Month abbreviations array (search for `listOf("janv"` or similar):
```kotlin
// BEFORE: any hardcoded month abbreviation list
val months = listOf("janv", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc")

// AFTER:
import java.time.Month
import java.time.format.TextStyle
import java.util.Locale

val months = (1..12).map { i ->
    Month.of(i).getDisplayName(TextStyle.SHORT, Locale.getDefault())
}
```

Add the import at the top of DashboardScreen.kt if not already present:
```kotlin
import java.time.Month
import java.time.format.TextStyle
import java.util.Locale
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen Stats tab"
```

---

## Task 10: DashboardScreen — Charge tab strings

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (Charge tab)

- [ ] **Step 1: Add charge tab strings**

In `res/values/strings.xml`:
```xml
    <!-- charge tab -->
    <string name="charge_weekly_title">Weekly training load</string>
    <string name="charge_fatigue_fitness_title">Fatigue vs Fitness — 16 weeks</string>
    <string name="charge_freshness_title">Freshness</string>
    <string name="charge_intensity_title">Intensity distribution — 30-day rolling</string>
    <string name="charge_intensity_run_title">Intensity distribution — 30-day rolling (RUN)</string>
    <string name="charge_fatigue_7d">7d fatigue</string>
    <string name="charge_fitness_28d">28d fitness</string>
    <string name="charge_tsb_label">TSB Form / Fatigue</string>
    <string name="charge_training_capacity">Training capacity</string>
    <string name="charge_training_load">Training load</string>
    <string name="charge_recovery">Recovery</string>
    <string name="charge_form_state">Fitness state</string>
    <string name="charge_very_fresh">Very fresh</string>
    <string name="charge_fresh">Fresh</string>
    <string name="charge_balanced">Balanced</string>
    <string name="charge_recent_fatigue">Recent fatigue</string>
    <string name="charge_very_low">Very low</string>
    <string name="charge_fit">Fit</string>
    <string name="charge_excellent">Excellent</string>
    <string name="charge_good">Good</string>
    <string name="charge_low">Low</string>
    <string name="charge_loaded">Loaded</string>
    <string name="charge_overloaded">Overloaded</string>
    <string name="charge_insufficient_data">Insufficient data. Follow the plan carefully.</string>
    <string name="charge_moderate">Moderate load</string>
    <string name="charge_balanced_msg">Balanced load. Follow the plan normally.</string>
    <string name="charge_rising_fatigue">Rising fatigue. Reduce volume or do easy endurance.</string>
    <string name="charge_well_rested">Well rested. Ideal for an intense session.</string>
    <string name="charge_good_balance">Good balance. The 30-min field test can further improve accuracy.</string>
    <string name="charge_interpretation_tips">Interpretation tips</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- charge tab -->
    <string name="charge_weekly_title">Charge hebdomadaire</string>
    <string name="charge_fatigue_fitness_title">Fatigue vs Capacité — 16 sem</string>
    <string name="charge_freshness_title">Fraîcheur</string>
    <string name="charge_intensity_title">Répartition intensité — 30j glissants</string>
    <string name="charge_intensity_run_title">Répartition intensités — 30j glissants (RUN)</string>
    <string name="charge_fatigue_7d">Fatigue 7j</string>
    <string name="charge_fitness_28d">Fitness 28j</string>
    <string name="charge_tsb_label">TSB Forme / Fatigue</string>
    <string name="charge_training_capacity">Capacité d\'entraînement</string>
    <string name="charge_training_load">Charge d\'entraînement</string>
    <string name="charge_recovery">Récupération</string>
    <string name="charge_form_state">État de forme</string>
    <string name="charge_very_fresh">Très frais</string>
    <string name="charge_fresh">Frais</string>
    <string name="charge_balanced">Équilibré</string>
    <string name="charge_recent_fatigue">Fatigue récente</string>
    <string name="charge_very_low">Très faible</string>
    <string name="charge_fit">En forme</string>
    <string name="charge_excellent">Excellente</string>
    <string name="charge_good">Bonne</string>
    <string name="charge_low">Faible</string>
    <string name="charge_loaded">Chargé</string>
    <string name="charge_overloaded">Surchargé</string>
    <string name="charge_insufficient_data">Données insuffisantes. Suis le plan avec prudence.</string>
    <string name="charge_moderate">Charge modérée</string>
    <string name="charge_balanced_msg">Charge équilibrée. Suis le plan normalement.</string>
    <string name="charge_rising_fatigue">Fatigue en hausse. Réduis le volume ou fais de l\'endurance.</string>
    <string name="charge_well_rested">Tu es bien reposé. Idéal pour une séance intense.</string>
    <string name="charge_good_balance">Bon compromis. Le test terrain de 30 minutes peut encore améliorer la précision.</string>
    <string name="charge_interpretation_tips">Conseils d\'interprétation</string>
```

- [ ] **Step 2: Migrate Charge tab in `DashboardScreen.kt`**

Search for the Charge tab composable. Apply `stringResource(R.string.charge_*)` for each label. Pattern:
```kotlin
"Charge hebdomadaire" → stringResource(R.string.charge_weekly_title)
"Fatigue vs Capacité — 16 sem" → stringResource(R.string.charge_fatigue_fitness_title)
"Fraîcheur" → stringResource(R.string.charge_freshness_title)
"Répartition intensité — 30j glissants" → stringResource(R.string.charge_intensity_title)
"Répartition intensités — 30j glissants (RUN)" → stringResource(R.string.charge_intensity_run_title)
"Fatigue 7j" → stringResource(R.string.charge_fatigue_7d)
"Fitness 28j" → stringResource(R.string.charge_fitness_28d)
"TSB Forme / Fatigue" → stringResource(R.string.charge_tsb_label)
"Capacité d'entraînement" → stringResource(R.string.charge_training_capacity)
"Charge d'entraînement" → stringResource(R.string.charge_training_load)
"Récupération" → stringResource(R.string.charge_recovery)
"État de forme" → stringResource(R.string.charge_form_state)
"Très frais" → stringResource(R.string.charge_very_fresh)
"Frais" → stringResource(R.string.charge_fresh)
"Équilibré" → stringResource(R.string.charge_balanced)
"Fatigue récente" → stringResource(R.string.charge_recent_fatigue)
"Très faible" → stringResource(R.string.charge_very_low)
"En forme" → stringResource(R.string.charge_fit)
"Excellente" → stringResource(R.string.charge_excellent)
"Bonne" → stringResource(R.string.charge_good)
"Faible" → stringResource(R.string.charge_low)
"Chargé" → stringResource(R.string.charge_loaded)
"Surchargé" → stringResource(R.string.charge_overloaded)
"Données insuffisantes. Suis le plan avec prudence." → stringResource(R.string.charge_insufficient_data)
"Charge modérée" → stringResource(R.string.charge_moderate)
"Charge équilibrée. Suis le plan normalement." → stringResource(R.string.charge_balanced_msg)
"Fatigue en hausse. Réduis le volume..." → stringResource(R.string.charge_rising_fatigue)
"Tu es bien reposé. Idéal pour une séance intense." → stringResource(R.string.charge_well_rested)
"Bon compromis. Le test terrain de 30 minutes..." → stringResource(R.string.charge_good_balance)
"Conseils d'interprétation" → stringResource(R.string.charge_interpretation_tips)
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen Charge tab"
```

---

## Task 11: DashboardScreen — Activities tab strings

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (Activities tab)

- [ ] **Step 1: Add activities strings**

In `res/values/strings.xml`:
```xml
    <!-- activities tab -->
    <string name="activities_title">Activities</string>
    <string name="activities_single">Activity</string>
    <string name="activities_detail_title">Activity detail</string>
    <string name="activities_edit_title">Edit activity</string>
    <string name="activities_field_title">Title</string>
    <string name="activities_field_distance">Distance (km)</string>
    <string name="activities_field_duration">Duration (min:sec)</string>
    <string name="activities_field_elevation">Elevation gain (m)</string>
    <string name="activities_field_pace">Pace</string>
    <string name="activities_field_speed">Avg speed</string>
    <string name="activities_search_by">Search by</string>
    <string name="activities_sort_filter">Sort and filter</string>
    <string name="activities_filter_label">Filter</string>
    <string name="activities_sort_label">Sort: %1$s %2$s</string>
    <string name="activities_to_display">Activities to display</string>
    <string name="activities_drag_map">Drag and zoom the map</string>
    <string name="activities_zoom_in">Zoom in</string>
    <string name="activities_zoom_out">Zoom out</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- activities tab -->
    <string name="activities_title">Activités</string>
    <string name="activities_single">Activité</string>
    <string name="activities_detail_title">Détail activité</string>
    <string name="activities_edit_title">Modifier l\'activité</string>
    <string name="activities_field_title">Titre</string>
    <string name="activities_field_distance">Distance (km)</string>
    <string name="activities_field_duration">Durée (min:sec)</string>
    <string name="activities_field_elevation">Dénivelé positif (m)</string>
    <string name="activities_field_pace">Allure</string>
    <string name="activities_field_speed">Vitesse moy.</string>
    <string name="activities_search_by">Rechercher par</string>
    <string name="activities_sort_filter">Trier et filtrer</string>
    <string name="activities_filter_label">Filtre</string>
    <string name="activities_sort_label">Tri: %1$s %2$s</string>
    <string name="activities_to_display">Activités à afficher</string>
    <string name="activities_drag_map">Déplace et zoome la carte</string>
    <string name="activities_zoom_in">Zoomer</string>
    <string name="activities_zoom_out">Dézoomer</string>
```

- [ ] **Step 2: Migrate Activities tab in `DashboardScreen.kt`**

Apply `stringResource()` for each label. Key replacements:
```kotlin
"Activités" (tab/section title) → stringResource(R.string.activities_title)
"Activité" → stringResource(R.string.activities_single)
"Détail activité" → stringResource(R.string.activities_detail_title)
"Modifier l'activité" → stringResource(R.string.activities_edit_title)
"Titre" (field) → stringResource(R.string.activities_field_title)
"Distance (km)" → stringResource(R.string.activities_field_distance)
"Durée (min:sec)" or "Durée (min ou min:sec)" → stringResource(R.string.activities_field_duration)
"Dénivelé positif (m)" → stringResource(R.string.activities_field_elevation)
"Allure" → stringResource(R.string.activities_field_pace)
"Vitesse moy." → stringResource(R.string.activities_field_speed)
"Rechercher par" → stringResource(R.string.activities_search_by)
"Trier et filtrer" → stringResource(R.string.activities_sort_filter)
"Filtre" → stringResource(R.string.activities_filter_label)
"Tri: ${filter.criterion.label} $arrow" → stringResource(R.string.activities_sort_label, filter.criterion.label, arrow)
"Activités à afficher" → stringResource(R.string.activities_to_display)
"Déplace et zoome la carte" → stringResource(R.string.activities_drag_map)
"Zoomer" → stringResource(R.string.activities_zoom_in)
"Dézoomer" → stringResource(R.string.activities_zoom_out)
```

Error strings inside non-composable callbacks — pre-fetch at composable scope:
```kotlin
val errInvalidTitle = stringResource(R.string.error_invalid_title)
val errInvalidDistance = stringResource(R.string.error_invalid_distance)
val errInvalidDuration = stringResource(R.string.error_invalid_duration)
val errActivityLoad = stringResource(R.string.error_activity_load_failed)

// Then in validation logic, use these vals instead of hardcoded strings
```

Also: `fourthMetricForActivity()` returns `ActivityMetricSpec(label = "Vitesse moy.", ...)`. Convert to `@Composable` or pass strings as parameters. Simplest approach — convert to a `@Composable` function:
```kotlin
@Composable
private fun fourthMetricForActivity(activity: ActivityDraft): ActivityMetricSpec {
    return when {
        isBikeActivityType(activity.type) -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_speed),
            value = formatSpeed(activity.distanceKm, activity.movingTimeMin),
            unit = stringResource(R.string.unit_km_h)
        )
        isSwimActivityType(activity.type) -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_pace),
            value = formatSwimPace(activity.distanceKm, activity.movingTimeMin),
            unit = stringResource(R.string.unit_swim_pace)
        )
        else -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_pace),
            value = formatPace(activity.paceMinPerKm),
            unit = stringResource(R.string.unit_per_km)
        )
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen Activities tab"
```

---

## Task 12: DashboardScreen — Settings tab strings (profile, HR zones, HR test, Strava, preferences)

**Files:**
- Modify: `app/src/main/res/values/strings.xml`
- Modify: `app/src/main/res/values-fr/strings.xml`
- Modify: `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt` (Settings tab + HeartRateTestProtocolScreen + AthleteProfileScreen)

- [ ] **Step 1: Add settings strings to both XML files**

In `res/values/strings.xml`:
```xml
    <!-- settings tab -->
    <string name="settings_title">Settings</string>
    <string name="settings_account_section">Account &amp; sync</string>
    <string name="settings_account_subtitle">Account management and data export</string>
    <string name="settings_appearance_section">Appearance</string>
    <string name="settings_appearance_subtitle">Units, zones, heart rate and thresholds</string>
    <string name="settings_startup_screen">Startup screen</string>
    <string name="settings_data_source">Active data source</string>
    <string name="settings_stats_granularity">Stats granularity</string>
    <string name="settings_logout">Sign out</string>
    <string name="settings_strava_notifications">Strava sync notifications</string>
    <string name="settings_cockpit_prefs">Cockpit preferences</string>

    <!-- athlete profile -->
    <string name="profile_title">Athletic profile</string>
    <string name="profile_description">This profile calibrates heart rate zones and helps interpret effort level.</string>
    <string name="profile_help_text">This info improves estimates if you don\'t enter your zones directly.</string>
    <string name="profile_zone_method">Zone calculation method</string>
    <string name="profile_manual_mode">I enter my values</string>
    <string name="profile_manual_mode_desc">Profile fields are used directly to calculate your zones.</string>
    <string name="profile_auto_mode">Infer automatically</string>
    <string name="profile_auto_mode_desc">The app can fill missing values using age or available history.</string>
    <string name="profile_values_source">Values source</string>
    <string name="profile_cardio_data">Heart rate data</string>
    <string name="profile_weight">Weight (kg)</string>
    <string name="profile_birth_year">Birth year</string>
    <string name="profile_weight_placeholder">e.g. 72</string>
    <string name="profile_birth_year_placeholder">e.g. 1985</string>
    <string name="profile_hr_rest">Resting HR</string>
    <string name="profile_hr_max">Max HR</string>
    <string name="profile_hr_reserve">HR reserve</string>
    <string name="profile_hr_lthr_test">Threshold HR — 30-min test</string>
    <string name="profile_hr_abbr">HR</string>
    <string name="profile_hr_max_estimated">Estimated max HR</string>
    <string name="profile_enter_lthr">Enter my threshold HR</string>
    <string name="profile_view_test_protocol">View 30-min test protocol</string>

    <!-- HR test protocol -->
    <string name="hr_test_title">30-minute field test protocol</string>
    <string name="hr_test_description">The 30-minute field test estimates your heart rate at threshold (LTHR). This is the most reliable value for calculating your training zones accurately.</string>
    <string name="hr_test_before_title">Before you start</string>
    <string name="hr_test_before_1">Do not do this test after a heavy session or recent competition.</string>
    <string name="hr_test_before_2">Do not do this test if you are very tired, in pain, feverish, or returning from injury.</string>
    <string name="hr_test_before_3">Allow at least 48 hours without intense training before the test.</string>
    <string name="hr_test_before_4">Choose a flat, consistent course without interruptions.</string>
    <string name="hr_test_before_5">Ideally use a chest HR strap rather than a wrist optical sensor.</string>
    <string name="hr_test_warmup_title">Warm-up</string>
    <string name="hr_test_warmup_1">Warm up for 15–20 minutes at easy endurance pace.</string>
    <string name="hr_test_warmup_2">Recover 2–3 minutes of easy jogging before starting the test.</string>
    <string name="hr_test_run_1">Run 30 minutes at the best steady effort you can sustain.</string>
    <string name="hr_test_run_2">Don\'t go too fast at the start. The goal is to maintain a high but stable intensity for the full duration.</string>
    <string name="hr_test_run_3">If your watch allows, press LAP after the first 10 minutes.</string>
    <string name="hr_test_after_title">After the test</string>
    <string name="hr_test_after_1">The average heart rate over the last 20 minutes is your estimated LTHR.</string>
    <string name="hr_test_after_2">Example: if your average HR over the last 20 minutes is 174 bpm, your estimated LTHR is 174.</string>
    <string name="hr_test_after_3">Enter your LTHR value in your profile under \'30-minute field test\' mode. The app will automatically calculate your HR zones.</string>
    <string name="hr_test_add_accelerations">Add 3–4 progressive accelerations of 15–20 seconds to prepare for the effort.</string>
    <string name="hr_test_repeat_tip">Repeat the test every 8–12 weeks if your training changes significantly.</string>

    <!-- HR zone interpretation tips -->
    <string name="hr_tip_calibrate">For more reliable coaching, enter your resting HR, actual max HR, or do a field test.</string>
    <string name="hr_tip_enter_fcmax">Enter at least your max HR or birth date to calculate your zones.</string>
    <string name="hr_tip_pct_fcmax">Your zones are currently calculated using % Max HR. For better accuracy, add your resting HR or do the 30-min field test.</string>
    <string name="hr_tip_custom_zones_check">Verify that custom zones are continuous, increasing, and non-overlapping.</string>
    <string name="hr_tip_conditions">Keep similar conditions to compare results.</string>
    <string name="hr_tip_avoid_conditions">Avoid extreme heat, strong wind, or hilly courses.</string>
    <string name="hr_tip_no_heavy_session">Do not do this test after a heavy session or recent competition.</string>
    <string name="hr_tip_health_only">Only do this test if you are in good health.</string>
    <string name="hr_tip_not_medical">This test does not replace medical advice. If in doubt, consult a health professional.</string>
```

In `res/values-fr/strings.xml`:
```xml
    <!-- settings tab -->
    <string name="settings_title">Réglages</string>
    <string name="settings_account_section">Compte et synchronisation</string>
    <string name="settings_account_subtitle">Gestion du compte et export de données</string>
    <string name="settings_appearance_section">Apparence</string>
    <string name="settings_appearance_subtitle">Unités, zones, fréquence cardiaque et seuils</string>
    <string name="settings_startup_screen">Écran d\'ouverture</string>
    <string name="settings_data_source">Source de données active</string>
    <string name="settings_stats_granularity">Granularité stats</string>
    <string name="settings_logout">Se déconnecter</string>
    <string name="settings_strava_notifications">Notifications de synchro Strava</string>
    <string name="settings_cockpit_prefs">Préférences cockpit</string>

    <!-- athlete profile -->
    <string name="profile_title">Profil sportif</string>
    <string name="profile_description">Ce profil sert à calibrer les zones de fréquence cardiaque et à mieux interpréter le niveau d\'effort.</string>
    <string name="profile_help_text">Ces infos améliorent les estimations si tu ne renseignes pas directement tes zones.</string>
    <string name="profile_zone_method">Méthode de calcul des zones</string>
    <string name="profile_manual_mode">Je renseigne mes valeurs</string>
    <string name="profile_manual_mode_desc">Les champs du profil sont utilisés directement pour calculer tes zones.</string>
    <string name="profile_auto_mode">Déduire automatiquement</string>
    <string name="profile_auto_mode_desc">L\'app peut compléter les valeurs manquantes avec l\'âge ou l\'historique disponible.</string>
    <string name="profile_values_source">Source des valeurs</string>
    <string name="profile_cardio_data">Données cardio</string>
    <string name="profile_weight">Poids (kg)</string>
    <string name="profile_birth_year">Année naissance</string>
    <string name="profile_weight_placeholder">ex. 72</string>
    <string name="profile_birth_year_placeholder">ex. 1985</string>
    <string name="profile_hr_rest">FC repos</string>
    <string name="profile_hr_max">FC max</string>
    <string name="profile_hr_reserve">FC réserve</string>
    <string name="profile_hr_lthr_test">FC seuil test 30 min</string>
    <string name="profile_hr_abbr">FC</string>
    <string name="profile_hr_max_estimated">FCmax estimée</string>
    <string name="profile_enter_lthr">Renseigner ma FC seuil</string>
    <string name="profile_view_test_protocol">Voir le protocole du test 30 min</string>

    <!-- HR test protocol -->
    <string name="hr_test_title">Protocole du test terrain 30 minutes</string>
    <string name="hr_test_description">Le test terrain de 30 minutes permet d\'estimer ta fréquence cardiaque au seuil (LTHR). C\'est la valeur la plus fiable pour calculer tes zones d\'entraînement avec précision.</string>
    <string name="hr_test_before_title">Avant de commencer</string>
    <string name="hr_test_before_1">Ne fais pas ce test après une grosse séance ou une compétition récente.</string>
    <string name="hr_test_before_2">Ne fais pas ce test en cas de fatigue importante, douleur, fièvre ou reprise après blessure.</string>
    <string name="hr_test_before_3">Prévois au moins 48 h sans entraînement intense avant le test.</string>
    <string name="hr_test_before_4">Choisis un parcours plat, régulier et sans interruption.</string>
    <string name="hr_test_before_5">Utilise idéalement une ceinture cardio plutôt qu\'un capteur optique au poignet.</string>
    <string name="hr_test_warmup_title">Échauffement</string>
    <string name="hr_test_warmup_1">Échauffe-toi 15 à 20 minutes en endurance facile.</string>
    <string name="hr_test_warmup_2">Récupère 2 à 3 minutes en footing facile avant de commencer le test.</string>
    <string name="hr_test_run_1">Cours 30 minutes au meilleur effort régulier possible.</string>
    <string name="hr_test_run_2">Ne pars pas trop vite. L\'objectif est de tenir une intensité forte mais stable pendant toute la durée du test.</string>
    <string name="hr_test_run_3">Si ta montre le permet, appuie sur le bouton LAP après les 10 premières minutes.</string>
    <string name="hr_test_after_title">Après le test</string>
    <string name="hr_test_after_1">La fréquence cardiaque moyenne des 20 dernières minutes correspond à ton estimation de LTHR.</string>
    <string name="hr_test_after_2">Exemple : si ta FC moyenne sur les 20 dernières minutes est de 174 bpm, alors ton LTHR estimé est 174.</string>
    <string name="hr_test_after_3">Entre ta valeur LTHR dans ton profil, dans le mode \'Test terrain 30 minutes\'. L\'app calculera automatiquement tes zones cardio.</string>
    <string name="hr_test_add_accelerations">Ajoute 3 à 4 accélérations progressives de 15 à 20 secondes pour préparer l\'effort.</string>
    <string name="hr_test_repeat_tip">Répète le test toutes les 8 à 12 semaines si ton entraînement évolue.</string>

    <!-- HR zone interpretation tips -->
    <string name="hr_tip_calibrate">Pour un coaching plus fiable, renseigne ta FC repos, ta FC max réelle ou réalise un test terrain.</string>
    <string name="hr_tip_enter_fcmax">Renseigne au minimum ta FC max ou ta date de naissance pour calculer tes zones.</string>
    <string name="hr_tip_pct_fcmax">Tes zones sont actuellement calculées avec la méthode % FC max. Pour une meilleure précision, ajoute ta FC repos ou réalise le test terrain de 30 minutes.</string>
    <string name="hr_tip_custom_zones_check">Vérifie que les zones personnalisées sont continues, croissantes et sans chevauchement.</string>
    <string name="hr_tip_conditions">Garde des conditions similaires pour comparer les résultats.</string>
    <string name="hr_tip_avoid_conditions">Évite les fortes chaleurs, le vent fort ou les parcours vallonnés.</string>
    <string name="hr_tip_no_heavy_session">Ne fais pas ce test après une grosse séance ou une compétition récente.</string>
    <string name="hr_tip_health_only">Réalise ce test uniquement si tu es en bonne santé.</string>
    <string name="hr_tip_not_medical">Ce test ne remplace pas un avis médical. En cas de doute, demande l\'avis d\'un professionnel de santé.</string>
```

- [ ] **Step 2: Migrate Settings tab, AthleteProfileScreen, HeartRateTestProtocolScreen in `DashboardScreen.kt`**

Apply `stringResource()` for all labels found in these composable functions. Key replacements:

```kotlin
// Settings tab top section
"Réglages" → stringResource(R.string.settings_title)
"Compte et synchronisation" → stringResource(R.string.settings_account_section)
"Gestion du compte et export de données" → stringResource(R.string.settings_account_subtitle)
"Apparence" → stringResource(R.string.settings_appearance_section)
"Unités, zones, fréquence cardiaque et seuils" → stringResource(R.string.settings_appearance_subtitle)
"Écran d'ouverture" → stringResource(R.string.settings_startup_screen)
"Source de données active" → stringResource(R.string.settings_data_source)
"Granularité stats" → stringResource(R.string.settings_stats_granularity)
"Se déconnecter" → stringResource(R.string.settings_logout)
"Notifications de synchro Strava" → stringResource(R.string.settings_strava_notifications)
"Préférences cockpit" → stringResource(R.string.settings_cockpit_prefs)

// AthleteProfileScreen
"Profil sportif" → stringResource(R.string.profile_title)
"Ce profil sert à calibrer les zones..." → stringResource(R.string.profile_description)
"Ces infos améliorent les estimations..." → stringResource(R.string.profile_help_text)
"Méthode de calcul des zones" → stringResource(R.string.profile_zone_method)
"Je renseigne mes valeurs" → stringResource(R.string.profile_manual_mode)
"Les champs du profil sont utilisés directement..." → stringResource(R.string.profile_manual_mode_desc)
"Déduire automatiquement" → stringResource(R.string.profile_auto_mode)
"L'app peut compléter les valeurs manquantes..." → stringResource(R.string.profile_auto_mode_desc)
"Source des valeurs" → stringResource(R.string.profile_values_source)
"Données cardio" → stringResource(R.string.profile_cardio_data)
"Poids (kg)" → stringResource(R.string.profile_weight)
"Année naissance" → stringResource(R.string.profile_birth_year)
"ex. 72" → stringResource(R.string.profile_weight_placeholder)
"ex. 1985" → stringResource(R.string.profile_birth_year_placeholder)
"FC repos" → stringResource(R.string.profile_hr_rest)
"FC max" → stringResource(R.string.profile_hr_max)
"FC réserve" → stringResource(R.string.profile_hr_reserve)
"FC seuil test 30 min" → stringResource(R.string.profile_hr_lthr_test)
"FC" (abbreviation) → stringResource(R.string.profile_hr_abbr)
"FCmax estimée" → stringResource(R.string.profile_hr_max_estimated)
"Renseigner ma FC seuil" → stringResource(R.string.profile_enter_lthr)
"Voir le protocole du test 30 min" → stringResource(R.string.profile_view_test_protocol)

// HR zone labels — use hr_zone_* strings from Task 1
"Endurance fondamentale" → stringResource(R.string.hr_zone_z1_name)
"Endurance active" → stringResource(R.string.hr_zone_z2_name)
"Travail au seuil" → stringResource(R.string.hr_zone_z3_name)
"VO₂max / VMA" → stringResource(R.string.hr_zone_z4_name)
"VMA / très intense" → stringResource(R.string.hr_zone_z5_name)
"Footing très facile, récupération, échauffement." → stringResource(R.string.hr_zone_z1_description)
"Endurance active, effort soutenu mais contrôlé." → stringResource(R.string.hr_zone_z2_description)
"Travail au seuil, effort difficile mais tenable." → stringResource(R.string.hr_zone_z3_description)
"VO₂max, côtes, intervalles courts, effort très intense." → stringResource(R.string.hr_zone_z4_description)
"Zones personnalisées" → stringResource(R.string.hr_zone_custom_zones)
"Seuil anaérobie / LTHR" → stringResource(R.string.hr_zone_lt_hr)
"Seuil aérobie / AeT" → stringResource(R.string.hr_zone_aet)
"Zones FC utilisées" → stringResource(R.string.hr_zone_zones_used)
"Min" → stringResource(R.string.hr_zone_min)
"Max" → stringResource(R.string.hr_zone_max)
"% FC max" → stringResource(R.string.unit_pct_fcmax)

// HeartRateTestProtocolScreen
"Protocole du test terrain 30 minutes" → stringResource(R.string.hr_test_title)
"Le test terrain de 30 minutes permet d'estimer..." → stringResource(R.string.hr_test_description)
"Avant de commencer" → stringResource(R.string.hr_test_before_title)
"Ne fais pas ce test après une grosse séance..." → stringResource(R.string.hr_test_before_1)
"Ne fais pas ce test en cas de fatigue..." → stringResource(R.string.hr_test_before_2)
"Prévois au moins 48 h sans entraînement..." → stringResource(R.string.hr_test_before_3)
"Choisis un parcours plat..." → stringResource(R.string.hr_test_before_4)
"Utilise idéalement une ceinture cardio..." → stringResource(R.string.hr_test_before_5)
"Échauffement" → stringResource(R.string.hr_test_warmup_title)
"Échauffe-toi 15 à 20 minutes..." → stringResource(R.string.hr_test_warmup_1)
"Récupère 2 à 3 minutes..." → stringResource(R.string.hr_test_warmup_2)
"Cours 30 minutes au meilleur effort régulier possible." → stringResource(R.string.hr_test_run_1)
"Ne pars pas trop vite..." → stringResource(R.string.hr_test_run_2)
"Si ta montre le permet..." → stringResource(R.string.hr_test_run_3)
"Après le test" → stringResource(R.string.hr_test_after_title)
"La fréquence cardiaque moyenne des 20 dernières minutes..." → stringResource(R.string.hr_test_after_1)
"Exemple : si ta FC moyenne..." → stringResource(R.string.hr_test_after_2)
"Entre ta valeur LTHR dans ton profil..." → stringResource(R.string.hr_test_after_3)
"Ajoute 3 à 4 accélérations progressives..." → stringResource(R.string.hr_test_add_accelerations)
"Répète le test toutes les 8 à 12 semaines..." → stringResource(R.string.hr_test_repeat_tip)

// Interpretation tips
"Pour un coaching plus fiable, renseigne ta FC repos..." → stringResource(R.string.hr_tip_calibrate)
"Renseigne au minimum ta FC max..." → stringResource(R.string.hr_tip_enter_fcmax)
"Tes zones sont actuellement calculées avec la méthode % FC max..." → stringResource(R.string.hr_tip_pct_fcmax)
"Vérifie que les zones personnalisées sont continues..." → stringResource(R.string.hr_tip_custom_zones_check)
"Garde des conditions similaires pour comparer..." → stringResource(R.string.hr_tip_conditions)
"Évite les fortes chaleurs, le vent fort..." → stringResource(R.string.hr_tip_avoid_conditions)
"Ne fais pas ce test après une grosse séance..." (in tips) → stringResource(R.string.hr_tip_no_heavy_session)
"Réalise ce test uniquement si tu es en bonne santé." → stringResource(R.string.hr_tip_health_only)
"Ce test ne remplace pas un avis médical..." → stringResource(R.string.hr_tip_not_medical)
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/res/values-fr/strings.xml \
        app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
git commit -m "feat(i18n): DashboardScreen Settings tab, profile, HR zones, test protocol"
```

---

## Verification

After Task 12, verify the migration is complete:

```bash
# Should return zero results — no remaining French hardcoded strings
grep -n '"Enregistrer\|"Annuler\|"Connexion\|"Réglages\|"Activités\|"Chargement\|"Retour\|"Fermer' \
  app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt \
  app/src/main/java/com/franck/trailcockpit/ui/screens/AuthScreen.kt \
  app/src/main/java/com/franck/trailcockpit/ui/components/*.kt

# Should return zero results — no .label access on migrated enums
grep -n '\.label\b' \
  app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt
```

Build the app to confirm no compile errors:
```bash
./gradlew assembleDebug
```
