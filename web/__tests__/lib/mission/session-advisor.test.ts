import { adviseWeek, applySlider, type AdviceContext, type SliderBase } from '@/lib/mission/session-advisor'
import type { RaceProfile } from '@/lib/mission/race-profile'

const NEUTRAL_PROFILE: RaceProfile = {
  relief: 'flat', distanceClass: 'mid', dPlusPerKm: 20, goalPaceMinPerKm: null,
  qualityKinds: ['seuil_tempo'], longRunMaxMin: 120,
}
function weekFrom(iso: string): string[] {
  const d = new Date(`${iso}T00:00:00Z`); const dow = d.getUTCDay() || 7
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setUTCDate(mon.getUTCDate() + i); return x.toISOString().slice(0, 10) })
}

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
  raceProfile: NEUTRAL_PROFILE,
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

describe('applySlider', () => {
  const longRun: SliderBase = { type: 'sortie_longue', title: 'Sortie longue', durationMin: 120, distanceKm: 24, elevationM: 500, intensity: 2 }
  const fractio: SliderBase = { type: 'fractionne', title: '10×400m VMA', durationMin: 65, distanceKm: 9, intensity: 5 }

  it('pos 0 → repos ; pos 2 → la séance prévue inchangée', () => {
    expect(applySlider(longRun, 0).kind).toBe('rest')
    const prevu = applySlider(longRun, 2)
    expect(prevu.kind).toBe('session')
    if (prevu.kind === 'session') expect(prevu.durationMin).toBe(120)
  })

  it('fractionné : on adapte le NB de répétitions (10 → 8 / 12 / 15)', () => {
    const a = applySlider(fractio, 1), r = applySlider(fractio, 3), m = applySlider(fractio, 4)
    if (a.kind === 'session') expect(a.title).toBe('8×400m VMA')
    if (r.kind === 'session') expect(r.title).toBe('12×400m VMA')
    if (m.kind === 'session') expect(m.title).toBe('15×400m VMA')
  })

  it('endurance + D+ : allégé raccourcit (et baisse le D+), renforcé rallonge', () => {
    const a = applySlider(longRun, 1), r = applySlider(longRun, 4)
    if (a.kind === 'session') { expect(a.distanceKm!).toBeLessThan(24); expect(a.elevationM!).toBeLessThan(500) }
    if (r.kind === 'session') { expect(r.distanceKm!).toBeGreaterThan(24); expect(r.elevationM!).toBeGreaterThan(500) }
  })

  it('recommandation repos (centerIsRest) : séance seulement en poussant à droite', () => {
    expect(applySlider(longRun, 2, true).kind).toBe('rest')
    expect(applySlider(longRun, 3, true).kind).toBe('session')
  })
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

describe('spécificité course', () => {
  const mountain: RaceProfile = { relief: 'mountain', distanceClass: 'ultra', dPlusPerKm: 55, goalPaceMinPerKm: null, qualityKinds: ['cotes', 'seuil_tempo'], longRunMaxMin: 240 }
  const flatShort: RaceProfile = { relief: 'flat', distanceClass: 'short', dPlusPerKm: 5, goalPaceMinPerKm: null, qualityKinds: ['fractionne', 'seuil_tempo'], longRunMaxMin: 90 }

  it('course montagne → la qualité du jour privilégie les côtes', () => {
    const w = adviseWeek({ ...base, raceProfile: mountain })
    if (w.today.kind === 'suggested') expect(['cotes', 'seuil_tempo']).toContain(w.today.session.type)
  })

  it('10 km plat → la qualité peut être de la VMA (fractionné) selon la semaine', () => {
    const days = ['2026-06-09', '2026-06-16', '2026-06-23']
    const types = days.map(d => {
      const w = adviseWeek({ ...base, todayISO: d, weekDates: weekFrom(d), raceProfile: flatShort })
      return w.today.kind === 'suggested' ? w.today.session.type : 'rest'
    })
    expect(types).toContain('fractionne')
  })

  it('sortie longue : le D+ suit le relief de la course', () => {
    const w = adviseWeek({ ...base, raceProfile: mountain })
    const sat = w.byDate['2026-06-13']
    if (sat.kind === 'suggested' && sat.session.type === 'sortie_longue') {
      expect(sat.session.elevationM!).toBeGreaterThan((sat.session.distanceKm ?? 0) * 30)
    }
  })

  it('phase spécifique + allure cible connue → séance allure course', () => {
    const profile: RaceProfile = { ...flatShort, distanceClass: 'mid', goalPaceMinPerKm: 5, qualityKinds: ['seuil_tempo', 'fractionne'] }
    const w = adviseWeek({ ...base, phaseType: 'specifique', daysToRace: 30, raceProfile: profile })
    if (w.today.kind === 'suggested') expect(w.today.session.reasonCode).toBe('race-pace')
  })
})
