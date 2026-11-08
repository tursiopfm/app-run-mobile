import { applyProgression, computeBaseline, peakTargets } from '@/lib/training/progression'
import { autoDistributePhases } from '@/lib/training/phases'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function row(p: Partial<ActivityRow>): ActivityRow {
  return {
    id: 'x', sport_type: 'Run', name: '', start_time: '2026-11-01T08:00:00Z', ces: null,
    avg_hr: null, max_hr: null, distance_m: null, elevation_gain_m: null, moving_time_sec: null,
    computed_intensity: null, manual_sport_type: null, manual_intensity: null,
    manual_workout_type: null, manual_distance_m: null, manual_moving_time_sec: null,
    manual_elevation_gain_m: null, ...p,
  }
}

const flat = (phases: ReturnType<typeof applyProgression>) =>
  phases.flatMap(p => p.weeklyTargets ?? [])

describe('computeBaseline', () => {
  it('moyenne sur 4 semaines, course uniquement, overrides manuels prioritaires', () => {
    const b = computeBaseline([
      row({ distance_m: 100_000, elevation_gain_m: 2000 }),
      row({ sport_type: 'Ride', distance_m: 80_000, elevation_gain_m: 1000 }),
      row({ sport_type: 'Ride', manual_sport_type: 'TrailRun', distance_m: 1, manual_distance_m: 60_000, manual_elevation_gain_m: 800 }),
    ])
    expect(b).toEqual({ km: 40, dPlus: 700 })
  })
})

describe('peakTargets', () => {
  it('pic km décroissant en ratio avec la distance, plafonné à 130', () => {
    expect(peakTargets({ raceKm: 80, raceDplus: 4000 }).km).toBeCloseTo(76)
    expect(peakTargets({ raceKm: 300, raceDplus: 0 }).km).toBe(130)
  })
  it('pic D+ = min(70 % du D+ course, pic km × densité)', () => {
    expect(peakTargets({ raceKm: 80, raceDplus: 4000 }).dPlus).toBeCloseTo(2800)
    expect(peakTargets({ raceKm: 20, raceDplus: 2000 }).dPlus).toBeCloseTo(1400)
  })
})

describe('applyProgression — 12 semaines, 80 km / 4000 m, base 45 km / 700 m', () => {
  const phases = autoDistributePhases('2026-11-09', '2027-02-01') // F4 D3 S3 A2
  const out = applyProgression(phases, { km: 45, dPlus: 700 }, { raceKm: 80, raceDplus: 4000 })
  const w = flat(out)

  it('une cible par semaine', () => {
    expect(w).toHaveLength(12)
  })

  it('cycle 3:1 : semaines 4 et 8 en récupération (−30 %)', () => {
    expect(w[3].km).toBeLessThan(w[2].km * 0.75)
    expect(w[7].km).toBeLessThan(w[6].km * 0.75)
    expect(w[4].km).toBeGreaterThan(w[2].km) // escalier : repart au-dessus
  })

  it('progression ≤ +10 %/sem en km entre semaines de charge', () => {
    const load = [0, 1, 2, 4, 5, 6, 8, 9].map(i => w[i].km)
    for (let i = 1; i < load.length; i++) expect(load[i] / load[i - 1]).toBeLessThanOrEqual(1.12)
  })

  it('pic atteint en fin de Spécifique, puis affûtage exponentiel', () => {
    expect(w[9].km).toBe(76)
    // D+ : +20 %/sem max depuis 750 m → plafonné juste sous les 2800 m visés
    expect(w[9].dPlus).toBeGreaterThanOrEqual(2600)
    expect(w[9].dPlus).toBeLessThanOrEqual(2800)
    expect(w[10].km).toBe(Math.round(76 * 0.65))
    expect(w[11].km).toBe(Math.round(76 * 0.45))
  })

  it('cibles uniformes de phase = moyenne des semaines', () => {
    const f = out[0]
    const t = f.weeklyTargets!
    expect(f.weeklyDistanceKmTarget).toBe(Math.round(t.reduce((s, x) => s + x.km, 0) / t.length))
  })
})

describe('applyProgression — cas limites', () => {
  it('croissance plafonnée si le pic est hors d’atteinte', () => {
    const phases = autoDistributePhases('2026-11-09', '2027-01-04') // 8 sem
    const w = flat(applyProgression(phases, { km: 20, dPlus: 200 }, { raceKm: 170, raceDplus: 10000 }))
    const maxKm = Math.max(...w.map(x => x.km))
    expect(maxKm).toBeLessThan(peakTargets({ raceKm: 170, raceDplus: 10000 }).km)
    expect(maxKm).toBeLessThanOrEqual(Math.round(20 * 1.07 * Math.pow(1.1, 4)) + 1)
  })

  it('base supérieure au pic : pas de baisse en phase de charge', () => {
    const phases = autoDistributePhases('2026-11-09', '2027-02-01')
    const w = flat(applyProgression(phases, { km: 90, dPlus: 1500 }, { raceKm: 20, raceDplus: 300 }))
    expect(w[0].km).toBeGreaterThanOrEqual(90)
  })

  it('aucune activité récente : démarre à 60 % du pic', () => {
    const phases = autoDistributePhases('2026-11-09', '2027-02-01')
    const w = flat(applyProgression(phases, { km: 0, dPlus: 0 }, { raceKm: 80, raceDplus: 4000 }))
    expect(w[0].km).toBe(Math.round(76 * 0.6))
  })
})
