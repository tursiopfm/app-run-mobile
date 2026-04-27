# Memory - Trail Cockpit Android

Derniere mise a jour : 2026-04-27

## Identite du projet

- Application Android Kotlin + Jetpack Compose pour piloter l'entrainement trail / multisport.
- Nom fonctionnel : Trail Cockpit Android.
- Objectif : afficher un cockpit d'entrainement lisible, connecte a Strava et au backend, avec suivi charge, fatigue, capacite, fraicheur, activites et planification.
- Backend principal : `backend/strava-oauth/server.js`.
- Integrations : Strava OAuth, Supabase mentionne dans la stack, stockage local backend JSON / SQLite selon les docs.

## Regles de travail importantes

- Preferer des modifications minimales, ciblees et coherentes avec l'architecture existante.
- Ne pas toucher a `app/build/`, `.gradle/`, `tools/`.
- Considerer `RemoteDashboard.kt` comme lecture seule sauf demande explicite.
- Lire les fichiers utiles avant modification, surtout `DashboardScreen.kt` car il est central et volumineux.
- Attention aux changements utilisateur deja presents dans le worktree : ne jamais les annuler sans demande explicite.
- Mettre a jour `docs/MINMAP.md` quand un nouvel ecran, onglet, flux ou integration est ajoute.
- Utiliser `docs/IDEES_ET_MISES_A_JOUR.md` pour suivre les demandes produit et leur statut.

## Architecture rapide

```text
app/src/main/java/com/franck/trailcockpit/
  MainActivity.kt
  StravaAuthActivity.kt
  config/
    AppConfig.kt
    SessionRepository.kt
    SettingsRepository.kt
  data/
    Models.kt
    SampleData.kt
    RemoteDashboard.kt
    DraftData.kt
    DraftModels.kt
  network/
    AuthRepository.kt
    BackendRepository.kt
    StravaRepository.kt
  ui/
    screens/
      AuthScreen.kt
      DashboardScreen.kt
    components/
      Charts.kt
      KpiTiles.kt
      WeekTable.kt
      DraftCards.kt
    theme/
      Color.kt
      Theme.kt
```

## Flux application

```text
MainActivity
  -> charge session + theme + dashboard
  -> pas de session : AuthScreen
  -> session OK : DashboardScreen

AuthScreen
  -> Connexion / Creer un compte
  -> AuthRepository
  -> succes : session sauvegardee

DashboardScreen
  -> onglets : Cockpit, Stats, Charge, Plan, Activities, Reglages
  -> edition activite : ActivityEditScreen
  -> layout cockpit : CockpitLayoutScreen
```

## Points fonctionnels actuels

- `Cockpit` affiche les blocs visibles du cockpit, peut ouvrir le layout et lancer connexion / sync Strava.
- `Stats` affiche les historiques selon la metrique choisie : Km, D+, Load, TSB.
- `Charge` affiche la charge d'entrainement et les tendances.
- `Plan` s'appuie sur `DraftData.trainingCycles`.
- `Activities` affiche les activites recentes et permet l'edition.
- `Reglages` gere connexion, theme, sync Strava et deconnexion.

## Cockpit Effort Score

Le modele CES est decrit dans `docs/BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md`.

Implementation deja notee dans `CLAUDE.md` :

- `CesCalculator.kt` calcule le score d'effort par activite, en remplacement du suffer Strava.
- `TrainingLoadCalculator.kt` agrege les activites par jour sur 30 jours et calcule EWMA 7j / 42j, load ratio et freshness.
- L'onglet `Charge` contient 4 graphiques :
  - charge quotidienne sur 30 jours ;
  - fatigue vs capacite ;
  - fraicheur ;
  - repartition intensite sur 30 jours glissants.

Regle critique : `aggregateActivitiesByDay()` doit produire les 30 jours consecutifs, y compris les jours sans activite avec `ces=0.0`. Ces jours representent la recuperation et doivent rester dans les calculs EWMA et les graphiques.

## Priorites connues

- Sauvegarder la configuration de l'ecran de parametrage `Cockpit` pour la conserver au redemarrage.
- Authentification Strava avec plusieurs clients API.
- Construire un APK pour test sur mobile.
- Enrichir l'activite avec carte et autres donnees.
- Ajouter des modules de planification / IA entrainement a moyen terme.

## Zones sensibles

- `DashboardScreen.kt` concentre beaucoup de navigation et d'etat UI.
- La navigation est interne aux ecrans plutot que basee sur un systeme de routes complet.
- Les donnees mock, draft et backend reel sont encore en partie melangees.
- La sync Strava et le refresh dashboard sont critiques pour l'experience utilisateur.
- Toute modification des calculs de charge doit verifier les jours sans activite et les fenetres temporelles.

## Commandes utiles

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat test
.\start.bat
```

Si le build Android est lance, surveiller les erreurs Kotlin/Compose et les problemes de SDK local dans `local.properties`.

## Docs de reference

- `CLAUDE.md` : consignes rapides, architecture, fichiers cles, priorites.
- `docs/MINMAP.md` : carte des ecrans, onglets et connexions techniques.
- `docs/IDEES_ET_MISES_A_JOUR.md` : backlog produit et suivi des demandes.
- `README.md` : presentation generale et instructions projet.
