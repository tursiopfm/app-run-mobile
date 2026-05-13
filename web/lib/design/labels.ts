// Centralized labels — mirror of res/values/strings.xml.
// Components must import from here instead of hardcoding strings.

// --- Navigation tabs ---
export const tabs = {
  cockpit:        'Cockpit',
  charge:         'Charge',
  plan:           'Plan',
  activities:     'Activités',
  courses:        'Courses',
  settings:       'Réglages',
} as const

// --- Sports ---
export const sports = {
  run:            'Course',
  trailRun:       'Trail',
  bike:           'Vélo',
  virtualRide:    'Home trainer',
  ebikeRide:      'E-Bike',
  swim:           'Natation',
  walk:           'Marche',
  hike:           'Rando',
  weightTraining: 'Muscu',
  abbr: {
    run:  'RUN',
    bike: 'BIKE',
    swim: 'SWIM',
  },
} as const

// Strava sport_type → display label mapping
export const sportLabel: Record<string, string> = {
  Run:           sports.run,
  TrailRun:      sports.run,
  Ride:          sports.bike,
  GravelRide:    sports.bike,
  VirtualRide:   sports.virtualRide,
  EBikeRide:     sports.ebikeRide,
  Swim:          sports.swim,
  Walk:          sports.walk,
  Hike:          sports.hike,
  WeightTraining:sports.weightTraining,
}

// --- Units ---
export const units = {
  km:         'km',
  m:          'm',
  kmh:        'km/h',
  perKm:      '/km',
  bpm:        'bpm',
  watts:      'W',
  kg:         'kg',
  pct:        '%',
  pctFcMax:   '% FC max',
  ces:        'CES',
  hours:      'h',
} as const

// --- Cockpit blocks ---
export const cockpit = {
  sectionKpisVolume:  'KPIs & Volume',
  sectionGoals:       'Objectifs',
  sectionChart:       'Graphique',
  sectionRatioDPlus:  'Ratio D+/km',
  sectionHistory:     'Historique',
  sectionKmDPlus:     'Km & D+ cumulés',
  sectionCumulMonths: 'Km mensuels cumulés',
  sectionLoad:        'Charge',
  sectionIntensity:   'Intensités',
  sectionStrava:      'Strava Sync',
  sectionCurrentWeek: 'Semaine en cours',
  addBlock:           'Ajouter un bloc',
  configureBlock:     'Configurer le bloc',
  stravaConnected:    'Compte connecté',
  stravaPending:      'Connexion en attente',
  stravaConnect:      'Connecter Strava',
  stravaReconnect:    'Reconnecter Strava',
  goalDistanceWeek:   'Distance hebdo (tout)',
  goalDistanceYear:   'Distance annuelle (tout)',
  allActivities:      'Km & D+ — Toutes activités',
  cumulMonthsTitle:   'Km mensuels cumulés',
  ratioTitle:         'Ratio',
  kpiWeekDPlus:       'D+ hebdo',
  kpiLoadRun:         'Charge (RUN)',
} as const

// --- Charge tab ---
export const charge = {
  // ─── Legacy keys (used by existing /charge page until Task 4.3 rewrites it) ───
  weeklyTitle:        'Charge hebdomadaire',
  fatigueFitnessTitle:'Fatigue vs Fitness — 16 semaines',
  freshnessTitle:     'Fraîcheur',
  intensityTitle:     'Répartition intensité — 30j glissants',
  fatigue7d:          'Fatigue 7j',
  fitness28d:         'Fitness 28j',
  tsbLabel:           'TSB Forme / Fatigue',
  trainingCapacity:   "Capacité d'entraînement",
  trainingLoad:       "Charge d'entraînement",
  recovery:           'Récupération',
  formState:          'État de forme',
  veryFresh:          'Très frais',
  fresh:              'Frais',
  balanced:           'Équilibré',
  veryLow:            'Très faible',
  fit:                'En forme',
  excellent:          'Excellent',
  good:               'Bon',
  low:                'Faible',
  loaded:             'Chargé',
  overloaded:         'Surchargé',
  insufficientData:   'Données insuffisantes. Suis le plan attentivement.',
  moderate:           'Charge modérée',
  balancedMsg:        'Charge équilibrée. Suis le plan normalement.',
  risingFatigue:      "Fatigue croissante. Réduis le volume ou fais de l'endurance facile.",
  wellRested:         'Bien reposé. Idéal pour une séance intense.',
  goodBalance:        'Bonne balance. Le test terrain 30min peut améliorer la précision.',
  overloadedMsg:      'Repos recommandé ou séance très facile.',
  tired:              'Fatigué',
  interpretTips:      "Conseils d'interprétation",
  formLabel:          'Forme',
  weeklyShort:        'Charge hebdo',

  // ─── New section (used by redesigned /charge tab) ───
  pageTitle:           'Charge',
  sportFilterAll:      'Tout',
  sportFilterRun:      'Course',
  sportFilterRide:     'Vélo',
  sportFilterSwim:     'Natation',
  addBlock:            'Ajouter un bloc',

  // Vocabulary (NEW)
  recentFatigue:       'Fatigue récente',
  baseFitness:         'Base de forme',
  freshness:           'Fraîcheur',
  acuteLoad:           'Charge 7j',
  chronicLoad:         'Charge 28j',
  loadBalance:         "Équilibre de charge",
  rampRate:            'Progression',

  // Block titles
  blocks: {
    status:                'État du jour',
    acuteChronic:          'Charge 7j vs base habituelle',
    freshness:             'Fraîcheur',
    weeklyLoad:            'Charge hebdomadaire (10 semaines)',
    fitnessFatigue:        'Fatigue vs Base de forme',
    sportDistribution:     'Répartition par sport',
    intensityDistribution: 'Répartition par intensité',
    monotonyStrain:        'Variété & contrainte',
    topActivities:         'Activités les plus chargées',
    heatmap:               'Charge des 28 derniers jours',
    rampRateBlock:         'Progression de charge',
    insights:              'Lecture rapide',
  },

  // Coach verdict (matches StatusId). action = verbe d'action en gras ; reason = phrase courte.
  verdict: {
    insufficient:    { action: "Pas encore assez de données.",        reason: "Reviens après quelques séances pour avoir un verdict fiable." },
    overloaded:      { action: "Lève le pied 1-2 jours.",             reason: "Ta fatigue est marquée, la récupération devient prioritaire." },
    peak:            { action: "Pic de charge cette semaine.",        reason: "Soigne ta récupération avant de remettre une grosse séance." },
    loaded:          { action: "Tu peux maintenir le rythme.",        reason: "Fatigue normale pour ta phase de charge — ça passe." },
    'under-trained': { action: "Tu peux remonter le volume.",         reason: "Tu es très frais mais ta base reste à construire." },
    'very-fresh':    { action: "Bonne fenêtre pour intensifier.",     reason: "Tu es bien reposé, c'est le moment d'une séance qualité." },
    light:           { action: "Charge légère cette semaine.",        reason: "Utile si tu récupères — sinon tu peux relancer." },
    progressing:     { action: "Continue à charger prudemment.",      reason: "Tu progresses au-dessus de ta moyenne, surveille les signaux." },
    balanced:        { action: "Suis ton plan normalement.",          reason: "Charge et fraîcheur sont équilibrées." },
  },

  // Mots-statut sous les 3 KPIs (mappés depuis charge-kpi-status.ts)
  kpiStatus: {
    fatigue: {
      high:  'Élevée',
      usual: 'Habituelle',
      low:   'Modérée',
    },
    fitness: {
      building:     'À construire',
      progressing:  'En progression',
      solid:        'Solide',
      'very-solid': 'Très solide',
    },
    freshness: {
      'very-fresh':     'Très frais',
      fresh:            'Frais',
      balanced:         'Équilibrée',
      'normal-fatigue': 'Légère fatigue',
      'high-fatigue':   'Fatigué',
    },
  },

  // Freshness zone short labels (used by gauge)
  freshnessZone: {
    'very-fresh':     'Très frais',
    fresh:            'Frais',
    balanced:         'Équilibré',
    'normal-fatigue': 'Fatigue normale',
    'high-fatigue':   'Fatigue élevée',
  },

  // Ramp rate labels (matches RampRateLabel)
  ramp: {
    'fast-rise':           'Hausse rapide',
    'controlled-rise':     'Progression maîtrisée',
    'stable':              'Charge stable',
    'progressive-resume':  'Reprise progressive',
    'declining':           'Charge en baisse',
    'sharp-decline':       'Baisse de charge',
  },

  // Bottom-sheet help text (per block)
  help: {
    status:                "L'État du jour synthétise ta forme actuelle en comparant ta fatigue récente à ta condition de fond.\n\n• Fatigue récente — ton niveau de charge sur les 7 derniers jours. Plus c'est haut, plus tu accumules.\n\n• Base de forme — ta condition construite sur ~6 semaines d'entraînement. Elle monte progressivement avec la régularité.\n\n• Fraîcheur — différence entre ta base et ta fatigue. Négatif = fatigué, positif = reposé. Un peu négatif est normal en phase de charge.\n\nLe verdict en haut combine ces 3 signaux pour te dire si tu peux pousser, maintenir, ou alléger.",
    acuteChronic:          "Compare ta charge récente à ta charge habituelle. Un ratio > 1.5 indique un pic ; < 0.75 une période plus légère. Sert d'indicateur, pas de diagnostic.",
    freshness:             "Différence entre ta base de forme et ta fatigue récente (TSB en jargon). Très négatif = fatigue marquée ; très positif = grande fraîcheur (mais attention à l'inactivité prolongée).",
    weeklyLoad:            "Charge totale par semaine, séparée par sport. La ligne montre la moyenne glissante sur 4 semaines.",
    fitnessFatigue:        "Fatigue récente (ATL — 7j) vs Base de forme (CTL — 42j) sur 70 jours.",
    sportDistribution:     "Part de chaque sport dans ta charge totale. Change la fenêtre via les boutons 7j / 28j / 10 sem.",
    intensityDistribution: "Répartition de la charge par zone d'intensité (basée sur les zones cardiaques, le nom de l'activité ou l'intensité manuelle).",
    monotonyStrain:        "La monotonie mesure la variété de tes journées (charge mean / std). La contrainte combine volume et monotonie. Une semaine très chargée et peu variée est plus difficile à absorber.",
    topActivities:         "Les activités qui pèsent le plus dans ta charge des 7 derniers jours.",
    heatmap:               "Une case par jour sur les 28 derniers jours. Intensité de couleur = charge du jour.",
    rampRateBlock:         "Évolution de ta charge hebdomadaire. \"Hausse rapide\" = +30% en une semaine. Indicateur d'observation, pas de diagnostic.",
    insights:              "Notes générées automatiquement à partir de tes données. Pas de prédiction médicale, juste des observations.",
  },

  // Common short labels reused
  notEnoughData:        'Pas encore assez de données pour calculer la charge.',
  loadingError:         "Impossible de charger ta charge. Réessaie.",
  noActivitiesForSport: (sport: string) => `Pas encore assez de données ${sport} pour calculer la charge.`,
} as const

// --- Activities tab ---
export const activities = {
  title:              'Activités',
  searchBy:           'Rechercher par',
  sortFilter:         'Tri et filtres',
  filterLabel:        'Filtre',
  toDisplay:          'Activités à afficher',
  fieldTitle:         'Titre',
  fieldDistance:      'Distance (km)',
  fieldDuration:      'Durée (min:sec)',
  fieldElevation:     'Dénivelé positif (m)',
  fieldPace:          'Allure',
  fieldSpeed:         'Vitesse moy.',
  fieldCalories:      'Calories',
  fieldElapsedTime:   'Temps écoulé',
  labelDistance:      'Distance',
  labelDuration:      'Durée',
  labelDPlus:         'D+',
  labelDate:          'Date',
  labelElevation:     'Déniv.',
  labelEffort:        'Effort',
  effortVeryHard:     'Très dur',
  effortHard:         'Dur',
  effortSustained:    'Soutenu',
  effortModerate:     'Modéré',
  effortEasy:         'Facile',
  splitsTitle:        'Splits',
  intensityTitle:     'Intensité',
} as const

// --- Settings tab ---
export const settings = {
  title:              'Réglages',
  sectionAccount:     'Compte & sync',
  sectionAppearance:  'Apparence',
  sectionStartup:     'Écran de démarrage',
  sectionConnections: 'Connexions',
  sectionProfile:     'Profil athlète',
  logout:             'Déconnexion',
  themeLight:         'Clair',
  themeDark:          'Sombre',
  themeSystem:        'Système',
  langSystem:         'Système',
  langFrench:         'Français',
  langEnglish:        'English',
  comingSoon:         'Bientôt',
} as const

// --- Athlete profile ---
export const profile = {
  title:              'Profil athlète',
  fcMax:              'FC max',
  fcSeuil:            'FC seuil',
  allureSeuil:        'Allure seuil',
  ftpVelo:            'FTP vélo',
  objectifAnnuel:     'Objectif annuel',
  poids:              'Poids',
  anneeNaissance:     'Année de naissance',
  fcRepos:            'FC repos',
  hrReserve:          'Réserve FC',
  hrLthr:             'FC seuil — test 30min',
} as const

// --- Intensity categories (pie chart) ---
export const intensity = {
  vma:          'VMA',
  seuil:        'Seuil',
  cotes:        'Côtes',
  sortieLongue: 'Sortie longue',
  footing:      'Footing',
  autre:        'Autre',
} as const

// --- Week table ---
export const weekTable = {
  headerSession:   'Séance',
  headerLabel:     'Label',
  headerVolume:    'Volume (km)',
  headerElevation: 'D+ (m)',
  headerTotal:     'Total',
} as const

// --- Plan tab ---
export const plan = {
  structureTitle: 'Structure d\'entraînement',
} as const

// --- Courses / Records ---
export const courses = {
  title:     'Courses & Records',
  personal:  'Records personnels',
  races:     'Compétitions',
} as const

// --- Common ---
export const common = {
  loading:    'Chargement…',
  saving:     'Enregistrement…',
  week:       'Semaine',
  month:      'Mois',
  year:       'Année',
  total:      'Total',
  all:        'Tout',
  save:       'Enregistrer',
  cancel:     'Annuler',
  apply:      'Appliquer',
  reset:      'Réinitialiser',
  connect:    'Connecter',
  sync:       'Synchroniser',
  search:     'Rechercher',
  delete:     'Supprimer',
  back:       'Retour',
  ascending:  'Croissant',
  descending: 'Décroissant',
  rest:       'Repos',
  noActivity: 'Aucune activité',
  noActivityWeek: 'Aucune activité cette semaine',
  connectStravaPrompt: 'Connecte Strava dans les Réglages pour importer tes activités',
} as const

// --- HR zones ---
export const hrZones = {
  z1Name:     'Endurance de base',
  z2Name:     'Endurance active',
  z3Name:     'Seuil',
  z4Name:     'VO₂max / Intervalles',
  z5Name:     'Intensité max',
  optimalRange: 'Plage optimale',
} as const
