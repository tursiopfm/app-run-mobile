// French dictionary — source of truth, mirror of legacy lib/design/labels.ts content.
// Components must read via useT() (client) or getServerT() (server), not import this directly.

type Verdict = { action: string; reason: string }

type HelpSheetRow = { label: string; range: string; meaning: string; advice: string }
type HelpSheetSpec<K extends string> = {
  title: string
  intro: string
  rows: Record<K, HelpSheetRow>
}

export type Dict = {
  tabs: Record<'cockpit' | 'charge' | 'plan' | 'activities' | 'courses' | 'settings', string>
  sports: {
    run: string; trailRun: string; bike: string; virtualRide: string; ebikeRide: string;
    swim: string; walk: string; hike: string; weightTraining: string;
    all: string
    abbr: { run: string; bike: string; swim: string; all: string }
  }
  sportLabel: Record<string, string>
  units: Record<'km' | 'm' | 'kmh' | 'perKm' | 'bpm' | 'watts' | 'kg' | 'pct' | 'pctFcMax' | 'ces' | 'hours', string>
  cockpit: {
    sectionKpisVolume: string; sectionGoals: string; sectionChart: string; sectionRatioDPlus: string
    sectionHistory: string; sectionKmDPlus: string; sectionCumulMonths: string; sectionLoad: string
    sectionIntensity: string; sectionStrava: string; sectionCurrentWeek: string; addBlock: string
    configureBlock: string; stravaConnected: string; stravaPending: string; stravaConnect: string
    stravaReconnect: string; goalDistanceWeek: string; goalDistanceYear: string; allActivities: string
    cumulMonthsTitle: string; ratioTitle: string; kpiWeekDPlus: string; kpiLoadRun: string

    headerActivities:   string
    headerLastActivity: string
    headerGoals:        string
    headerWeeklyStats:  string
    headerCharge:       string
    headerHistory:      string
    headerIntensityBlock: string
    weekActivitiesPrefix:  string
    weekActivitiesSuffix:  string
    cumulHeader: (period: 'month' | 'year') => string

    blockLabel: Record<
      'activities' | 'lastActivity' | 'goals' | 'weekly' | 'charge' | 'history'
      | 'cumul' | 'intensity' | 'week' | 'weekActivities',
      string
    >

    kmWeek: string; dPlusWeek: string; kmYear: string; dPlusYear: string; elevationPositive: string
    sessionsCount: (n: number) => string
    chargeTitle: string; tsbFreshness: string; lastSevenDays: string; atl7d: string; ctl42d: string

    aria: {
      activitiesSettings: string; chargeSettings: string; chargeHelp: string
      goalsEdit: string; goalsSettings: string; weeklySettings: string
      historySettings: string; cumulSettings: string; intensitySettings: string
      lastActivityEdit: string; lastActivitySettings: string; weekActivitiesHide: string
      historyPrev: string; historyNext: string; yearRange: string
      sportN: (n: number) => string
    }

    modalTitle: Record<
      'activities' | 'charge' | 'goals' | 'weekly' | 'cumul' | 'intensity' | 'history' | 'lastActivity',
      string
    >

    modal: Record<
      'activitiesToShow' | 'uncheckAllHidesBlock' | 'defaultActivity' | 'shownFirst' | 'hideBlock' | 'close',
      string
    >

    periodShort: Record<'week' | 'month' | 'year', string>
    periodLong:  Record<'month' | 'year', string>
    weekPrefix:  string

    goalEdit: {
      titleFor:     (sport: string, emoji: string) => string
      loadFromPlan: (km: number, dPlus: number) => string
      cancel:       string
      save:         string
      vsGoal:       (diff: number) => string
    }

    chartTabs: Record<'vol' | 'ratio', string>
    intensityUndefined: string

    noActivityThisWeek: string
    dayAbbr: readonly [string, string, string, string, string, string, string]

    monthNames: readonly [string, string, string, string, string, string, string, string, string, string, string, string]
    noData: string; totalLabel: string; dPlusShort: string; durationShort: string
    weekPeriodLabel: (mon: string, sun: string) => string

    yearLabel: (n: number) => string
    yearShortSuffix: string
    yearAll:   string

    noActivityFor: (sport: string) => string
  }
  charge: {
    weeklyTitle: string; fatigueFitnessTitle: string; freshnessTitle: string; intensityTitle: string
    fatigue7d: string; fitness28d: string; tsbLabel: string; trainingCapacity: string
    trainingLoad: string; recovery: string; formState: string
    veryFresh: string; fresh: string; balanced: string; veryLow: string; fit: string; excellent: string
    good: string; low: string; loaded: string; overloaded: string; insufficientData: string
    moderate: string; balancedMsg: string; risingFatigue: string; wellRested: string
    goodBalance: string; overloadedMsg: string; tired: string; interpretTips: string
    formLabel: string; weeklyShort: string

    pageTitle: string; sportFilterAll: string; sportFilterRun: string; sportFilterRide: string
    sportFilterSwim: string; addBlock: string
    sportFilterAria: string

    recentFatigue: string; baseFitness: string; freshness: string; acuteLoad: string
    chronicLoad: string; loadBalance: string; rampRate: string

    blocks: Record<
      'status' | 'acuteChronic' | 'freshness' | 'weeklyLoad' | 'fitnessFatigue'
      | 'sportDistribution' | 'intensityDistribution' | 'monotonyStrain' | 'topActivities'
      | 'heatmap' | 'rampRateBlock' | 'insights',
      string
    >

    verdict: Record<
      'insufficient' | 'overloaded' | 'peak' | 'loaded' | 'under-trained' | 'very-fresh'
      | 'light' | 'progressing' | 'balanced',
      Verdict
    >

    kpiStatus: {
      fatigue:   Record<'high' | 'usual' | 'low', string>
      fitness:   Record<'building' | 'progressing' | 'solid' | 'very-solid', string>
      freshness: Record<'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue', string>
    }

    freshnessZone: Record<'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue', string>

    ramp: Record<
      'fast-rise' | 'controlled-rise' | 'stable' | 'progressive-resume' | 'declining' | 'sharp-decline',
      string
    >

    help: Record<
      'status' | 'acuteChronic' | 'freshness' | 'weeklyLoad' | 'fitnessFatigue'
      | 'sportDistribution' | 'intensityDistribution' | 'monotonyStrain' | 'topActivities'
      | 'heatmap' | 'rampRateBlock' | 'insights',
      string
    >

    notEnoughData: string
    loadingError:  string
    noActivitiesForSport: (sport: string) => string

    allSport:    string
    windowWeek:  string
    window28d:   string
    window10w:   string

    intensityLabels: Record<
      'Récupération' | 'Endurance Fondamentale' | 'Endurance active' | 'Seuil' | 'VMA' | 'Non déterminée',
      string
    >

    intensityNoteHigh:     string
    intensityNoteEasy:     string
    intensityNoteBalanced: string

    acuteChronicRecap:    (pct: string) => string
    loadLow:              string
    loadBalanceBalanced:  string
    loadBalanceHigh:      string
    loadBalancePeak:      string

    freshnessInterpret: Record<
      'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue',
      string
    >
    freshnessDeltaFresher: string
    freshnessDeltaTired:   string
    freshnessDeltaStable:  string
    freshnessSevenDaysAgo: (n: number) => string

    legendRun:    string
    legendRide:   string
    legendSwim:   string
    legendOther:  string
    legendAvg4w:  string
    legendAtlTip: string
    legendCtlTip: string
    legendTsbTip: string

    monoTitle:   string
    strainTitle: string
    monoUnit:    string
    strainUnit:  string
    activeDays:  string
    peakDay:     string

    heatLess: string
    heatMore: string

    rampCaption:   string
    insightsEmpty: string

    notes: Record<
      'run-heavy' | 'ride-compensates' | 'concentrated' | 'monotonous' | 'strenuous'
      | 'high-intensity' | 'sport-variety' | 'low-base',
      string
    >
    notesNoCes: (n: number) => string

    daysHeader: readonly [string, string, string, string, string, string, string]

    helpSheet: {
      previousValueAria: (v: number) => string
      currentValueAria:  (v: number) => string
      freshness: HelpSheetSpec<'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue'>
      fatigue:   HelpSheetSpec<'high' | 'usual' | 'low'>
      fitness:   HelpSheetSpec<'building' | 'progressing' | 'solid' | 'very-solid'>
    }
  }
  activities: {
    title: string; searchBy: string; sortFilter: string; filterLabel: string; toDisplay: string
    fieldTitle: string; fieldDistance: string; fieldDuration: string; fieldElevation: string
    fieldPace: string; fieldSpeed: string; fieldCalories: string; fieldElapsedTime: string
    labelDistance: string; labelDuration: string; labelDPlus: string; labelDate: string
    labelElevation: string; labelEffort: string
    effortVeryHard: string; effortHard: string; effortSustained: string; effortModerate: string; effortEasy: string
    splitsTitle: string; intensityTitle: string

    intensityLevelLabels: Record<1 | 2 | 3 | 4 | 5, string>
    intensityNotMeasured: string
    intensityNotMeasuredAria: string
    intensityAria: (label: string) => string
    chargeLevelLabels: Record<1 | 2 | 3 | 4 | 5, string>
    chargeLabel: string
    chargeAria: (value: number, level: string) => string
    sessionTypeLabels: Record<
      'course' | 'sortie_longue' | 'fractionne' | 'seuil_tempo' | 'cotes' | 'runtaf'
      | 'velotaf' | 'footing' | 'velo' | 'natation' | 'renfo' | 'musculation',
      string
    >
    sessionTypeUndefined: string
    sessionTypeUndefinedAria: string
    sessionTypeAria: (label: string) => string
    mapReplay: string
    mapUnavailable: string
    splitsBest: (pace: string) => string
    splitsCount: string
    hrAvgLabel: string
    hrMaxLabel: string
    fracBlocksCount: string
    fracFastDetected: (n: number) => string
    fracColDistance: string
    fracColTime: string
    fracColPace: string
    fracColElevation: string
    fracFastBadge: string

    popupClose: string; popupCloseAria: string
    popupChargeTitle: string; popupChargeIntro: string
    cesRanges: Record<'r1' | 'r2' | 'r3' | 'r4' | 'r5', string>

    popupIntensityTitle: string; popupIntensityIntro: string
    intensityDesc: Record<'recuperation' | 'footing' | 'endurance_active' | 'seuil' | 'vma', string>
    intensityRule: Record<'recuperation' | 'footing' | 'endurance_active' | 'seuil' | 'vma', string>
    rulePrefix: string
    popupShortNote: string
    popupShortIntervalsHtml: string
    popupRefs: string

    popupWorkoutTypeTitle: string; popupWorkoutTypeIntro: string
    workoutTypeDesc: Record<
      'sortie_longue' | 'fractionne' | 'seuil_tempo' | 'cotes' | 'course' | 'runtaf'
      | 'velotaf' | 'footing' | 'velo' | 'natation' | 'renfo' | 'musculation',
      string
    >
    workoutTypeRule: Record<
      'sortie_longue' | 'fractionne' | 'seuil_tempo' | 'cotes' | 'course' | 'runtaf'
      | 'velotaf' | 'footing' | 'velo' | 'natation' | 'renfo' | 'musculation',
      string
    >
    workoutTypeUndefinedDesc: string
    workoutTypeUndefinedRule: string

    editTitle: string; editSectionActivity: string; editSectionMetrics: string
    editSectionSport: string; editSectionIntensity: string; editSectionType: string
    editFieldTitle: string; editFieldDistance: string; editFieldDuration: string; editFieldElevation: string
    editError: string; editErrorUnknown: string; editErrorDelete: string
    editButtonDelete: string; editButtonCancel: string; editButtonSave: string
    editEditAriaActivity: string

    sportOptionsLabels: Record<string, string>

    headerSearch: string; headerFilter: string; apply: string; reset: string
    searchByLabel: string; searchTitleLabel: string; searchDistanceLabel: string
    searchDurationLabel: string; searchElevationLabel: string
    fromLabel: string; toLabel: string
    resultsCount: (n: number) => string
    noResults: string
    sortFilterTitle: string
    activityFieldLabel: string; intensityFieldLabel: string; sessionTypeFieldLabel: string
    dateLabel: string; paceLabel: string; durationLabel: string; distanceLabel: string; dPlusLabel: string
    allOption: string; allMascAria: string
    placeholderKm: string; placeholderHms: string; placeholderM: string; placeholderPace: string
    speedLabel: string; cesShortLabel: string; tileEffort: string
    historyLoadingHint: string; historyLoading: string
    connectStravaImport: string; noActivityMatch: string

    detailCardio: string; detailPerformance: string; detailTime: string
    detailHrAvg: string; detailHrMax: string; detailCalories: string; detailSufferStrava: string
    detailActiveTime: string; detailTotalTime: string
    detailAvgPace: string; detailMaxPace: string; detailAvgSpeed: string; detailMaxSpeed: string
    detailVap: string; detailAvgCadence: string; detailAvgPower: string; detailMaxPower: string
    detailEnergy: string; detailDurationLabel: string; detailElapsedTime: string
    splitsInterval: string

    detailNotFound: string; detailBackToList: string; detailEditAria: string
    detailMap: string; detailHeartRateZones: string; detailSplits: string; detailFractionneSplits: string

    coursesSearchTitle: string; distanceTypeLabel: string
    noRaceFound: string; noRacePlanned: string; noRaceMatch: string; noRaceLogged: string
    upcomingRaces: string; upcomingRacesHelp: string
    summary: string; summaryHelp: string
    racesList: string; racesListHelp: string
    racesSummaryRaces: string; racesSummaryTotalKm: string; racesSummaryLastDate: string; racesSummaryMaxDPlus: string
    raceObjective: string; raceObjectiveMain: string; raceMDPlus: string
    raceRecordsTab: string; raceTabRaces: string; raceRecordsTitle: string
    raceRecordsTotal: string; raceRecordsAuto: string; raceRecordsSports: string; raceRecordsEmpty: string
    raceRecordsFilters: Record<'All' | 'Distance' | 'Global' | 'Manual', string>
    sourceAuto: string; sourceManual: string

    cockpitTileAriaPrev: string; cockpitTileAriaNext: string

    importTitle: string; importInProgress: string; importDone: string; importError: string
    importPending: (n: number, oldest: string | null) => string
    importCompleted: (n: number) => string
    importErrorPrefix: (msg: string) => string
    importErrorUnknown: string
    importRetry: string; importNoBlock: string; importCopied: string
    copyFailed: string; copyFastTimes: (n: number) => string
  }
  settings: {
    title: string; sectionAccount: string; sectionAppearance: string; sectionStartup: string
    sectionConnections: string; sectionProfile: string; logout: string
    themeLight: string; themeDark: string; themeSystem: string
    langSystem: string; langFrench: string; langEnglish: string; comingSoon: string
    languageRow: string; themeDescDark: string; themeDescLight: string; themeDescSystem: string

    pageHeroSubtitle: string; pageHeroIntro: string
    sectionAccountSub: string; sectionProfileSub: string; sectionAppearanceSub: string
    sectionComingSoonSub: string
    helpAboutTitle: string; helpAboutSub: string; footerTagline: string
    backToSettingsAria: string
    profilePageTitle: string; profilePageIntro: string
    identityPageTitle: string; identityPageIntro: string

    roadmap: Record<'intelligence' | 'personalization' | 'raceManagement' | 'physiology', string>
    roadmapItems: Record<
      'coachAi' | 'hrZones' | 'planEditable' | 'dataCockpit' | 'raceCalendar' | 'raceTable' | 'effortIndicators',
      string
    >

    helpSupport: string; helpContactVersion: string
    helpAndSupport: string; helpAndSupportSub: string
    contactLabel: string; versionLabel: string; versionUpToDate: string; versionBuild: string

    emailLabel: string; logoutLabel: string

    stravaConnected: string; stravaOffline: string
    stravaAccountConnected: string; stravaNoAccount: string
    syncShort: string; syncLabel: string
    syncImportedActivities: (n: number) => string
    syncErrorPrefix: (msg: string) => string
    syncErrorNetwork: string; syncErrorUnknown: string
    stravaConnectMyAccount: string

    defaultAthleteName: string
    memberSince: (date: string) => string

    hrCalibrationTitle: string
    hrCalibrationNotConfigured: string
    hrMaxLabel: string
    hrThresholdLabel: string

    sexMale: string; sexFemale: string; sexOther: string; sexUnset: string
    identityChangeAvatarAria: string; identityAvatarAlt: string; identityRemovePhoto: string
    identityAvatarError: string
    identityFirstName: string; identityLastName: string
    identityBirthDate: string; identitySex: string
    identitySaveSaving: string; identitySaveSaved: string; identitySaveError: string
    identitySaveCta: string; identitySaveNoop: string
    identityAccountCreated: string; identitySubscription: string; identitySubscriptionFree: string

    hrMethodCardTitle: string; hrDataCardTitle: string; hrZonesCardTitle: string
    hrSaveSaving: string; hrSaveSaved: string; hrSaveErrorMissing: string; hrSaveCta: string

    hrFieldMax: string; hrFieldAerobic: string; hrFieldAnaerobic: string
    hrFieldThresholdTest30: string; hrFieldResting: string
    hrFieldMaxEstimated: string; hrFieldBirthYear: string
    hrSeeProtocol: string; hrRestingInfoAria: string
    hrDeducedTitle: string; hrDeducedMaxObs: string; hrDeducedRestEst: string; hrDeducedLthrEst: string
    hrRecomputeBtn: string; hrNoActivityFC: string

    restingTitle: string; restingManualTitle: string
    restingManualBody: string; restingManualBeforeRise: string
    restingWatchTitle: string
    restingGarmin: string; restingGarminPath: string
    restingApple: string; restingApplePath: string
    restingCoros: string; restingCorosPath: string
    restingOther: string; restingOtherPath: string
    restingTip: string; restingTipAvg: string

    protocolTitle: string; protocolSubtitle: string; protocolCloseAria: string
    protocolSection1Title: string
    protocolSection1Item1: string; protocolSection1Item2: string; protocolSection1Item3: string
    protocolSection2Title: string
    protocolSection2Item1: string; protocolSection2Item1Bold: string
    protocolSection2Item2: string
    protocolSection2Item3: string; protocolSection2Item3Bold: string
    protocolSection2Item4: string
    protocolSection3Title: string; protocolResult: string; protocolResultHint: string
    protocolFooter: string; protocolGotIt: string

    customZonesZ: (n: number) => string
    customZonesMin: string; customZonesMax: string; customZonesHint: string
    customZoneErrCount: string
    customZoneErrMaxMissing: (z: number) => string
    customZoneErrMissing: (z: number) => string
    customZoneErrInverted: (z: number) => string
    customZoneErrDiscontinuous: (cur: number, expected: number, prev: number) => string

    hrSourcesTitle: string; hrSourcesValueCol: string; hrSourcesUsedCol: string
    hrSourcesSourceCol: string; hrSourcesUpdatedCol: string
    hrSourceRowMaxHr: string; hrSourceRowResting: string
    hrSourceRowAerobic: string; hrSourceRowLthr: string
    hrSourceRowMaxObs: string; hrSourceRowRestEst: string; hrSourceRowLthrEst: string
    hrSourceRowMaxEst: string
    hrSourceTagEntered: string; hrSourceTagStrava: string
    hrSourceTagComputed: string; hrSourceTagAge: string
    hrSourcesFootnote: string; hrSourcesFootnoteBold: string
    hrRelToday: string; hrRelYesterday: string
    hrRelDaysAgo: (n: number) => string

    hrZonesMissing: string
    hrZonesMethodLabel: string; hrZonesConfidenceLabel: string; hrZonesMaxLabel: string
    hrMethodLabels: Record<
      'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom',
      string
    >
    hrMethods: Record<
      'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom',
      { label: string; description: string; badge: string }
    >

    profileFirstName: string; profileLastName: string
    profileFcMax: string; profileFcSeuil: string; profileFcRepos: string; profileFtp: string
    profileWeight: string; profileYearGoal: string
  }
  profile: Record<
    'title' | 'fcMax' | 'fcSeuil' | 'allureSeuil' | 'ftpVelo' | 'objectifAnnuel' | 'poids'
    | 'anneeNaissance' | 'fcRepos' | 'hrReserve' | 'hrLthr',
    string
  >
  intensity: Record<'vma' | 'seuil' | 'cotes' | 'sortieLongue' | 'footing' | 'autre', string>
  weekTable: Record<'headerSession' | 'headerLabel' | 'headerVolume' | 'headerElevation' | 'headerTotal', string>
  plan: {
    structureTitle: string
    blockObjectif: string; blockResume: string; blockCycle: string
    blockCalendar: string; blockWeekLibrary: string; blockCharge: string
    addBlock: string
    modeManual: string; modeAiCoach: string; modeAiSoon: string
    modeAiToast: string
    modeAriaPanning: string; modeAriaManual: string; modeAriaAi: string

    dowLong: readonly [string, string, string, string, string, string, string]
    monthsShort: readonly [string, string, string, string, string, string, string, string, string, string, string, string]
    monthsLong: readonly [string, string, string, string, string, string, string, string, string, string, string, string]
    weekShort: (n: number) => string
    weekRange: (n: number, from: string, to: string) => string

    resumeTitle: string; resumeHelp: string
    weekPrev: string; weekNext: string
    today: string; todayAria: string
    tileObjectif: string; tilePlanifie: string; tileRealise: string; tileRestant: string
    tileObjectifExpl: string; tilePlanifieExpl: string; tileRealiseExpl: string; tileRestantExpl: string
    progressVolume: string; progressElevation: string
    loading: string
    explanationAria: (label: string) => string
    mDPlus: string

    objectifTitle: string; objectifHelpTitle: string; objectifHelp: string
    objectifEmpty: string; objectifEmptyHint: string; objectifFirstCTA: string; objectifFirstAria: string
    objectifAddRaceAria: string
    racePast: string; raceDayToday: string; raceDayTomorrow: string; raceDayRemaining: string
    raceJMinusAria: (n: number) => string
    raceOpenAria: (name: string) => string
    raceMainGoalAria: string; racePriorityAria: (p: string) => string
    raceTypes: Record<'trail' | 'ultra' | 'route' | 'cross' | 'skyrace', string>

    structureTitleBlock: string; structureHelpTitle: string; structureHelp: string
    structureHelpNoRace: string; structureHelpEmpty: string; structureHelpInvalid: string
    structureNoRaceMsg: string
    structureGenerate: (raceName: string, raceDate: string) => string
    structureGenerateBuilt: string
    structureGenerateAria: string; structureGenerateAria2: string
    structureInvalidMsg: string; structureEditAria: string
    structureCycleAria: (label: string, weeks: number) => string
    structureCyclesAria: string
    structureTodayAria: string; structureCollapseAria: string
    structureCycleLabel: (label: string, weeks: number) => string
    structureStartEnd: string; structureDuration: string; structureWeeksSuffix: string
    structureWeeklyGoals: string
    structureWeekCol: string; structureKmCol: string; structureDPlusCol: string
    structureWeekN: (n: number) => string
    structureEditCycle: string
    structureEditCycleAria: (label: string) => string
    structurePlanName: (name: string) => string

    weekTitleBlock: string; weekHelp: string; weekRestDay: string; weekDropHere: string
    weekTotal: string; weekEmptyHint: string
    weekNavPrevAria: string; weekNavNextAria: string
    weekDeleteAria: (title: string) => string
    weekDeleteZone: string
    weekKmShort: string; weekHrShort: string; weekMinShort: string

    weekDayLabels: readonly [string, string, string, string, string, string, string]
    weekTitle: string
    weekTitleWithIdx: (x: number, y: number) => string
    weekHelpExt: string
    weekRangeBetween: (from: string, to: string) => string
    weekCurrent: string; weekCurrentAria: string
    weekDuplicateBtn: string; weekDuplicating: string
    weekAddSessionAria: (date: string) => string
    weekRaceMirrorAria: (title: string) => string
    weekEditSessionAria: (title: string, done: boolean, intensity: number) => string
    weekDistanceAria: (km: number) => string
    weekDPlusAria: (m: number) => string
    weekRaceGoalTitle: string

    libTitle: string; libHelp: string; libEmpty: string
    libAdd: string; libAddAria: string
    libEditAria: (title: string) => string
    libCustomBadge: string; libBuiltinBadge: string
    libCategoryAll: string; libCategoryRun: string; libCategoryBike: string
    libCategorySwim: string; libCategoryOther: string
    libDurationSuffix: string; libDistanceSuffix: string; libElevationSuffix: string
    libManageTypes: string
    libHelpBodyTitle: string; libHelpBodyIntro: string
    libHelpBodyCreate: string; libHelpBodyCreateD: string
    libHelpBodyStruct: string; libHelpBodyStructD: string
    libHelpBodyAdd: string; libHelpBodyAddD: string
    libHelpBodyPerso: string; libHelpBodyPersoD: string
    libHelpBodyDelete: string; libHelpBodyDeleteD: string
    libResetDefaults: string; libResetDefaultsAria: string
    libResetMsg: string; libResetConfirm: string
    libNewBtn: string; libNewBtnAria: string
    libSearchPh: string; libSearchAria: string
    libNoMatch: string
    libShowMore: (n: number) => string
    libShowLess: string
    libDeleteTitle: (title: string) => string
    libDeleteMsgCustom: string; libDeleteMsgSystem: string
    libDeleteConfirm: string
    libFilterByTypeAria: string
    libFilterAll: string
    libFilterCustom: string
    libFilterCollapseAria: string
    libFilterExpandAria: (n: number) => string
    libTemplateCardAria: (title: string) => string
    libTemplateDeleteAria: (title: string) => string
    libIntensityBarAria: (n: number) => string

    calTitle: string; calHelp: string
    calMonthPrev: string; calMonthNext: string
    calTodayLabel: string
    calDayShort: readonly [string, string, string, string, string, string, string]
    calDayLabels: readonly [string, string, string, string, string, string, string]

    chargePlanTitle: string; chargePlanHelp: string
    chargePlanThisWeek: string; chargePlanNextWeek: string
    chargePlanWeekN: (n: number) => string
    chargePlanNoData: string
    chargePlanHelpFull: string
    chargePlanOvershootBadge: string
    chargePlanOvershootAria: string
    chargePlanSvgAria: string
    chargePlanTargetLbl: (n: number) => string

    dayDetailTitle: (date: string) => string
    dayDetailEmpty: string; dayDetailRaceLabel: string
    dayDetailAddSession: string; dayDetailClose: string
    dayDetailCloseAria: string
    dayDetailCreate: string; dayDetailAdd: string; dayDetailCoachSoon: string
    monthsFull: readonly [string, string, string, string, string, string, string, string, string, string, string, string]

    toggleDuration: string; toggleDistance: string; toggleAriaMeasure: string
    toggleIntensity: string; togglePace: string; toggleAriaIntensity: string
    togglePaceDisabledTitle: string
    durationFieldPh: string; durationFieldAria: string; durationFieldFormatErr: string
    paceFieldAria: string
    editBtnLabel: string

    raceEditTitle: string; raceCreateTitle: string
    raceEditAriaEdit: string; raceEditAriaCreate: string
    raceEditFieldName: string; raceEditPhName: string
    raceEditFieldDate: string
    raceEditFieldDistance: string; raceEditFieldDPlus: string
    raceEditFieldType: string
    raceEditFieldLocation: string; raceEditPhLocation: string
    raceEditFieldNotes: string; raceEditPhNotes: string
    raceEditMainCheckbox: string
    raceEditDelete: string; raceEditDeleteAria: string
    raceEditCancel: string; raceEditSave: string

    raceMarkerAria: (name: string, date: string) => string
    raceDrawerAria: (name: string) => string
    raceDrawerInfo: (date: string, km: number, m: number, prio: string) => string
    raceDrawerSeeDetail: string
    raceDrawerClose: string

    typesPrefsTitle: string
    typesPrefsCloseAria: string
    typesPrefsIntro: string
    typesPrefsAddTitle: string
    typesPrefsAddPh: string
    typesPrefsAddAria: string
    typesPrefsCategory: string
    typesPrefsCategories: Record<'run' | 'bike' | 'swim' | 'other', string>
    typesPrefsCategoryHint: string
    typesPrefsAddBtn: string
    typesPrefsCancel: string
    typesPrefsSave: string
    typesPrefsCheckAria: (label: string) => string
    typesPrefsRenameAria: (label: string) => string
    typesPrefsDeleteAria: (label: string) => string
    typesPrefsRenameTitle: string
    typesPrefsRenameConfirmTitle: string
    typesPrefsRenameCancelTitle: string
    typesPrefsRenameConfirmAria: string
    typesPrefsRenameCancelAria: string
    typesPrefsDeleteCustomTitle: (label: string) => string
    typesPrefsDeleteMsgIntro: (label: string) => string
    typesPrefsDeleteMsgTemplates: (n: number) => string
    typesPrefsDeleteMsgSessions: (n: number) => string
    typesPrefsDeleteConfirm: string

    phaseTypes: Record<'foncier' | 'developpement' | 'specifique' | 'affutage' | 'recuperation', string>
    sessionTemplates: Record<string, { title: string; description: string }>
    phaseEditorTitle: string
    phaseEditorAutoGen: string
    phaseEditorAutoGenAria: string
    phaseEditorAutoGenTitleNoRace: string
    phaseEditorAutoGenTitleOk: string
    phaseEditorEmptyList: string
    phaseEditorErrNameRequired: string
    phaseEditorErrDateRequired: string
    phaseEditorErrDateOrder: (label: string) => string
    phaseEditorErrNoRace: string
    phaseEditorErrAutoFailed: string
    phaseEditorErrAtLeastOne: string
    phaseEditorAddPhase: string
    phaseEditorCancel: string
    phaseEditorSave: string
    phaseEditorAriaDialog: string
    phaseEditorDelete: string
    phaseEditorDeleteAria: (label: string) => string
    phaseEditorReorderAria: (label: string) => string
    phaseEditorExpandAria: (label: string, open: boolean) => string
    phaseEditorToggleAria: (open: boolean) => string
    phaseEditorWeeksShort: string
    phaseEditorFieldName: string
    phaseEditorFieldType: string
    phaseEditorFieldFocus: string
    phaseEditorFieldFocusPh: string
    phaseEditorFieldStart: string
    phaseEditorFieldEnd: string
    phaseEditorFieldDescription: string
    phaseEditorWeeklyGoals: string
    phaseEditorWeekCol: string
    phaseEditorVolumeCol: string
    phaseEditorDPlusCol: string
    phaseEditorWeekN: (n: number) => string
    phaseEditorVolumeInputAria: (week: number, label: string) => string
    phaseEditorDPlusInputAria: (week: number, label: string) => string
    phaseEditorCycleLabel: (label: string) => string

    intensityLevels: Record<1 | 2 | 3 | 4 | 5, string>
    zoneKindLabels: Record<'warmup' | 'main' | 'rest' | 'cooldown', string>
    zoneRepeatLabel: string
    zonePresetLabels: Record<'warmup' | 'main' | 'rest' | 'cooldown', string>

    templateEditTitle: string
    templateCreateTitle: string
    templateAriaEdit: string
    templateAriaCreate: string
    templateTabGeneral: string
    templateTabStructure: string
    templateTabNotes: string
    templateTabsAria: string
    templateDuplicate: string
    templateDuplicateSuffix: string
    templateDelete: string
    templateCancel: string
    templateSave: string
    templateTitleLabel: string
    templateTitlePh: string
    templateTypeLabel: string
    templateCatLabels: Record<'run' | 'bike' | 'swim' | 'other', string>
    templateTypeBadgeAria: (label: string) => string
    templateFieldDuration: string
    templateFieldDistance: string
    templateFieldElevation: string
    templateIntensityLabel: (label: string) => string
    templateIntensityAria: (n: number, label: string) => string
    templateTagsLabel: string
    templateTagsPh: string
    templateTagRemoveAria: (tag: string) => string
    templateTagAdd: string
    templateZoneAddRepeat: string
    templateStructureEmpty: string
    templateZonePreview: string
    templateNotesLabel: string
    templateNotesPh: string
    templateRepetitions: string
    templateLabelField: string
    templateLabelFieldPh: string
    templateZoneReorderAria: (kind: string) => string
    templateZoneDeleteAria: string
    templateZoneDelete: string
    templateZoneDurationAria: string
    templateZoneDistanceAria: string
    templateZoneIntensityAria: string
    templateZoneIntensityOption: (n: number, label: string) => string
    templateFallbackName: string

    repeatStepEditTitle: string
    repeatStepLabelField: string
    repeatStepLabelEffortPh: string
    repeatStepLabelRecoveryPh: string
    repeatStepDurationAria: string
    repeatStepDistanceAria: string
    repeatStepIntensityAria: string
    repeatStepIntensityOptionRecup: string
    repeatStepIntensityOptionEnd: string
    repeatStepIntensityOptionTempo: string
    repeatStepIntensityOptionSeuil: string
    repeatStepIntensityOptionVma: string
    repeatStepCancel: string
    repeatStepSave: string

    repeatZoneTitle: string
    repeatZoneRepetitions: string
    repeatZoneSkipLast: string
    repeatZoneStepEffort: string
    repeatZoneStepRecovery: string
    repeatZoneStepEditAria: (kind: string) => string
    repeatZoneStepRemoveAria: (kind: string) => string
    repeatZoneAddEffort: string
    repeatZoneAddRecovery: string
    repeatZoneDeleteAria: string
    repeatZoneDelete: string
    repeatZoneReorderAria: string
    repeatZoneRepeatsAria: string
    repeatZoneRepeatsTimes: string
    repeatZoneAddStep: string
    repeatZoneSkipLastAria: string
    repeatZoneSkipLastLabel: string
    repeatZoneSkipLastTitle: string
    repeatStepEditBtn: string
    repeatStepDefaultLabelEffort: string
    repeatStepDefaultLabelRecovery: string
    repeatStepDeleteAria: string
    repeatStepIntensityShort: Record<1 | 2 | 3 | 4 | 5, string>

    sessionEditTitle: string
    sessionCreateTitle: string
    sessionAriaEdit: string
    sessionAriaCreate: string
    sessionMatchedOne: string
    sessionMatchedMany: (n: number) => string
    sessionMatchedLinkAria: string
    sessionUnlinkAriaOne: string
    sessionUnlinkAriaMany: string
    sessionUnlink: string
    sessionTabGeneral: string
    sessionTabStructure: string
    sessionTabNotes: string
    sessionTabsAria: string
    sessionDuplicate: string
    sessionDuplicateAria: string
    sessionDelete: string
    sessionDeleteAria: string
    sessionCancel: string
    sessionSave: string
    sessionTitleLabel: string
    sessionTitlePh: string
    sessionTypeLabel: string
    sessionDateLabel: string
    sessionFieldDuration: string
    sessionFieldDistance: string
    sessionFieldElevation: string
    sessionIntensityLabel: (label: string) => string
    sessionIntensityAria: (n: number, label: string) => string
    sessionChargeLabel: string
    sessionStructureAddRepeat: string
    sessionStructureEmpty: string
    sessionStructureRepetitions: string
    sessionStructureLabel: string
    sessionStructureLabelPh: string
    sessionStructureReorderAria: (kind: string) => string
    sessionStructureDeleteAria: string
    sessionStructureDelete: string
    sessionDurationAria: string
    sessionDistanceAria: string
    sessionIntensityZoneAria: string
    sessionIntensityOption: (n: number, label: string) => string
    sessionPreviewLabel: string
    sessionNotesLabel: string
    sessionNotesPh: string
    sessionDuplicateFallback: string
    sessionTypeBadgeAria: (label: string) => string
  }
  courses: Record<'title' | 'personal' | 'races', string>
  common: Record<
    'loading' | 'saving' | 'week' | 'month' | 'year' | 'total' | 'all' | 'save' | 'cancel' | 'apply'
    | 'reset' | 'connect' | 'sync' | 'search' | 'delete' | 'back' | 'ascending' | 'descending'
    | 'rest' | 'noActivity' | 'noActivityWeek' | 'connectStravaPrompt'
    | 'blockHelpAria' | 'blockMenuAria' | 'blockHide' | 'close' | 'later',
    string
  >
  hrZones: Record<'z1Name' | 'z2Name' | 'z3Name' | 'z4Name' | 'z5Name' | 'optimalRange', string>
  auth: {
    checkEmailTitle: string
    checkEmailBody: string
    forgotSentTitle: string
    forgotSentBody: string
    backToLogin: string
    appTagline: string
    emailPh: string
    passwordPh: string
    forgotPw: string
    btnSending: string
    btnLoggingIn: string
    btnCreating: string
    btnSendLink: string
    btnLogin: string
    btnSignup: string
    noAccount: string
    haveAccount: string
    createAccount: string
    loginAction: string
    genericError: string
    featCharge: string; featChargeDesc: string
    featEffort: string; featEffortDesc: string
    featCoach: string; featCoachDesc: string
    featUltra: string; featUltraDesc: string
  }
  install: {
    title: string
    closeAria: string
    laterAria: string
    iosBody: string
    iosStep1: string
    iosStep2Lead: string
    iosStep2Choice: string
    iosStep3: string
    iosGotIt: string
    bannerSub: string
    installBtn: string
  }
}

export const fr: Dict = {
  // --- Navigation tabs ---
  tabs: {
    cockpit:    'Cockpit',
    charge:     'Charge',
    plan:       'Plan',
    activities: 'Activités',
    courses:    'Courses',
    settings:   'Réglages',
  },

  // --- Sports ---
  sports: {
    run:            'Course',
    trailRun:       'Trail',
    bike:           'Vélo',
    virtualRide:    'Home trainer',
    ebikeRide:      'E-Bike',
    swim:           'Natation',
    walk:           'Marche',
    hike:           'Rando',
    weightTraining: 'Muscu',
    all:            'Toutes',
    abbr: {
      run:  'RUN',
      bike: 'BIKE',
      swim: 'SWIM',
      all:  'ALL',
    },
  },

  // Strava sport_type → display label mapping
  sportLabel: {
    Run:           'Course',
    TrailRun:      'Course',
    Ride:          'Vélo',
    GravelRide:    'Vélo',
    VirtualRide:   'Home trainer',
    EBikeRide:     'E-Bike',
    Swim:          'Natation',
    Walk:          'Marche',
    Hike:          'Rando',
    WeightTraining:'Muscu',
  } as Record<string, string>,

  // --- Units ---
  units: {
    km:       'km',
    m:        'm',
    kmh:      'km/h',
    perKm:    '/km',
    bpm:      'bpm',
    watts:    'W',
    kg:       'kg',
    pct:      '%',
    pctFcMax: '% FC max',
    ces:      'CES',
    hours:    'h',
  },

  // --- Cockpit blocks ---
  cockpit: {
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

    // Header prefixes (before sport label)
    headerActivities:   'Activités —',
    headerLastActivity: 'Dernière activité —',
    headerGoals:        'Objectifs —',
    headerWeeklyStats:  'Semaines —',
    headerCharge:       'Charge —',
    headerHistory:      'Historique —',
    headerIntensityBlock: 'Type de séance 30j —',
    weekActivitiesPrefix:  'Activités —',
    weekActivitiesSuffix:  'Semaine en cours',
    cumulHeader: (period: 'month' | 'year') => `Cumul km/${period === 'month' ? 'mois' : 'année'} —`,

    // Block labels (in DashboardGrid)
    blockLabel: {
      activities:     'Activités',
      lastActivity:   'Dernière activité',
      goals:          'Objectifs',
      weekly:         'Volume & Ratio',
      charge:         'Charge',
      history:        'Historique',
      cumul:          'Cumul mensuel',
      intensity:      'Intensité',
      week:           'Semaine en cours',
      weekActivities: 'Activités semaine',
    },

    // KPI tile titles
    kmWeek:            'Km semaine',
    dPlusWeek:         'D+ semaine',
    kmYear:            'Km année',
    dPlusYear:         'D+ année',
    elevationPositive: 'Dénivelé positif',
    sessionsCount:     (n: number) => `${n} séance${n !== 1 ? 's' : ''}`,
    chargeTitle:       'CHARGE',
    tsbFreshness:      'TSB (Fraîcheur)',
    lastSevenDays:     '7 derniers jours',
    atl7d:             'ATL (7j)',
    ctl42d:            'CTL (42j)',

    // Aria labels
    aria: {
      activitiesSettings:   'Paramètres activités',
      chargeSettings:       'Paramètres charge',
      chargeHelp:           'Aide sur la charge',
      goalsEdit:            'Modifier les objectifs',
      goalsSettings:        'Paramètres',
      weeklySettings:       'Paramètres volume hebdomadaire',
      historySettings:      'Paramètres historique',
      cumulSettings:        'Paramètres cumul km',
      intensitySettings:    'Paramètres type de séance',
      lastActivityEdit:     "Modifier l'activité",
      lastActivitySettings: 'Paramètres dernière activité',
      weekActivitiesHide:   'Masquer le bloc',
      historyPrev:          'Période précédente',
      historyNext:          'Période suivante',
      yearRange:            "Nombre d'années affichées",
      sportN:               (n: number) => `Sport ${n}`,
    },

    // Modal titles
    modalTitle: {
      activities:   "Volume d'activités",
      charge:       "Charge d'entraînement",
      goals:        'Objectifs — sports',
      weekly:       'Volume hebdomadaire',
      cumul:        'Cumul km par mois',
      intensity:    'Type de séance',
      history:      'Historique',
      lastActivity: 'Dernière activité',
    },

    // SportSettingsModal body
    modal: {
      activitiesToShow:     'Activités à afficher',
      uncheckAllHidesBlock: 'Tout décocher masque ce bloc dans le Cockpit',
      defaultActivity:      'Activité par défaut',
      shownFirst:           'Affichée en premier dans le Cockpit',
      hideBlock:            'Masquer le bloc',
      close:                'Fermer',
    },

    // Period tabs
    periodShort: { week: 'Sem.', month: 'Mois', year: 'An' },
    periodLong:  { month: 'Mois', year: 'Année' },
    weekPrefix:  'Sem.',

    // Goal editor
    goalEdit: {
      titleFor:     (sport: string, emoji: string) => `Objectifs ${sport} ${emoji}`,
      loadFromPlan: (km: number, dPlus: number) => `↻ Charger depuis le plan (${km} km · ${dPlus} m D+)`,
      cancel:       'Annuler',
      save:         'Valider',
      vsGoal:       (diff: number) => `${diff >= 0 ? '+' : ''}${Math.round(diff)} km vs objectif`,
    },

    // Chart tabs
    chartTabs: { vol: 'Vol.', ratio: 'Ratio' },

    // Intensity / sessions
    intensityUndefined: 'Non défini',

    // WeekActivities
    noActivityThisWeek: 'Aucune activité cette semaine.',
    dayAbbr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const,

    // History
    monthNames: [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ] as const,
    noData:          'Aucune donnée',
    totalLabel:      'Total',
    dPlusShort:      'D+',
    durationShort:   'Durée',
    weekPeriodLabel: (mon: string, sun: string) => `Sem. ${mon} → ${sun}`,

    // YearRangeSelector
    yearLabel: (n: number) => `${n} ${n === 1 ? 'année' : 'années'}`,
    yearShortSuffix: 'A',
    yearAll:   'Tout',

    // LastActivity empty
    noActivityFor: (sport: string) => `Aucune activité ${sport.toLowerCase()}.`,
  },

  // --- Charge tab ---
  charge: {
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

    pageTitle:           'Charge',
    sportFilterAll:      'Tout',
    sportFilterRun:      'Course',
    sportFilterRide:     'Vélo',
    sportFilterSwim:     'Natation',
    addBlock:            'Ajouter un bloc',
    sportFilterAria:     'Filtre sport',

    recentFatigue:       'Fatigue récente',
    baseFitness:         'Base de forme',
    freshness:           'Fraîcheur',
    acuteLoad:           'Charge 7j',
    chronicLoad:         'Charge 28j',
    loadBalance:         "Équilibre de charge",
    rampRate:            'Progression',

    blocks: {
      status:                'État de forme du jour',
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

    freshnessZone: {
      'very-fresh':     'Très frais',
      fresh:            'Frais',
      balanced:         'Équilibré',
      'normal-fatigue': 'Fatigue normale',
      'high-fatigue':   'Fatigue élevée',
    },

    ramp: {
      'fast-rise':          'Hausse rapide',
      'controlled-rise':    'Progression maîtrisée',
      'stable':             'Charge stable',
      'progressive-resume': 'Reprise progressive',
      'declining':          'Charge en baisse',
      'sharp-decline':      'Baisse de charge',
    },

    help: {
      status:                "Ce bloc te donne une lecture simple de ta forme du moment. Il compare ce que tu as accumulé récemment avec ta base d'entraînement construite dans la durée.\n\n• Fatigue récente (ATL) : c'est la charge encaissée sur les 7 derniers jours. Plus elle est élevée, plus ton corps a besoin de récupérer.\n\n• Base de forme (CTL) : c'est ton niveau de fond, construit progressivement grâce à la régularité sur les dernières semaines.\n\n• Fraîcheur (TSB) : c'est l'équilibre entre ta base de forme et ta fatigue.\n      - négative, tu tires un peu sur la corde.\n      - positive, tu es plutôt reposé.\n   Un léger négatif est normal quand tu es en phase de charge.\n\nLe verdict affiché en haut résume ces signaux pour t'aider à savoir si tu peux pousser, rester stable ou lever le pied.",
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

    notEnoughData:         'Pas encore assez de données pour calculer la charge.',
    loadingError:          "Impossible de charger ta charge. Réessaie.",
    noActivitiesForSport:  (sport: string) => `Pas encore assez de données ${sport} pour calculer la charge.`,

    // Sport / window short labels
    allSport:           'toute activité',
    windowWeek:         '7j',
    window28d:          '28j',
    window10w:          '10 sem.',

    // Localized labels for the IntensityLabel union (keys = the literal strings)
    intensityLabels: {
      'Récupération':           'Récupération',
      'Endurance Fondamentale': 'Endurance Fondamentale',
      'Endurance active':       'Endurance active',
      'Seuil':                  'Seuil',
      'VMA':                    'VMA',
      'Non déterminée':         'Non déterminée',
    },

    // Mix narrative under intensity pie
    intensityNoteHigh:    'Beaucoup de charge en intensité haute.',
    intensityNoteEasy:    'Majorité de charge en endurance fondamentale.',
    intensityNoteBalanced:'Mix équilibré entre endurance et intensité.',

    // AcuteChronicCard
    acuteChronicRecap:    (pct: string) => `Tes 7 derniers jours représentent ${pct} de ta charge habituelle sur 28 jours.`,
    loadLow:              'Charge faible',
    loadBalanceBalanced:  'Équilibrée',
    loadBalanceHigh:      'Progression élevée',
    loadBalancePeak:      'Pic de charge',

    // FreshnessCard interpret + delta
    freshnessInterpret: {
      'very-fresh':     "Tu es très frais. Attention au sous-entraînement si cette situation dure trop longtemps.",
      fresh:            "Tu es bien reposé.",
      balanced:         "Charge et forme équilibrées.",
      'normal-fatigue': "Fatigue normale d'entraînement. Cohérent en phase de charge.",
      'high-fatigue':   "Fatigue élevée. Pense à insérer une journée de récupération.",
    },
    freshnessDeltaFresher: "plus frais qu'il y a 7 jours",
    freshnessDeltaTired:   "plus fatigué qu'il y a 7 jours",
    freshnessDeltaStable:  'stable depuis 7 jours',
    freshnessSevenDaysAgo: (n: number) => `Il y a 7 jours : ${n}`,

    // WeeklyLoadChart legend
    legendRun:      'Course',
    legendRide:     'Vélo',
    legendSwim:     'Natation',
    legendOther:    'Autres',
    legendAvg4w:    'Moy 4 sem.',
    legendAtlTip:   'Fatigue récente (ATL)',
    legendCtlTip:   'Base de forme (CTL)',
    legendTsbTip:   'Fraîcheur (TSB)',

    // MonotonyStrain mini-labels
    monoTitle:       'Variété de charge',
    strainTitle:     'Contrainte semaine',
    monoUnit:        'monotony 7j',
    strainUnit:      'strain 7j',
    activeDays:      'Jours actifs',
    peakDay:         'Plus grosse journée',

    // LoadHeatmap
    heatLess: 'Moins',
    heatMore: 'Plus',

    // RampRate caption
    rampCaption: 'Variation de la charge totale entre la semaine en cours et la précédente.',

    // LoadInsights empty state
    insightsEmpty: 'Rien à signaler cette semaine.',

    // LoadInsights — translated notes keyed by NoteCode
    notes: {
      'run-heavy':        'Tu as beaucoup chargé en course à pied.',
      'ride-compensates': 'La charge vélo compense une baisse de charge running.',
      'concentrated':     'Beaucoup de charge concentrée sur peu de jours.',
      'monotonous':       'Semaine peu variée. Pense à alterner intensités et durées.',
      'strenuous':        'Semaine très exigeante, prends le temps de récupérer.',
      'high-intensity':   "Beaucoup d'intensité haute cette semaine.",
      'sport-variety':    'Bonne variété entre sports.',
      'low-base':         'Ta base de forme est encore basse, progresse graduellement.',
    },
    notesNoCes: (n: number) => `${n} activité(s) récente(s) n'ont pas de charge exploitable.`,

    // Heatmap days header (Mon..Sun)
    daysHeader: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const,

    // Help sheets (Fraîcheur / Fatigue / Base de forme)
    helpSheet: {
      previousValueAria: (v: number) => `Valeur précédente ${v}`,
      currentValueAria:  (v: number) => `Valeur ${v}`,

      freshness: {
        title: 'Fraîcheur — que faire ?',
        intro: "Le TSB (Training Stress Balance) mesure l'écart entre ta base de forme (CTL — 42 jours) et ta fatigue récente (ATL — 7 jours). Il indique si tu es plutôt frais ou plutôt fatigué aujourd'hui.",
        rows: {
          'very-fresh': {
            label:   'Très frais',
            range:   'TSB ≥ +15',
            meaning: 'Tu es très reposé, ta base de fatigue est très basse.',
            advice:  "Excellente fenêtre pour une grosse séance qualité (VMA, seuil) ou une compétition. Si l'état dure plus de 2 semaines, relance progressivement le volume — risque de sous-entraînement.",
          },
          'fresh': {
            label:   'Frais',
            range:   '+5 ≤ TSB < +15',
            meaning: 'Bien récupéré, prêt à encaisser une charge intense.',
            advice:  'Journée idéale pour une séance qualité : fractionné, seuil, sortie longue rythmée. Tu peux pousser sans risque.',
          },
          'balanced': {
            label:   'Équilibrée',
            range:   '−10 < TSB < +5',
            meaning: 'Équilibre entre charge encaissée et récupération.',
            advice:  "Suis ton plan normalement. C'est la zone de croisière idéale pour progresser dans la durée.",
          },
          'normal-fatigue': {
            label:   'Légère fatigue',
            range:   '−25 < TSB ≤ −10',
            meaning: "Fatigue normale d'une phase de charge.",
            advice:  "Tu peux maintenir le volume mais évite d'enchaîner les séances dures. Insère un footing de récup ou une journée facile.",
          },
          'high-fatigue': {
            label:   'Fatigué',
            range:   'TSB ≤ −25',
            meaning: 'Fatigue marquée — tu accumules plus vite que tu ne récupères.',
            advice:  "1 à 2 jours de repos ou séances très faciles (Z1). Pas d'intensité tant que le TSB n'est pas remonté au-dessus de −10.",
          },
        },
      },

      fatigue: {
        title: 'Fatigue récente — que faire ?',
        intro: "La Fatigue récente (ATL — Acute Training Load) résume la charge accumulée sur les 7 derniers jours. On la compare à ta base de forme (CTL) pour savoir si tu charges au-dessus, en-dessous ou dans la norme.",
        rows: {
          'high': {
            label:   'Élevée',
            range:   'ATL > 115 % du CTL',
            meaning: 'Ta charge sur 7 jours dépasse nettement ta charge habituelle.',
            advice:  'Mode prudence — privilégie la récupération, évite les enchaînements de séances dures. Une journée vraiment facile (footing court) ou de repos est souvent salutaire.',
          },
          'usual': {
            label:   'Habituelle',
            range:   '85 % ≤ ATL ≤ 115 % du CTL',
            meaning: "Charge récente alignée avec ta moyenne d'entraînement.",
            advice:  "Continue ton programme normalement. C'est la zone de fonctionnement saine pour progresser sans casser.",
          },
          'low': {
            label:   'Modérée',
            range:   'ATL < 85 % du CTL',
            meaning: "Tu as moins chargé que d'habitude sur 7 jours.",
            advice:  "Utile en phase d'affûtage avant une course, ou en récupération après un gros bloc. Si involontaire (maladie, voyage), relance progressivement (+10 % max par semaine).",
          },
        },
      },

      fitness: {
        title: 'Base de forme — que faire ?',
        intro: "La Base de forme (CTL — Chronic Training Load) reflète ton niveau d'entraînement construit progressivement sur les ~42 derniers jours. Plus elle est haute, plus tu peux absorber de la charge et progresser.",
        rows: {
          'building': {
            label:   'À construire',
            range:   'CTL < 20',
            meaning: "Ta base d'entraînement est encore basse (reprise, début de cycle ou pratique épisodique).",
            advice:  "Vise la régularité plutôt que l'intensité : 3 à 4 séances par semaine, surtout en endurance. Construire un CTL solide demande plusieurs semaines.",
          },
          'progressing': {
            label:   'En progression',
            range:   '20 ≤ CTL < 40',
            meaning: "Tu construis ta base. Bon niveau pour t'entraîner régulièrement.",
            advice:  "Continue d'augmenter le volume progressivement (≤ +10 % par semaine), introduis des séances qualité une fois par semaine.",
          },
          'solid': {
            label:   'Solide',
            range:   '40 ≤ CTL < 60',
            meaning: "Base d'entraînement solide. Tu peux encaisser des grosses séances et des semaines chargées.",
            advice:  'Idéal pour préparer une compétition. Affine les séances de qualité (seuil, VMA, SL spécifique) et soigne la récupération entre les blocs.',
          },
          'very-solid': {
            label:   'Très solide',
            range:   'CTL ≥ 60',
            meaning: "Niveau d'entraînement élevé, typique d'athlète préparé pour des objectifs ambitieux.",
            advice:  "À ce niveau, gérer la fatigue compte autant que charger. Insère des semaines d'allègement régulières pour rester dans le vert sur la fraîcheur.",
          },
        },
      },
    },
  },

  // --- Activities tab ---
  activities: {
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

    // Indicator/label maps
    intensityLevelLabels: {
      1: 'Récupération',
      2: 'Endurance',
      3: 'Tempo',
      4: 'Seuil',
      5: 'VMA',
    },
    intensityNotMeasured: 'Non mesurée',
    intensityNotMeasuredAria: 'Intensité non mesurée',
    intensityAria: (label: string) => `Intensité ${label}`,
    chargeLevelLabels: {
      1: 'Très basse',
      2: 'Basse',
      3: 'Modérée',
      4: 'Élevée',
      5: 'Très élevée',
    },
    chargeLabel: 'CHARGE :',
    chargeAria: (value: number, level: string) => `Charge ${value}, niveau ${level}`,
    sessionTypeLabels: {
      course:        'Course',
      sortie_longue: 'Sortie Longue',
      fractionne:    'Fractionné',
      seuil_tempo:   'Seuil / Tempo',
      cotes:         'Côtes',
      runtaf:        'Runtaf',
      velotaf:       'Velotaf',
      footing:       'Endurance Fondamentale',
      velo:          'Vélo',
      natation:      'Natation',
      renfo:         'Renfo',
      musculation:   'Musculation',
    },
    sessionTypeUndefined:     'Non défini',
    sessionTypeUndefinedAria: 'Type de séance non défini',
    sessionTypeAria:          (label: string) => `Type de séance : ${label}`,
    mapReplay:                "Rejouer l'animation",
    mapUnavailable:           'Carte non disponible',
    splitsBest:               (pace: string) => `★ Meilleur ${pace}`,
    splitsCount:              'segments',
    hrAvgLabel:               'FC moy',
    hrMaxLabel:               'FC max',
    fracBlocksCount:          'blocs',
    fracFastDetected:         (n: number) => `${n} bloc${n > 1 ? 's' : ''} rapide${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`,
    fracColDistance:          'Distance',
    fracColTime:              'Temps',
    fracColPace:              'Allure',
    fracColElevation:         'D+',
    fracFastBadge:            'RAPIDE',

    // Popups
    popupClose:          'Fermer',
    popupCloseAria:      'Fermer',
    popupChargeTitle:    "Charge d'entraînement (CES)",
    popupChargeIntro:    "La CES mesure la charge d'entraînement globale — durée × intensité × dénivelé. Une longue sortie en endurance peut avoir une CES élevée.",
    cesRanges: {
      r1: 'Séance légère (récup, mobilité)',
      r2: 'Charge modérée (footing, sortie courte)',
      r3: 'Charge significative (sortie longue, tempo)',
      r4: 'Charge élevée (trail avec D+, compétition)',
      r5: 'Charge très élevée (ultra, effort prolongé)',
    },

    popupIntensityTitle: 'Intensité physiologique',
    popupIntensityIntro: 'Déterminée par la distribution du temps dans les 5 zones FC de ton profil. La règle parcourt les seuils du plus intense au plus facile (premier match gagne).',
    intensityDesc: {
      recuperation:     'très facile, récupération active',
      footing:          'endurance fondamentale',
      endurance_active: 'tempo, effort soutenu mais aérobie',
      seuil:            'proche du seuil anaérobie',
      vma:              'VO₂max, effort maximal',
    },
    intensityRule: {
      recuperation:     'aucun seuil supérieur atteint, Z1 dominant',
      footing:          'aucun seuil supérieur atteint, Z2 dominant',
      endurance_active: 'Z3+Z4+Z5 ≥ 40 % du temps actif',
      seuil:            'Z4+Z5 ≥ 20 % du temps actif (séance "qualité" au sens Seiler)',
      vma:              'Z5 ≥ 15 % du temps actif (vraie séance VO₂max, intervals longs)',
    },
    rulePrefix:        'Règle : ',
    popupShortNote:    'Note sur les fractionnés courts',
    popupShortIntervalsHtml:
      "Sur des fractions courtes (300-400 m, ~1 min d'effort), la FC n'a pas le temps d'atteindre Z5 stable malgré l'allure VMA. L'empreinte FC est dominée par Z3-Z4 → ces séances ressortent en <strong>seuil</strong>. Le caractère « VMA » est capturé séparément par le bloc <strong>Type</strong> de séance (chip Fractionné).",
    popupRefs:
      'Références : Daniels (intervals VO₂max ≥ 3-5 min), Seiler & Kjerland (TID polarized, HIT 15-20 %), Coggan / Foster (classification par zone supérieure significative).',

    popupWorkoutTypeTitle: 'Type de séance',
    popupWorkoutTypeIntro: "Notion contextuelle indépendante de l'intensité physiologique. Déterminée par mots-clés du titre de l'activité (et compatibilité du sport pour runtaf / velotaf). Une « Sortie longue » peut être en footing ou endurance active — les deux dimensions sont orthogonales.",
    workoutTypeDesc: {
      sortie_longue: 'séance longue à allure facile à modérée (volume)',
      fractionne:    'intervals courts à allure VMA (200–800 m)',
      seuil_tempo:   'intervals longs au seuil ou tempo run continu (1000–5000 m)',
      cotes:         'travail spécifique en côtes / dénivelé positif',
      course:        'compétition ou objectif chrono (10K, semi, marathon, race)',
      runtaf:        'trajet maison ↔ bureau à pied (Run / TrailRun)',
      velotaf:       'trajet maison ↔ bureau en vélo (Ride / EBike)',
      footing:       'sortie facile en endurance fondamentale (Z2)',
      velo:          'sortie vélo (route, gravel, VTT)',
      natation:      'séance de natation',
      renfo:         'renforcement musculaire (gainage, PPG, mobilité)',
      musculation:   'séance de musculation avec charges',
    },
    workoutTypeRule: {
      sortie_longue: 'titre contient "sortie longue", "sl", "long run", "lsl"',
      fractionne:    'titre contient "vma", "fractionné", "interval", "répétition", ou une distance 200–800 m isolée',
      seuil_tempo:   'titre contient "seuil", "tempo", "threshold", ou une distance 1000–5000 m isolée',
      cotes:         'titre contient "côtes", "montée", "hill" (priorité sur fractionné/seuil)',
      course:        'titre contient "race", "compét", "dossard", "chrono", "10k", "semi", "marathon"',
      runtaf:        'titre contient "runtaf", "taf", "Home 🏃‍♂️", à la fois "Home"/🏠 et "Office"/🏢, ou un emoji commute (🚉/👨‍💻/🏢/🏠) avec une flèche — si sport = Run/TrailRun',
      velotaf:       'titre contient "vélotaf", "taf", "Home 🚴🏻", à la fois "Home"/🏠 et "Office"/🏢, ou un emoji commute (🚉/👨‍💻/🏢/🏠) avec une flèche — si sport = Ride/EBike/VirtualRide',
      footing:       "type manuel sélectionné dans l'éditeur (pas de détection automatique depuis le titre)",
      velo:          "type manuel sélectionné dans l'éditeur",
      natation:      "type manuel sélectionné dans l'éditeur",
      renfo:         "type manuel sélectionné dans l'éditeur",
      musculation:   "type manuel sélectionné dans l'éditeur",
    },
    workoutTypeUndefinedDesc: "Aucun type identifié — le titre ne contient pas de mot-clé reconnu et aucun type n'a été choisi manuellement.",
    workoutTypeUndefinedRule: 'aucune correspondance avec les 7 types ci-dessus',

    // EditActivityModal
    editTitle:              "Modifier l'activité",
    editSectionActivity:    'Activité',
    editSectionMetrics:     'Métriques',
    editSectionSport:       'Sport',
    editSectionIntensity:   'Intensité',
    editSectionType:        'Type',
    editFieldTitle:         'Titre',
    editFieldDistance:      'Distance (km)',
    editFieldDuration:      'Durée (hh:mm:ss)',
    editFieldElevation:     'Dénivelé positif (m)',
    editError:              'Erreur lors de la sauvegarde',
    editErrorUnknown:       'Erreur inconnue',
    editErrorDelete:        'Erreur lors de la suppression',
    editButtonDelete:       'Supprimer',
    editButtonCancel:       'Annuler',
    editButtonSave:         'Enregistrer',
    editEditAriaActivity:   "Modifier l'activité",

    // Sport options labels (raw Strava names)
    sportOptionsLabels: {
      Run:           'Course',
      TrailRun:      'Trail',
      Ride:          'Vélo',
      VirtualRide:   'Vélo virtuel',
      EBikeRide:     'Vélo électrique',
      GravelRide:    'Gravel',
      MountainBikeRide: 'VTT',
      Swim:          'Natation',
      Walk:          'Marche',
      Hike:          'Randonnée',
      WeightTraining:'Musculation',
    } as Record<string, string>,

    // List header / filter labels (ActivitiesClient + CoursesClient)
    headerSearch:           'Rechercher',
    headerFilter:           'Filtre',
    apply:                  'Appliquer',
    reset:                  'Réinitialiser',
    searchByLabel:          'Rechercher par',
    searchTitleLabel:       "Titre de l'activité",
    searchDistanceLabel:    'Distance (km)',
    searchDurationLabel:    'Durée (h:mm:ss)',
    searchElevationLabel:   'Dénivelé positif (m)',
    fromLabel:              'De',
    toLabel:                'à',
    resultsCount:           (n: number) => `${n} résultat${n !== 1 ? 's' : ''}`,
    noResults:              'Aucune activité trouvée.',
    sortFilterTitle:        'Trier et filtrer',
    activityFieldLabel:     'Activité',
    intensityFieldLabel:    'Intensité',
    sessionTypeFieldLabel:  'Type de séance',
    dateLabel:              'Date',
    paceLabel:              'Allure',
    durationLabel:          'Durée',
    distanceLabel:          'Distance',
    dPlusLabel:             'D+',
    allOption:              'Toutes',
    allMascAria:            'Tous',
    placeholderKm:          'km',
    placeholderHms:         'h:mm:ss',
    placeholderM:           'm',
    placeholderPace:        'mm:ss',
    speedLabel:             'Vitesse',
    cesShortLabel:          'CES',
    tileEffort:             'Effort',
    historyLoadingHint:     ' (historique en cours de chargement…)',
    historyLoading:         "Chargement de l'historique complet…",
    connectStravaImport:    'Connecte Strava dans Réglages pour importer tes activités.',
    noActivityMatch:        'Aucune activité ne correspond aux filtres.',

    // Detail tiles
    detailCardio:           'Cardio',
    detailPerformance:      'Performance',
    detailTime:             'Temps',
    detailHrAvg:            'FC moyenne',
    detailHrMax:            'FC max',
    detailCalories:         'Calories',
    detailSufferStrava:     'Efforts Relatifs (Strava)',
    detailActiveTime:       'Temps actif',
    detailTotalTime:        'Temps total',
    detailAvgPace:          'Allure moy.',
    detailMaxPace:          'Allure max',
    detailAvgSpeed:         'Vitesse moy.',
    detailMaxSpeed:         'Vitesse max',
    detailVap:              'VAP',
    detailAvgCadence:       'Cadence moy.',
    detailAvgPower:         'Puissance moy.',
    detailMaxPower:         'Puissance max',
    detailEnergy:           'Énergie',
    detailDurationLabel:    'Durée',
    detailElapsedTime:      'Tps écoulé',
    splitsInterval:         'Fractionné',

    // Detail page (ActivityDetailClient)
    detailNotFound:         'Activité introuvable.',
    detailBackToList:       'Retour à la liste',
    detailEditAria:         "Modifier l'activité",
    detailMap:              'Tracé',
    detailHeartRateZones:   'Zones cardiaques',
    detailSplits:           'Splits',
    detailFractionneSplits: 'Splits fractionné',

    // Course filter additions (CoursesClient)
    coursesSearchTitle:     'Titre de la course',
    distanceTypeLabel:      'Distance type',
    noRaceFound:            'Aucune course trouvée.',
    noRacePlanned:          "Aucune course planifiée. Ajoute-en une depuis l'onglet Plan.",
    noRaceMatch:            'Aucune course ne correspond aux filtres.',
    noRaceLogged:           "Aucune course enregistrée. Tague une activité comme \"Course\" dans l'onglet Activités pour la voir ici.",
    upcomingRaces:          'Prochaines courses',
    upcomingRacesHelp:      "Les courses planifiées dans l'onglet Plan dont la date est à venir, triées de la plus proche à la plus lointaine. Clique sur une course pour ouvrir sa fiche.",
    summary:                'Résumé',
    summaryHelp:            'Synthèse globale de tes courses passées : nombre total, kilomètres cumulés, date de la dernière course, dénivelé maximum.',
    racesList:              'Liste des courses',
    racesListHelp:          "Toutes tes activités taguées comme 'Course' (manuellement ou détectées automatiquement depuis le titre). Utilise la recherche et les filtres pour affiner.",
    racesSummaryRaces:      'courses',
    racesSummaryTotalKm:    'km total',
    racesSummaryLastDate:   'dernière',
    racesSummaryMaxDPlus:   'max D+',
    raceObjective:          'Objectif',
    raceObjectiveMain:      'Principal',
    raceMDPlus:             'm D+',
    raceRecordsTab:         'Records',
    raceTabRaces:           'Courses',
    raceRecordsTitle:       'Records',
    raceRecordsTotal:       'records',
    raceRecordsAuto:        'auto',
    raceRecordsSports:      'sports',
    raceRecordsEmpty:       'Aucun record dans cette catégorie.',
    raceRecordsFilters: {
      All:      'Tous',
      Distance: 'Distance',
      Global:   'Globaux',
      Manual:   'Manuel',
    },
    sourceAuto:             'Auto',
    sourceManual:           'Manuel',

    // Cockpit KPI tile aria
    cockpitTileAriaPrev:    'Période précédente',
    cockpitTileAriaNext:    'Période suivante',

    // Import banner
    importTitle:            "Synchronisation Strava",
    importInProgress:       'Synchronisation en cours…',
    importDone:             'Synchronisation terminée.',
    importError:            'Erreur de synchronisation.',
    importPending:          (n: number, oldest: string | null) =>
      `Import Strava — ${n} activité${n > 1 ? 's' : ''}${oldest ? ` (remonté jusqu'à ${oldest})` : ''}`,
    importCompleted:        (n: number) => `Import Strava terminé — ${n} activité${n > 1 ? 's' : ''}`,
    importErrorPrefix:      (msg: string) => `Import Strava : ${msg}`,
    importErrorUnknown:     'erreur inconnue',
    importRetry:            'Réessayer',
    importNoBlock:          'Aucun bloc rapide détecté',
    importCopied:           'Copié !',
    copyFailed:             'Impossible de copier',
    copyFastTimes:          (n: number) => `Copier les temps rapides (${n})`,
  },

  // --- Settings tab ---
  settings: {
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
    languageRow:        'Langue',
    themeDescDark:      'Interface sombre optimisée pour la lecture en extérieur.',
    themeDescLight:     'Interface claire adaptée aux environnements bien éclairés.',
    themeDescSystem:    "Suit automatiquement le réglage système de l'appareil.",

    // Settings page
    pageHeroSubtitle:    'Compte, connexions & préférences',
    pageHeroIntro:       'Gère ton identité, tes intégrations sportives et l’apparence de ton cockpit.',
    sectionAccountSub:   'Identité Trail Cockpit et intégrations tierces',
    sectionProfileSub:   'Aperçu de ton profil sportif et accès à la calibration cardiaque',
    sectionAppearanceSub:'Thème et langue de l’interface',
    sectionComingSoonSub:'Prochaines étapes du produit',
    helpAboutTitle:      'Aide & À propos',
    helpAboutSub:        'Mentions, support et version de l’application',
    footerTagline:       'Trail Cockpit · Conçu pour les coureurs de trail',
    backToSettingsAria:  'Retour aux Réglages',
    profilePageTitle:    'Calibration FC & zones cardiaques',
    profilePageIntro:    "Ces réglages calibrent tes zones de fréquence cardiaque et améliorent l'interprétation de l'effort.",
    identityPageTitle:   'Identité',
    identityPageIntro:   'Modifie ton nom et ta photo de profil.',

    // Roadmap groups
    roadmap: {
      intelligence:      'Intelligence',
      personalization:   'Personnalisation',
      raceManagement:    'Gestion de course',
      physiology:        'Indicateurs physiologiques',
    },
    roadmapItems: {
      coachAi:           'Coach IA personnalisé (résumé hebdo, conseil du jour)',
      hrZones:           'Zones cardiaques configurables (manuel · déduit · mixte)',
      planEditable:      'Plan d’entraînement personnalisable manuellement',
      dataCockpit:       'Data cockpit entièrement personnalisables',
      raceCalendar:      'Définir son calendrier de course',
      raceTable:         'Tableau de plan de course (ravito, BH, temps de passage)',
      effortIndicators:  'Amélioration des indicateurs d’effort et de fatigue',
    },

    // HelpAboutSection
    helpSupport:         'Support',
    helpContactVersion:  'Contact & Version',
    helpAndSupport:      'Aide & Support',
    helpAndSupportSub:   'Contact, confidentialité, à propos',
    contactLabel:        'Contact',
    versionLabel:        'Version',
    versionUpToDate:     'À jour',
    versionBuild:        'Build PWA',

    // AccountSection
    emailLabel:          'Email',
    logoutLabel:         'Déconnexion',

    // StravaSection
    stravaConnected:     'Connecté',
    stravaOffline:       'Hors ligne',
    stravaAccountConnected: 'Compte connecté',
    stravaNoAccount:     'Aucun compte lié',
    syncShort:           'Synchro…',
    syncLabel:           'Synchroniser',
    syncImportedActivities: (n: number) => `${n} activité(s) importée(s)`,
    syncErrorPrefix:     (msg: string) => `Erreur : ${msg}`,
    syncErrorNetwork:    'Erreur réseau',
    syncErrorUnknown:    'inconnue',
    stravaConnectMyAccount: 'Connecter mon compte Strava',

    // IdentityPreview
    defaultAthleteName: 'Athlète',
    memberSince: (date: string) => `Membre depuis ${date}`,

    // HrCalibrationTeaser
    hrCalibrationTitle: 'Calibration FC & zones cardiaques',
    hrCalibrationNotConfigured: 'Pas encore configuré — calibre tes zones',
    hrMaxLabel: 'FCmax',
    hrThresholdLabel: 'Seuil',

    sexMale:                 'Homme',
    sexFemale:               'Femme',
    sexOther:                'Autre',
    sexUnset:                'Non précisé',
    identityChangeAvatarAria:'Changer la photo de profil',
    identityAvatarAlt:       'Avatar',
    identityRemovePhoto:     'Retirer la photo',
    identityAvatarError:     'Erreur photo — réessayer',
    identityFirstName:       'Prénom',
    identityLastName:        'Nom',
    identityBirthDate:       'Date de naissance',
    identitySex:             'Sexe',
    identitySaveSaving:      'Enregistrement…',
    identitySaveSaved:       '✓ Enregistré',
    identitySaveError:       'Erreur — réessayer',
    identitySaveCta:         'Enregistrer les modifications',
    identitySaveNoop:        'Aucune modification',
    identityAccountCreated:  'Compte créé',
    identitySubscription:    'Abonnement',
    identitySubscriptionFree:'Free',

    // HrCalibrationCard
    hrMethodCardTitle:       'Méthode de calcul des zones',
    hrDataCardTitle:         'Données cardio',
    hrZonesCardTitle:        'Zones FC utilisées',
    hrSaveSaving:            'Enregistrement…',
    hrSaveSaved:             '✓ Enregistré',
    hrSaveErrorMissing:      'Erreur — champs requis manquants ou échec',
    hrSaveCta:               'Enregistrer le profil',

    // HrCardioFields
    hrFieldMax:              'FC max',
    hrFieldAerobic:          'Seuil aérobie / AeT',
    hrFieldAnaerobic:        'Seuil anaéro / LTHR',
    hrFieldThresholdTest30:  'FC seuil test 30 min',
    hrFieldResting:          'FC repos',
    hrFieldMaxEstimated:     'FC max estimée (calculée)',
    hrFieldBirthYear:        'Année de naissance (requis)',
    hrSeeProtocol:           '📖 Voir le protocole du test',
    hrRestingInfoAria:       'Comment mesurer la FC repos',
    hrDeducedTitle:          'Détecté depuis Strava :',
    hrDeducedMaxObs:         'FC max observée',
    hrDeducedRestEst:        'FC repos estimée',
    hrDeducedLthrEst:        'LTHR estimée',
    hrRecomputeBtn:          "🔄 Recalculer depuis l'historique",
    hrNoActivityFC:          'Aucune activité avec FC trouvée. Importe des activités Strava pour activer ce mode.',

    // RestingHrInfoPopover
    restingTitle:            'Comment mesurer ta FC repos ?',
    restingManualTitle:      '🛏 Méthode manuelle',
    restingManualBody:       'Le matin, juste après le réveil, avant de te lever. Compte tes pulsations 60 secondes (poignet ou carotide). Refais sur 3 matins, garde la moyenne.',
    restingManualBeforeRise: 'avant de te lever',
    restingWatchTitle:       '⌚ Sur ta montre / appli',
    restingGarmin:           'Garmin Connect',
    restingGarminPath:       'Plus … (en bas à droite) → Statistiques de santé → Fréquence cardiaque → 7j (en bas à gauche)',
    restingApple:            'Apple Watch',
    restingApplePath:        'Santé → Cœur → Fréquence cardiaque au repos',
    restingCoros:            'Coros',
    restingCorosPath:        'App → Santé → FC au repos (mesure nocturne)',
    restingOther:            'Polar / Suunto / Fitbit',
    restingOtherPath:        "section « Repos / RHR » de l'app",
    restingTip:              '💡 La FC repos varie. Note plutôt la moyenne sur 7–14 jours, hors période de fatigue / malade.',
    restingTipAvg:           'moyenne sur 7–14 jours',

    // TestProtocolModal
    protocolTitle:           'Protocole — Test terrain 30 min',
    protocolSubtitle:        'Méthode Coggan / Friel — détermine ta LTHR',
    protocolCloseAria:       'Fermer',
    protocolSection1Title:   '✓ À faire avant',
    protocolSection1Item1:   "Repos complet 24h, hydratation, pas d'alcool la veille",
    protocolSection1Item2:   'Choisir un parcours plat ou piste, par temps tempéré',
    protocolSection1Item3:   'Échauffement 15 min progressif (Z1 → Z3)',
    protocolSection2Title:   '⏱ Pendant le test',
    protocolSection2Item1:   'Cours 30 minutes en continu à allure maximale soutenable',
    protocolSection2Item1Bold:'30 minutes en continu à allure maximale soutenable',
    protocolSection2Item2:   "Démarre à un rythme que tu sais tenir 30 min — pas un sprint",
    protocolSection2Item3:   'Démarre le lap après 10 min de test (clé du protocole)',
    protocolSection2Item3Bold:'après 10 min',
    protocolSection2Item4:   'Garde un effort très régulier sur les 20 dernières minutes',
    protocolSection3Title:   '📊 Lecture du résultat',
    protocolResult:          'FC moyenne des 20 dernières minutes = ta LTHR',
    protocolResultHint:      "C'est cette valeur que tu reportes dans « FC seuil test 30 min ».",
    protocolFooter:          "💡 À refaire tous les 3–6 mois ou après un bloc d'entraînement structurant. La LTHR évolue avec ta forme.",
    protocolGotIt:           "J'ai compris, fermer",

    // CustomZonesEditor
    customZonesZ:            (n: number) => `Z${n}`,
    customZonesMin:          'Min',
    customZonesMax:          'Max',
    customZonesHint:         'Vérifie que les zones personnalisées sont continues, croissantes et sans chevauchement.',
    customZoneErrCount:      'Il faut exactement 5 zones.',
    customZoneErrMaxMissing: (z: number) => `Z${z} : valeur max manquante`,
    customZoneErrMissing:    (z: number) => `Z${z} : valeur manquante`,
    customZoneErrInverted:   (z: number) => `Z${z} : min > max`,
    customZoneErrDiscontinuous: (cur: number, expected: number, prev: number) =>
      `Z${cur} doit commencer à ${expected} (continuité avec Z${prev})`,

    // HrSourcesPanel
    hrSourcesTitle:          'Sources des valeurs',
    hrSourcesValueCol:       'Valeur',
    hrSourcesUsedCol:        'Utilisée',
    hrSourcesSourceCol:      'Source',
    hrSourcesUpdatedCol:     'Maj',
    hrSourceRowMaxHr:        'FC max',
    hrSourceRowResting:      'FC repos',
    hrSourceRowAerobic:      'AeT (aérobie)',
    hrSourceRowLthr:         'LTHR (anaéro)',
    hrSourceRowMaxObs:       'FC max observée',
    hrSourceRowRestEst:      'FC repos estimée',
    hrSourceRowLthrEst:      'LTHR estimée',
    hrSourceRowMaxEst:       'FC max estimée',
    hrSourceTagEntered:      '✓ Saisie',
    hrSourceTagStrava:       '📡 Strava',
    hrSourceTagComputed:     '∫ Calculée',
    hrSourceTagAge:          '📅 Âge',
    hrSourcesFootnote:       'Les valeurs en blanc sont utilisées par la méthode active. Les autres sont calculées en parallèle, dispo si tu changes de méthode.',
    hrSourcesFootnoteBold:   'en blanc',
    hrRelToday:              "aujourd'hui",
    hrRelYesterday:          'hier',
    hrRelDaysAgo:            (n: number) => `il y a ${n}j`,

    // HrZonesDisplay
    hrZonesMissing:          'Données manquantes :',
    hrZonesMethodLabel:      'Méthode',
    hrZonesConfidenceLabel:  'Fiabilité',
    hrZonesMaxLabel:         'FC max',
    hrMethodLabels: {
      seuils:   'Seuils',
      test30:   'Test 30min',
      karvonen: 'Karvonen',
      pct_max:  '% FC max',
      auto:     'Estimation',
      deduced:  'Déduites',
      custom:   'Personnalisé',
    },

    // HR_METHODS (HrZoneMethod radio list)
    hrMethods: {
      seuils: {
        label: 'Seuils physiologiques',
        description: 'Le plus précis : seuils aérobie + anaérobie mesurés.',
        badge: 'Excellent',
      },
      test30: {
        label: 'Test terrain 30 min',
        description: 'Test 30 min : FC moyenne des 20 dernières minutes = ta LTHR.',
        badge: 'Très bien',
      },
      karvonen: {
        label: 'Réserve FC / Karvonen',
        description: "Basé sur la FC max + FC repos. Plus pertinent qu'un simple % de FC max.",
        badge: 'Bien',
      },
      pct_max: {
        label: '% FC max',
        description: 'Simple : uniquement la FC max.',
        badge: 'Correct',
      },
      auto: {
        label: 'Estimation automatique',
        description: "FC max estimée par l'âge (208 − 0.7 × âge).",
        badge: 'Approximatif',
      },
      deduced: {
        label: 'Déduire automatiquement',
        description: "L'app analyse ton historique Strava pour déduire FC max observée, FC repos et seuils.",
        badge: 'Adaptatif',
      },
      custom: {
        label: 'Personnalisé',
        description: 'Tu saisis tes 5 zones manuellement (Z1 à Z5).',
        badge: 'Custom',
      },
    },

    // ProfileSection
    profileFirstName:        'Prénom',
    profileLastName:         'Nom',
    profileFcMax:            'FC Max',
    profileFcSeuil:          'FC Seuil',
    profileFcRepos:          'FC Repos',
    profileFtp:              'FTP',
    profileWeight:           'Poids',
    profileYearGoal:         'Objectif/an',
  },

  // --- Athlete profile ---
  profile: {
    title:           'Profil athlète',
    fcMax:           'FC max',
    fcSeuil:         'FC seuil',
    allureSeuil:     'Allure seuil',
    ftpVelo:         'FTP vélo',
    objectifAnnuel:  'Objectif annuel',
    poids:           'Poids',
    anneeNaissance:  'Année de naissance',
    fcRepos:         'FC repos',
    hrReserve:       'Réserve FC',
    hrLthr:          'FC seuil — test 30min',
  },

  // --- Intensity categories (pie chart) ---
  intensity: {
    vma:          'VMA',
    seuil:        'Seuil',
    cotes:        'Côtes',
    sortieLongue: 'Sortie longue',
    footing:      'Endurance Fondamentale',
    autre:        'Autre',
  },

  // --- Week table ---
  weekTable: {
    headerSession:   'Séance',
    headerLabel:     'Label',
    headerVolume:    'Volume (km)',
    headerElevation: 'D+ (m)',
    headerTotal:     'Total',
  },

  // --- Plan tab ---
  plan: {
    structureTitle: "Structure d'entraînement",
    blockObjectif:        'Objectif course',
    blockResume:          'Résumé semaine',
    blockCycle:           'Cycle de préparation',
    blockCalendar:        'Calendrier mois',
    blockWeekLibrary:     'Semaine & Bibliothèque',
    blockCharge:          'Charge planifiée',
    addBlock:             'Ajouter un bloc',
    modeManual:           'Manuel',
    modeAiCoach:          'IA Coach',
    modeAiSoon:           'Bientôt',
    modeAiToast:          'Le coach IA arrive prochainement',
    modeAriaPanning:      'Mode de planification',
    modeAriaManual:       'Mode Manuel (actif)',
    modeAriaAi:           'Mode IA Coach (bientôt disponible)',

    // Date helpers
    dowLong: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const,
    monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const,
    monthsLong: [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ] as const,
    weekShort: (n: number) => `S${n}`,
    weekRange: (n: number, from: string, to: string) => `S${n} — ${from} au ${to}`,

    // ResumeSemaineBlock
    resumeTitle:         'Résumé semaine',
    resumeHelp:          'Comparaison objectif vs prévu vs restant sur la semaine sélectionnée.',
    weekPrev:            'Semaine précédente',
    weekNext:            'Semaine suivante',
    today:               "Aujourd'hui",
    todayAria:           "Revenir à aujourd'hui",
    tileObjectif:        'Objectif',
    tilePlanifie:        'Planifié',
    tileRealise:         'Réalisé',
    tileRestant:         'Restant',
    tileObjectifExpl:    "Cible hebdomadaire de la phase courante d'entrainement. Source : ton plan d'entraînement.",
    tilePlanifieExpl:    "Somme des séances running planifiées cette semaine (km + D+). N'inclut pas vélo/natation/renfo. Source : séances du calendrier d'entrainement (hebdomadaire ou mensuel).",
    tileRealiseExpl:     'Activités running réalisées depuis le début de la semaine (km et D+).',
    tileRestantExpl:     "Ce qu'il te reste à courir pour atteindre l'objectif (Restant = Objectif − Réalisé).",
    progressVolume:      'Volume semaine',
    progressElevation:   'Dénivelé',
    loading:             'Chargement…',
    explanationAria:     (label: string) => `Explication ${label}`,
    mDPlus:              'm D+',

    // ObjectifCourseBlock
    objectifTitle:       'Objectif course',
    objectifHelpTitle:   'Ton objectif',
    objectifHelp:        "Définis la course principale qui structure ta prépa. Tu peux ajouter d'autres courses secondaires en saison.",
    objectifEmpty:       'Définis ton objectif',
    objectifEmptyHint:   'Ton objectif structure toute ta prépa.',
    objectifFirstCTA:    '+ Définir mon premier objectif',
    objectifFirstAria:   'Définir mon premier objectif',
    objectifAddRaceAria: 'Ajouter une nouvelle course',
    racePast:            'Course passée',
    raceDayToday:        "c'est aujourd'hui",
    raceDayTomorrow:     'demain',
    raceDayRemaining:    'jours restants',
    raceJMinusAria:      (n: number) => `J moins ${n} jours`,
    raceOpenAria:        (name: string) => `Ouvrir le détail de la course ${name}`,
    raceMainGoalAria:    'Course objectif principale',
    racePriorityAria:    (p: string) => `Course priorité ${p}`,
    raceTypes: {
      trail:   'Trail',
      ultra:   'Ultra',
      route:   'Route',
      cross:   'Cross',
      skyrace: 'Skyrace',
    },

    // StructurePrepaBlock
    structureTitleBlock: 'Structure de prépa',
    structureHelpTitle:  'Cycles de prépa',
    structureHelp:       'Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération.',
    structureHelpNoRace: 'Définis une course objectif au-dessus pour démarrer ta prépa.',
    structureHelpEmpty:  'Découpe la prépa en mésocycles : foncier, développement, spécifique, affûtage, récupération.',
    structureHelpInvalid:'Macrocycle de durée nulle ou inversée — édite les dates pour corriger.',
    structureNoRaceMsg:  "Définis d'abord ta course objectif dans le bloc ci-dessus.",
    structureGenerate:   (raceName: string, raceDate: string) =>
      `Génère ta prépa pour ${raceName} (${raceDate}) depuis aujourd'hui.`,
    structureGenerateBuilt: "Génère automatiquement la structure de ta prépa depuis aujourd'hui jusqu'à la course objectif.",
    structureGenerateAria: 'Générer ma prépa',
    structureGenerateAria2:'Générer ma structure de prépa',
    structureInvalidMsg: "Les dates du macrocycle sont invalides. Édite-le pour repartir d'une plage cohérente.",
    structureEditAria:   'Éditer les cycles',
    structureCycleAria:  (label: string, weeks: number) => `Cycle ${label}, ${weeks} semaines`,
    structureCyclesAria: 'Cycles du plan',
    structureTodayAria:  "Aujourd'hui",
    structureCollapseAria:'Replier le cycle',
    structureCycleLabel: (label: string, weeks: number) => `${label} · ${weeks}sem`,
    structureStartEnd:   'Début → Fin :',
    structureDuration:   'Durée :',
    structureWeeksSuffix:'sem',
    structureWeeklyGoals:'Objectifs semaine par semaine',
    structureWeekCol:    'Semaine',
    structureKmCol:      'Km',
    structureDPlusCol:   'D+',
    structureWeekN:      (n: number) => `Sem ${n}`,
    structureEditCycle:  'Éditer ce cycle',
    structureEditCycleAria: (label: string) => `Éditer le cycle ${label}`,
    structurePlanName:   (name: string) => `Prépa ${name}`,

    // VueSemaineBlock
    weekTitleBlock:      'Semaine en cours',
    weekHelp:            'Glisse des séances de la bibliothèque vers les colonnes du jour pour planifier ta semaine.',
    weekRestDay:         'Repos',
    weekDropHere:        'Dépose ici',
    weekTotal:           'Total',
    weekEmptyHint:       'Glisse une séance ici',
    weekNavPrevAria:     'Semaine précédente',
    weekNavNextAria:     'Semaine suivante',
    weekDeleteAria:      (title: string) => `Supprimer ${title}`,
    weekDeleteZone:      'Déposer ici pour supprimer',
    weekKmShort:         'km',
    weekHrShort:         'h',
    weekMinShort:        'min',

    // VueSemaineBlock extra
    weekDayLabels:       ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] as const,
    weekTitle:           'Semaine',
    weekTitleWithIdx:    (x: number, y: number) => `Semaine ${x} / ${y}`,
    weekHelpExt:         'Calendrier de la semaine sélectionnée. Glisse-dépose des templates depuis la bibliothèque pour planifier une séance.',
    weekRangeBetween:    (from: string, to: string) => `du ${from} au ${to}`,
    weekCurrent:         'En cours',
    weekCurrentAria:     'Revenir à la semaine en cours',
    weekDuplicateBtn:    'Dupliquer la semaine',
    weekDuplicating:     'Duplication…',
    weekAddSessionAria:  (date: string) => `Ajouter une séance le ${date}`,
    weekRaceMirrorAria:  (title: string) => `Ouvrir le détail de la course ${title}`,
    weekEditSessionAria: (title: string, done: boolean, intensity: number) =>
      `Éditer la séance ${title}${done ? ' (réalisée)' : ''} (intensité ${intensity} sur 5, glisser pour déplacer)`,
    weekDistanceAria:    (km: number) => `Distance ${km} kilomètres`,
    weekDPlusAria:       (m: number) => `D plus ${m} mètres`,
    weekRaceGoalTitle:   'Course objectif',

    // BibliothequeSeancesBlock
    libTitle:            'Bibliothèque',
    libHelp:             'Glisse une séance vers ton calendrier pour la planifier. Crée tes propres modèles depuis le bouton +.',
    libEmpty:            'Aucune séance dans ta bibliothèque.',
    libAdd:              '+ Nouvelle séance',
    libAddAria:          'Créer une nouvelle séance',
    libEditAria:         (title: string) => `Modifier ${title}`,
    libCustomBadge:      'Perso',
    libBuiltinBadge:     'Catalogue',
    libCategoryAll:      'Toutes',
    libCategoryRun:      'Course',
    libCategoryBike:     'Vélo',
    libCategorySwim:     'Natation',
    libCategoryOther:    'Autre',
    libDurationSuffix:   'min',
    libDistanceSuffix:   'km',
    libElevationSuffix:  'm D+',
    libManageTypes:      'Gérer les types',
    libHelpBodyTitle:    'Ta bibliothèque personnelle',
    libHelpBodyIntro:    "de séances, organisée par type d'activité.",
    libHelpBodyCreate:   'Créer une séance',
    libHelpBodyCreateD:  "— bouton « + Nouveau » en haut → formulaire complet (type, durée, structure, notes).",
    libHelpBodyStruct:   'Structure',
    libHelpBodyStructD:  '— décomposer en segments : échauffement, blocs « Répéter » avec séries/récup, retour au calme.',
    libHelpBodyAdd:      'Ajouter au calendrier',
    libHelpBodyAddD:     '— appui long sur une séance puis glisser dans la semaine.',
    libHelpBodyPerso:    'Personnaliser',
    libHelpBodyPersoD:   "— pill « ⚙ Personnalisé » en fin de barre pour cocher/décocher ou ajouter des activités (Tennis, Yoga…).",
    libHelpBodyDelete:   'Supprimer une séance',
    libHelpBodyDeleteD:  '— croix ✕ en haut à droite de la carte (avec confirmation). Les séances par défaut sont masquées localement et peuvent être restaurées ci-dessous.',
    libResetDefaults:    'Réinitialiser les séances par défaut',
    libResetDefaultsAria:'Réinitialiser les séances par défaut',
    libResetMsg:         'Toutes les séances par défaut masquées seront restaurées dans ta bibliothèque. Tes séances personnalisées ne sont pas affectées.',
    libResetConfirm:     'Réinitialiser',
    libNewBtn:           '+ Nouveau',
    libNewBtnAria:       'Créer un nouveau template de séance',
    libSearchPh:         'Rechercher…',
    libSearchAria:       'Rechercher dans la bibliothèque',
    libNoMatch:          'Aucun template ne correspond.',
    libShowMore:         (n: number) => `↓ Voir ${n} template${n > 1 ? 's' : ''} de plus`,
    libShowLess:         '↑ Voir moins',
    libDeleteTitle:      (title: string) => `Supprimer « ${title} » ?`,
    libDeleteMsgCustom:  'Le template sera définitivement supprimé de ta bibliothèque.',
    libDeleteMsgSystem:  'Le template par défaut sera masqué de ta bibliothèque. Tu pourras le restaurer via l’icône ⓘ → « Réinitialiser les séances par défaut ».',
    libDeleteConfirm:    'Supprimer',
    libFilterByTypeAria: 'Filtrer par type',
    libFilterAll:        'Tous',
    libFilterCustom:     '⚙ Personnalisé',
    libFilterCollapseAria: 'Réduire les filtres',
    libFilterExpandAria: (n: number) => `Voir tous les filtres (${n})`,
    libTemplateCardAria: (title: string) => `Template ${title} — cliquer pour éditer, glisser vers un jour pour planifier`,
    libTemplateDeleteAria: (title: string) => `Supprimer le template ${title}`,
    libIntensityBarAria: (n: number) => `Intensité ${n} sur 5`,

    // CalendrierMoisBlock
    calTitle:            'Calendrier',
    calHelp:             "Vue d'ensemble du mois — séances planifiées, charges et courses. Clique sur un jour pour voir le détail.",
    calMonthPrev:        'Mois précédent',
    calMonthNext:        'Mois suivant',
    calTodayLabel:       "Aujourd'hui",
    calDayShort:         ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const,
    calDayLabels:        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const,

    // ChargePlanifieeBlock
    chargePlanTitle:     'Charge planifiée',
    chargePlanHelp:      'Charge prévue par les séances planifiées sur les 4 prochaines semaines.',
    chargePlanThisWeek:  'Cette semaine',
    chargePlanNextWeek:  'Semaine prochaine',
    chargePlanWeekN:     (n: number) => `Semaine +${n}`,
    chargePlanNoData:    'Aucune séance planifiée sur les 4 prochaines semaines.',
    chargePlanHelpFull:  'Cumul de la charge estimée des séances planifiées sur 4 semaines (W-1 à W+2). Ligne pointillée = cible hebdo de la phase courante.',
    chargePlanOvershootBadge: 'Écart >20% / cible',
    chargePlanOvershootAria: 'Écart supérieur à 20% par rapport à la cible',
    chargePlanSvgAria:   'Charge planifiée sur 4 semaines',
    chargePlanTargetLbl: (n: number) => `cible ${n}`,

    // DayDetailPanel
    dayDetailTitle:      (date: string) => `Détail du ${date}`,
    dayDetailEmpty:      'Aucune séance planifiée ce jour. Glisse-en une depuis la bibliothèque.',
    dayDetailRaceLabel:  'Course',
    dayDetailAddSession: 'Ajouter une séance',
    dayDetailClose:      'Fermer',
    dayDetailCloseAria:  'Fermer',
    dayDetailCreate:     '+ Créer une séance',
    dayDetailAdd:        '+ Ajouter une séance',
    dayDetailCoachSoon:  'Suggestions Coach IA — bientôt',

    // Toggles & small fields
    toggleDuration:           'Durée',
    toggleDistance:           'Distance',
    toggleAriaMeasure:        'Mode de mesure du segment',
    toggleIntensity:          'Intensité',
    togglePace:               'Allure',
    toggleAriaIntensity:      "Mode d'intensité du segment",
    togglePaceDisabledTitle:  'Mode allure disponible uniquement pour les types running',
    durationFieldPh:          'ex : 1h30',
    durationFieldAria:        'Durée au format heures et minutes',
    durationFieldFormatErr:   'Format : 1h30, 1:30 ou 90',
    paceFieldAria:            'Allure (mm:ss par km)',
    editBtnLabel:             'Modifier',

    // RaceEditorModal
    raceEditTitle:            'Modifier la course',
    raceCreateTitle:          'Définir mon objectif',
    raceEditAriaEdit:         'Modifier la course objectif',
    raceEditAriaCreate:       'Définir la course objectif',
    raceEditFieldName:        'Nom',
    raceEditPhName:           'Ex : Templiers 76 km',
    raceEditFieldDate:        'Date',
    raceEditFieldDistance:    'Distance (km)',
    raceEditFieldDPlus:       'D+ (m)',
    raceEditFieldType:        'Type',
    raceEditFieldLocation:    'Lieu',
    raceEditPhLocation:       'Ex : Larzac, France',
    raceEditFieldNotes:       'Notes',
    raceEditPhNotes:          'Notes libres (parcours, stratégie, etc.)',
    raceEditMainCheckbox:     'Course principale',
    raceEditDelete:           'Supprimer',
    raceEditDeleteAria:       'Supprimer la course',
    raceEditCancel:           'Annuler',
    raceEditSave:             'Enregistrer',

    raceMarkerAria: (name: string, date: string) => `Course ${name}, ${date}`,
    raceDrawerAria: (name: string) => `Détail de la course ${name}`,
    raceDrawerInfo: (date: string, km: number, m: number, prio: string) =>
      `${date} · ${km} km · ${m} m D+ · priorité ${prio}`,
    raceDrawerSeeDetail: 'Voir le détail →',
    raceDrawerClose: 'Fermer',

    typesPrefsTitle: 'Personnaliser mes activités',
    typesPrefsCloseAria: 'Fermer',
    typesPrefsIntro: 'Activités affichées dans la barre :',
    typesPrefsAddTitle: '+ Ajouter une activité',
    typesPrefsAddPh: 'Ex : Tennis',
    typesPrefsAddAria: 'Libellé de la nouvelle activité',
    typesPrefsCategory: 'Catégorie',
    typesPrefsCategories: { run: 'Run', bike: 'Vélo', swim: 'Natation', other: 'Autre' },
    typesPrefsCategoryHint: 'Détermine si la séance compte dans les bulles km / D+ / durée du bloc Semaine (running uniquement).',
    typesPrefsAddBtn: 'Ajouter',
    typesPrefsCancel: 'Annuler',
    typesPrefsSave: 'Enregistrer',
    typesPrefsCheckAria: (label: string) => `Afficher ${label}`,
    typesPrefsRenameAria: (label: string) => `Renommer ${label}`,
    typesPrefsDeleteAria: (label: string) => `Supprimer ${label}`,
    typesPrefsRenameTitle: 'Renommer',
    typesPrefsRenameConfirmTitle: 'Valider (Entrée)',
    typesPrefsRenameCancelTitle: 'Annuler (Échap)',
    typesPrefsRenameConfirmAria: 'Valider le nouveau nom',
    typesPrefsRenameCancelAria: 'Annuler le renommage',
    typesPrefsDeleteCustomTitle: (label: string) => `Supprimer « ${label} » ?`,
    typesPrefsDeleteMsgIntro: (label: string) => `Le type d'activité « ${label} » sera supprimé.`,
    typesPrefsDeleteMsgTemplates: (n: number) =>
      `${n} séance${n > 1 ? 's' : ''} de la bibliothèque ${n > 1 ? 'seront aussi supprimées' : 'sera aussi supprimée'}.`,
    typesPrefsDeleteMsgSessions: (n: number) =>
      `${n} séance${n > 1 ? 's' : ''} planifiée${n > 1 ? 's' : ''} ${n > 1 ? 'seront aussi supprimées' : 'sera aussi supprimée'}.`,
    typesPrefsDeleteConfirm: 'Supprimer',

    phaseTypes: {
      foncier:       'Foncier',
      developpement: 'Développement',
      specifique:    'Spécifique',
      affutage:      'Affûtage',
      recuperation:  'Récupération',
    },

    sessionTemplates: {
      'sl-1h30':           { title: 'SL 1h30 vallonnée',       description: 'Endurance fondamentale sur terrain vallonné. Allure conversationnelle.' },
      'sl-2h-progressive': { title: 'SL 2h progressive',       description: 'Sortie longue avec dernière demi-heure en allure soutenue.' },
      'sl-3h-spe':         { title: 'SL 3h spécifique',        description: 'Sortie longue avec relances en côte pour simuler le format course.' },
      'fr-6x500':          { title: '6×500m VMA',              description: '6×500m R=1min15 trot. Allure 95–100% VMA.' },
      'fr-10x400':         { title: '10×400m VMA',             description: '10×400m R=1min trot. Allure VMA.' },
      'fr-3x6min':         { title: '3×6min allure 5km',       description: '3×6min R=2min30. Allure 5km / 92–95% VMA.' },
      'se-3x10':           { title: '3×10min Seuil',           description: '3×10min allure seuil R=2min trot.' },
      'se-2x20':           { title: '2×20min Seuil',           description: '2×20min allure seuil R=3min trot. Séance clé.' },
      'te-40min':          { title: 'Tempo 40min',             description: '40min continu allure tempo / seuil bas.' },
      'co-10x30s':         { title: '10×30s côtes',            description: '10×30s côte raide à fond, récup descente trot.' },
      'co-6x2min':         { title: '6×2min côtes longues',    description: '6×2min côte modérée allure seuil, descente trot.' },
      'co-bosses-natu':    { title: 'Sortie bosses 1h30',      description: 'Parcours naturel à bosses, relances libres.' },
      'cr-cible':          { title: 'Course objectif',         description: 'Course cible. Distance, D+ et durée à personnaliser.' },
      'cr-prep':           { title: 'Course de prépa',         description: 'Course intermédiaire en mode test grandeur nature.' },
      'rt-aller':          { title: 'Runtaf aller (30min)',    description: 'Trajet domicile-travail à pied, endurance.' },
      'rt-double':         { title: 'Runtaf A/R (1h)',         description: 'Trajet aller + retour à pied.' },
      'vt-1h':             { title: 'Velotaf 1h',              description: 'Trajet vélo modéré, récupération active.' },
      'ft-30':             { title: 'Footing 30min',           description: 'Footing facile, Z2.' },
      'ft-45':             { title: 'Footing 45min',           description: 'Footing endurance Z2.' },
      'ft-1h':             { title: 'Footing 1h',              description: 'Footing aérobie 1h plat ou légèrement vallonné.' },
      'velo-1h30-eb':      { title: 'Vélo 1h30 endurance',     description: 'Sortie vélo en endurance fondamentale.' },
      'velo-2h-vallonne':  { title: 'Vélo 2h vallonnée',       description: 'Vélo avec parcours vallonné, allure soutenue.' },
      'nat-45min-endurance': { title: 'Natation 45min continue', description: 'Crawl continu en endurance, récupération active.' },
      'nat-1h-fract':      { title: 'Natation 1h fractionnée', description: '16×50m allure soutenue R=15s. Renforcement cardio.' },
      'renfo-30min-trail': { title: 'Renfo trail 30min',       description: 'Gainage + spécifique pieds-chevilles-quadri pour trail.' },
      'renfo-45min-complet': { title: 'Renfo complet 45min',   description: 'Circuit complet : gainage, squats, fentes, pompes.' },
      'muscu-jambes':      { title: 'Muscu jambes',            description: 'Squat, presse, fentes, mollets. Charges modérées, séries longues.' },
      'muscu-haut-corps':  { title: 'Muscu haut du corps',     description: 'Pectoraux, dos, épaules, biceps, triceps. Travail complémentaire.' },
    },
    phaseEditorTitle:                  'Éditer les cycles',
    phaseEditorAutoGen:                '🪄 Auto-générer',
    phaseEditorAutoGenAria:            'Auto-générer les cycles depuis ma course',
    phaseEditorAutoGenTitleNoRace:     "Définis d'abord ta course objectif",
    phaseEditorAutoGenTitleOk:         "Régénère les cycles depuis aujourd'hui jusqu'à la course",
    phaseEditorEmptyList:              'Aucun cycle. Ajoute-en un ou auto-génère depuis ta course.',
    phaseEditorErrNameRequired:        'Chaque cycle doit avoir un nom.',
    phaseEditorErrDateRequired:        'Toutes les dates doivent être renseignées.',
    phaseEditorErrDateOrder:           (label: string) => `Le cycle « ${label} » a des dates inversées.`,
    phaseEditorErrNoRace:              "Définis d'abord ta course objectif pour auto-générer.",
    phaseEditorErrAutoFailed:          "Impossible d'auto-générer : vérifie les dates de ta course.",
    phaseEditorErrAtLeastOne:          'Ajoute au moins un cycle ou auto-génère depuis ta course.',
    phaseEditorAddPhase:               'Ajouter un cycle',
    phaseEditorCancel:                 'Annuler',
    phaseEditorSave:                   'Enregistrer',
    phaseEditorAriaDialog:             'Éditer les cycles du plan',
    phaseEditorDelete:                 'Suppr',
    phaseEditorDeleteAria:             (label: string) => `Supprimer le cycle ${label}`,
    phaseEditorReorderAria:            (label: string) => `Réordonner le cycle ${label}`,
    phaseEditorExpandAria:             (label: string, open: boolean) => `${open ? 'Replier' : 'Déplier'} le cycle ${label}`,
    phaseEditorToggleAria:             (open: boolean) => open ? 'Replier' : 'Déplier',
    phaseEditorWeeksShort:             'sem',
    phaseEditorFieldName:              'Nom',
    phaseEditorFieldType:              'Type',
    phaseEditorFieldFocus:             'Focus (libre)',
    phaseEditorFieldFocusPh:           'Base aérobie, VMA, Côtes…',
    phaseEditorFieldStart:             'Début',
    phaseEditorFieldEnd:               'Fin',
    phaseEditorFieldDescription:       'Description',
    phaseEditorWeeklyGoals:            'Objectifs semaine par semaine',
    phaseEditorWeekCol:                'Semaine',
    phaseEditorVolumeCol:              'Volume',
    phaseEditorDPlusCol:               'D+',
    phaseEditorWeekN:                  (n: number) => `Sem ${n}`,
    phaseEditorVolumeInputAria:        (week: number, label: string) => `Volume km — semaine ${week} du cycle ${label}`,
    phaseEditorDPlusInputAria:         (week: number, label: string) => `D+ m — semaine ${week} du cycle ${label}`,
    phaseEditorCycleLabel:             (label: string) => `Cycle ${label}`,

    intensityLevels: {
      1: 'Récupération',
      2: 'Endurance',
      3: 'Tempo',
      4: 'Seuil',
      5: 'VMA',
    },
    zoneKindLabels: {
      warmup:   'Échauffement',
      main:     'Bloc principal',
      rest:     'Récup',
      cooldown: 'Retour calme',
    },
    zoneRepeatLabel:                   'Bloc Répéter',
    zonePresetLabels: {
      warmup:   'Échauffement',
      main:     'Bloc principal',
      rest:     'Récup',
      cooldown: 'Retour calme',
    },

    templateEditTitle:                 'Modifier le template',
    templateCreateTitle:               'Nouveau template',
    templateAriaEdit:                  'Éditer le template',
    templateAriaCreate:                'Créer un template',
    templateTabGeneral:                'Général',
    templateTabStructure:              'Structure',
    templateTabNotes:                  'Description',
    templateTabsAria:                  'Sections du template',
    templateDuplicate:                 'Dupliquer',
    templateDuplicateSuffix:           ' (copie)',
    templateDelete:                    'Supprimer',
    templateCancel:                    'Annuler',
    templateSave:                      'Enregistrer',
    templateTitleLabel:                'Titre',
    templateTitlePh:                   'Ex : 10×400m VMA',
    templateTypeLabel:                 'Type',
    templateCatLabels: {
      run:   'Course à pied',
      bike:  'Vélo',
      swim:  'Natation',
      other: 'Autre',
    },
    templateTypeBadgeAria:             (label: string) => `Type : ${label}`,
    templateFieldDuration:             'Durée',
    templateFieldDistance:             'Distance (km)',
    templateFieldElevation:            'D+ (m)',
    templateIntensityLabel:            (label: string) => `Intensité — ${label}`,
    templateIntensityAria:             (n: number, label: string) => `Intensité ${n} sur 5 (${label})`,
    templateTagsLabel:                 'Tags',
    templateTagsPh:                    'Ex : VMA, piste',
    templateTagRemoveAria:             (tag: string) => `Retirer le tag ${tag}`,
    templateTagAdd:                    'Ajouter',
    templateZoneAddRepeat:             '+ Bloc Répéter',
    templateStructureEmpty:            'Ajoute des zones pour structurer le template.',
    templateZonePreview:               'Aperçu intensité',
    templateNotesLabel:                'Description',
    templateNotesPh:                   'Description générique du template (consignes, intentions). Non transmise aux séances créées depuis ce template — utilise les Notes de la séance pour les consignes spécifiques.',
    templateRepetitions:               'Répétitions',
    templateLabelField:                'Label',
    templateLabelFieldPh:              'Ex : 500m allure VMA',
    templateZoneReorderAria:           (kind: string) => `Réordonner la zone ${kind}`,
    templateZoneDeleteAria:            'Supprimer la zone',
    templateZoneDelete:                'Suppr.',
    templateZoneDurationAria:          'Durée en minutes',
    templateZoneDistanceAria:          'Distance en mètres',
    templateZoneIntensityAria:         "Niveau d'intensité",
    templateZoneIntensityOption:       (n: number, label: string) => `I${n} — ${label}`,
    templateFallbackName:              'Template',
    monthsFull: [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ] as const,

    repeatStepEditTitle:               "Modifier l'étape",
    repeatStepLabelField:              'Libellé',
    repeatStepLabelEffortPh:           'Course à pied',
    repeatStepLabelRecoveryPh:         'Récupération',
    repeatStepDurationAria:            'Durée en minutes',
    repeatStepDistanceAria:            'Distance en mètres',
    repeatStepIntensityAria:           "Niveau d'intensité",
    repeatStepIntensityOptionRecup:    '1 — Récup',
    repeatStepIntensityOptionEnd:      '2 — Endurance',
    repeatStepIntensityOptionTempo:    '3 — Tempo',
    repeatStepIntensityOptionSeuil:    '4 — Seuil',
    repeatStepIntensityOptionVma:      '5 — VMA',
    repeatStepCancel:                  'Annuler',
    repeatStepSave:                    'Enregistrer',

    repeatZoneTitle:                   'Répéter',
    repeatZoneRepetitions:             'Répétitions',
    repeatZoneSkipLast:                'Sauter la dernière récup',
    repeatZoneStepEffort:              'Effort',
    repeatZoneStepRecovery:            'Récup',
    repeatZoneStepEditAria:            (kind: string) => `Modifier ${kind}`,
    repeatZoneStepRemoveAria:          (kind: string) => `Supprimer ${kind}`,
    repeatZoneAddEffort:               '+ Effort',
    repeatZoneAddRecovery:             '+ Récup',
    repeatZoneDeleteAria:              'Supprimer ce bloc',
    repeatZoneDelete:                  'Suppr.',
    repeatZoneReorderAria:             'Réordonner le bloc',
    repeatZoneRepeatsAria:             'Répéter (nombre de fois)',
    repeatZoneRepeatsTimes:            'fois',
    repeatZoneAddStep:                 '+ Ajouter une étape',
    repeatZoneSkipLastAria:            'Ignorer la dernière récupération',
    repeatZoneSkipLastLabel:           'Ignorer la dernière récupération',
    repeatZoneSkipLastTitle:           "Si activé, la séance se termine sur la dernière étape d'effort sans inclure la récupération finale.",
    repeatStepEditBtn:                 'Modifier étape',
    repeatStepDefaultLabelEffort:      'Course à pied',
    repeatStepDefaultLabelRecovery:    'Récupération',
    repeatStepDeleteAria:              "Supprimer l'étape",
    repeatStepIntensityShort: {
      1: 'Récup',
      2: 'Endurance',
      3: 'Tempo',
      4: 'Seuil',
      5: 'VMA',
    },

    sessionEditTitle:                  'Modifier la séance',
    sessionCreateTitle:                'Créer une séance',
    sessionAriaEdit:                   'Éditer la séance',
    sessionAriaCreate:                 'Créer une séance',
    sessionMatchedOne:                 'Activité réalisée',
    sessionMatchedMany:                (n: number) => `${n} activités réalisées (cumul)`,
    sessionMatchedLinkAria:            "Voir l'activité",
    sessionUnlinkAriaOne:              'Délier cette activité de la séance planifiée',
    sessionUnlinkAriaMany:             'Délier ces activités de la séance planifiée',
    sessionUnlink:                     'Délier',
    sessionTabGeneral:                 'Général',
    sessionTabStructure:               'Structure',
    sessionTabNotes:                   'Notes',
    sessionTabsAria:                   'Sections de la séance',
    sessionDuplicate:                  'Dupliquer',
    sessionDuplicateAria:              'Dupliquer la séance',
    sessionDelete:                     'Supprimer',
    sessionDeleteAria:                 'Supprimer la séance',
    sessionCancel:                     'Annuler',
    sessionSave:                       'Enregistrer',
    sessionTitleLabel:                 'Titre',
    sessionTitlePh:                    'Ex : SL 2h vallonnée',
    sessionTypeLabel:                  'Type',
    sessionDateLabel:                  'Date',
    sessionFieldDuration:              'Durée',
    sessionFieldDistance:              'Distance (km)',
    sessionFieldElevation:             'D+ (m)',
    sessionIntensityLabel:             (label: string) => `Intensité — ${label}`,
    sessionIntensityAria:              (n: number, label: string) => `Intensité ${n} sur 5 (${label})`,
    sessionChargeLabel:                'Charge estimée (TSS)',
    sessionStructureAddRepeat:         '+ Bloc Répéter',
    sessionStructureEmpty:             'Ajoute des zones pour structurer la séance.',
    sessionStructureRepetitions:       'Répétitions',
    sessionStructureLabel:             'Label',
    sessionStructureLabelPh:           'Ex : 500m allure VMA',
    sessionStructureReorderAria:       (kind: string) => `Réordonner la zone ${kind}`,
    sessionStructureDeleteAria:        'Supprimer la zone',
    sessionStructureDelete:            'Suppr.',
    sessionDurationAria:               'Durée en minutes',
    sessionDistanceAria:               'Distance en mètres',
    sessionIntensityZoneAria:          "Niveau d'intensité",
    sessionIntensityOption:            (n: number, label: string) => `I${n} — ${label}`,
    sessionPreviewLabel:               'Aperçu intensité',
    sessionNotesLabel:                 'Notes',
    sessionNotesPh:                    'Consignes, stratégie, ressentis…',
    sessionDuplicateFallback:          'Séance',
    sessionTypeBadgeAria:              (label: string) => `Type : ${label}`,
  },

  // --- Courses / Records ---
  courses: {
    title:    'Courses & Records',
    personal: 'Records personnels',
    races:    'Compétitions',
  },

  // --- Common ---
  common: {
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
    blockHelpAria: 'Aide sur ce bloc',
    blockMenuAria: 'Menu du bloc',
    blockHide:    'Masquer',
    close:        'Fermer',
    later:        'Plus tard',
  },

  // --- HR zones ---
  hrZones: {
    z1Name:       'Récupération',
    z2Name:       'Endurance fondamentale',
    z3Name:       'Endurance active',
    z4Name:       'Seuil',
    z5Name:       'Très intense',
    optimalRange: 'Plage optimale',
  },

  // --- Auth (login/signup/forgot) ---
  auth: {
    checkEmailTitle:  'Vérifiez votre email',
    checkEmailBody:   'Un lien de confirmation a été envoyé à',
    forgotSentTitle:  'Email envoyé',
    forgotSentBody:   'Un lien de réinitialisation a été envoyé à',
    backToLogin:      'Retour à la connexion',
    appTagline:       'Pilotez votre entraînement trail & endurance avec précision',
    emailPh:          'Email',
    passwordPh:       'Mot de passe',
    forgotPw:         'Mot de passe oublié ?',
    btnSending:       'Envoi…',
    btnLoggingIn:     'Connexion…',
    btnCreating:      'Création…',
    btnSendLink:      'Envoyer le lien',
    btnLogin:         'Se connecter',
    btnSignup:        'Créer mon compte',
    noAccount:        'Pas encore de compte ?',
    haveAccount:      'Déjà un compte ?',
    createAccount:    'Créer un compte',
    loginAction:      'Se connecter',
    genericError:     'Erreur de connexion.',
    featCharge:       'Charge',     featChargeDesc: 'ATL / CTL / TSB en temps réel',
    featEffort:       'Effort',     featEffortDesc: 'Score effort multi-sports',
    featCoach:        'Coach',      featCoachDesc:  'Analyse IA de vos séances',
    featUltra:        'Ultra',      featUltraDesc:  'Préparation ultra trails',
  },

  // --- PWA install prompt ---
  install: {
    title:          'Installer Trail Cockpit',
    closeAria:      'Fermer',
    laterAria:      'Plus tard',
    iosBody:        "Ajoute l'app à ton écran d'accueil",
    iosStep1:       "Appuie sur l'icône Partager",
    iosStep2Lead:   'Choisis',
    iosStep2Choice: "« Sur l'écran d'accueil »",
    iosStep3:       'Confirme avec « Ajouter »',
    iosGotIt:       "J'ai compris",
    bannerSub:      "Accès rapide depuis ton écran d'accueil",
    installBtn:     'Installer',
  },
}
