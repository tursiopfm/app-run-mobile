import { adviseWeek, type AdviceContext } from '@/lib/mission/session-advisor'

const base: AdviceContext = {
  todayISO: '2026-06-11',           // jeudi
  weekDates: ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13','2026-06-14'],
  freshnessZone: 'balanced',
  weekDoneKm: 28,
  recentHardCount: 0,
  targetKm: 50,
  phaseType: 'specifique',
  daysToRace: 42,
  plannedDates: [],
  plannedRemainingKm: 0,
  hasPlannedLongRun: false,
}

it('fatigue élevée → repos/easy aujourd’hui', () => {
  const w = adviseWeek({ ...base, freshnessZone: 'high-fatigue' })
  expect(['rest', 'suggested']).toContain(w.today.kind)
  if (w.today.kind === 'suggested') expect(w.today.session.intensity).toBeLessThanOrEqual(2)
})

it('qualité déjà faite cette semaine → pas une 2e qualité aujourd’hui', () => {
  const w = adviseWeek({ ...base, recentHardCount: 1 })
  if (w.today.kind === 'suggested') expect(w.today.session.intensity).toBeLessThanOrEqual(3)
})

it('cible non atteinte → sortie longue le week-end, durée/distance cohérentes', () => {
  const w = adviseWeek(base)
  const sat = w.byDate['2026-06-13']
  expect(sat.kind).toBe('suggested')
  if (sat.kind === 'suggested') {
    expect(sat.session.type).toBe('sortie_longue')
    const { durationMin, distanceKm } = sat.session
    expect(distanceKm).toBeLessThanOrEqual(32)        // jamais 73 km
    // cohérence allure : ~5 à 7 min/km
    expect(durationMin).toBeGreaterThanOrEqual((distanceKm ?? 0) * 5)
    expect(durationMin).toBeLessThanOrEqual((distanceKm ?? 0) * 7)
  }
})

it('sortie longue déjà planifiée → pas de 2e sortie longue suggérée le samedi', () => {
  const w = adviseWeek({ ...base, hasPlannedLongRun: true })
  const sat = w.byDate['2026-06-13']
  if (sat.kind === 'suggested') expect(sat.session.type).not.toBe('sortie_longue')
})

it('volume déjà couvert par le plan → reste faible → pas de sortie longue injectée', () => {
  // cible 50, réalisé 28, planifié à venir 20 → reste 2 (<12)
  const w = adviseWeek({ ...base, plannedRemainingKm: 20 })
  const sat = w.byDate['2026-06-13']
  if (sat.kind === 'suggested') expect(sat.session.type).not.toBe('sortie_longue')
})

it('jour déjà planifié → kind=planned (on ne remplit pas)', () => {
  const w = adviseWeek({ ...base, plannedDates: ['2026-06-13'] })
  expect(w.byDate['2026-06-13'].kind).toBe('planned')
})

it('sans course (phase nulle) → conseille quand même, reason rythme', () => {
  const w = adviseWeek({ ...base, phaseType: null, daysToRace: null, targetKm: 40 })
  expect(w.today.kind === 'suggested' || w.today.kind === 'rest').toBe(true)
})

it('affûtage détecté par le TYPE de phase (pas le libellé) → séance allégée', () => {
  // daysToRace volontairement > 10 : seul phaseType='affutage' doit déclencher le taper.
  const w = adviseWeek({ ...base, phaseType: 'affutage', daysToRace: 21, freshnessZone: 'fresh' })
  expect(w.today.kind).toBe('suggested')
  if (w.today.kind === 'suggested') {
    expect(w.today.session.durationMin).toBeLessThanOrEqual(60)
    expect(w.today.session.reasonCode).toBe('taper-light')
  }
})
