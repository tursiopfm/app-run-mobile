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
  weeklyTitle:        'Charge hebdomadaire',
  fatigueFitnessTitle:'Fatigue vs Fitness — 16 semaines',
  freshnessTitle:     'Fraîcheur',
  intensityTitle:     'Répartition intensité — 30j glissants',
  fatigue7d:          'Fatigue 7j',
  fitness28d:         'Fitness 28j',
  tsbLabel:           'TSB Forme / Fatigue',
  trainingCapacity:   'Capacité d\'entraînement',
  trainingLoad:       'Charge d\'entraînement',
  recovery:           'Récupération',
  formState:          'État de forme',
  veryFresh:          'Très frais',
  fresh:              'Frais',
  balanced:           'Équilibré',
  recentFatigue:      'Fatigue récente',
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
  risingFatigue:      'Fatigue croissante. Réduis le volume ou fais de l\'endurance facile.',
  wellRested:         'Bien reposé. Idéal pour une séance intense.',
  goodBalance:        'Bonne balance. Le test terrain 30min peut améliorer la précision.',
  overloadedMsg:      'Repos recommandé ou séance très facile.',
  tired:              'Fatigué',
  interpretTips:      'Conseils d\'interprétation',
  formLabel:          'Forme',
  weeklyShort:        'Charge hebdo',
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
  runtaf:       'Runtaf',
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
