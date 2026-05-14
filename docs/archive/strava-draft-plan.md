# Draft Strava pour Trail Cockpit

## Objectif

Connecter l'application Android a Strava sans demander a chaque utilisateur de creer sa propre API Strava.

## Principe

Le bon modele est:

1. Une seule application Strava creee par vous.
2. L'application Android ouvre l'ecran de connexion Strava.
3. Strava renvoie un `authorization_code`.
4. Le backend de l'application echange ce code contre les tokens.
5. Le backend stocke et rafraichit les tokens.
6. Le backend renvoie a l'app des donnees nettoyees pour le cockpit.

Le `client_secret` Strava ne doit jamais etre embarque dans l'app Android.

## Ce que le draft pose deja

- Une section visuelle "Sources de donnees" dans l'app.
- Une section "Connexion Strava" avec le bon mode d'authentification cible.
- Une liste d'activites recentes alignee sur l'onglet `Activities` du fichier Excel.
- Un `deep link` Android `trailcockpit://strava-auth` pour preparer le retour OAuth.
- Le maintien du mode "API push" actuel pendant la transition.

## Etapes suivantes conseillees

### Etape 1

Creer l'application Strava editeur avec une redirect URI compatible mobile/web.

Exemple de callback mobile:

```text
trailcockpit://strava-auth
```

Exemple de callback backend/web:

```text
https://votre-domaine.com/api/strava/callback
```

### Etape 2

Mettre en place un backend minimal.

Routes typiques:

- `GET /api/strava/connect`
- `GET /api/strava/callback`
- `POST /api/strava/webhook`
- `POST /api/strava/sync`
- `GET /api/dashboard`

### Etape 3

Mapper les activites Strava vers vos indicateurs:

- `Run` et `TrailRun` -> km semaine, D+, charge, intensites.
- `Ride` -> volume velo.
- `moving_time`, `pace`, `heart_rate`, `suffer_score` -> charge et tendances.

### Etape 4

Remplacer progressivement les `SampleData` par:

- les donnees de votre API actuelle,
- puis les donnees synchronisees depuis Strava,
- puis les agrégats calcules par le backend.

## Onglets Excel detectes

Le fichier `Franck Trail 2026 (1).xlsx` contient notamment:

- `Plan`
- `Weeks`
- `Cockpit`
- `Activities`
- `Splits`
- `Dashboard_Data_v2`
- `Cycles`
- `FC`

Ces onglets sont suffisants pour definir les premiers mappages metier.
