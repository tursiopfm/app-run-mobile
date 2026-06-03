import { elevationLoss, gradeAdjustedPaceSec, decouplingPct, computeStreamMetrics, gradeAdjustedVelocity } from '@/lib/activities/stream-metrics'

describe('elevationLoss', () => {
  it('somme les descentes au-delà du seuil de bruit et ignore le jitter', () => {
    expect(elevationLoss([0, 10, 5, 5, 20, 0], 1)).toBe(25)
  })
  it('ignore les micro-variations sous le seuil', () => {
    expect(elevationLoss([100, 100.4, 99.7, 100.2], 1)).toBe(0)
  })
  it('retourne 0 pour moins de 2 points', () => {
    expect(elevationLoss([42], 1)).toBe(0)
    expect(elevationLoss([], 1)).toBe(0)
  })
  it('compte une descente monotone simple', () => {
    expect(elevationLoss([100, 0], 1)).toBe(100)
  })
})

describe('gradeAdjustedPaceSec', () => {
  it('sur le plat, renvoie ~ l\'allure brute (1000 / vitesse)', () => {
    const p = gradeAdjustedPaceSec([3, 3, 3], [0, 0, 0])
    expect(p).toBeGreaterThanOrEqual(332)
    expect(p).toBeLessThanOrEqual(334)
  })
  it('en côte, l\'allure plate équivalente est plus rapide (sec/km plus petit)', () => {
    const flat = gradeAdjustedPaceSec([3, 3, 3], [0, 0, 0])!
    const hill = gradeAdjustedPaceSec([3, 3, 3], [10, 10, 10])!
    expect(hill).toBeLessThan(flat)
  })
  it('null si vitesse ou pente absente', () => {
    expect(gradeAdjustedPaceSec([], [])).toBeNull()
    expect(gradeAdjustedPaceSec(undefined as unknown as number[], [0])).toBeNull()
  })
  it('null si toutes les vitesses sont nulles', () => {
    expect(gradeAdjustedPaceSec([0, 0, 0], [0, 0, 0])).toBeNull()
  })
})

describe('decouplingPct', () => {
  it('positif quand la FC dérive vers le haut à output constant', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    const out  = time.map(() => 3)
    const hr   = time.map((_, i) => (i < 650 ? 150 : 160))
    const d = decouplingPct(out, hr, time)!
    expect(d).toBe(6.3)
  })
  it('null si durée trop courte', () => {
    expect(decouplingPct([3, 3], [150, 160], [0, 100])).toBeNull()
  })
  it('null si pas de FC', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    expect(decouplingPct(time.map(() => 3), [], time)).toBeNull()
  })
  it('utilise le nb d\'échantillons comme durée quand time est absent', () => {
    const out = Array.from({ length: 1300 }, () => 3)
    const hr  = out.map((_, i) => (i < 650 ? 150 : 160))
    expect(decouplingPct(out, hr, [])).toBe(6.3)
  })
})

describe('gradeAdjustedVelocity', () => {
  it('aplatit la vitesse selon la pente (montée → vitesse équivalente plus rapide)', () => {
    const out = gradeAdjustedVelocity([3, 3], [0, 10])
    expect(out[0]).toBeCloseTo(3, 5)
    expect(out[1]).toBeGreaterThan(3)
  })
})

describe('decoupling sur vitesse ajustée pente (anti-artefact terrain)', () => {
  it('un trail où la 2e moitié descend ne crée PAS de faux découplage', () => {
    const n = 1300
    const time = Array.from({ length: n }, (_, i) => i)
    const velocity = time.map((_, i) => (i < n / 2 ? 2 : 4))    // brute: lent montée, rapide descente
    const grade    = time.map((_, i) => (i < n / 2 ? 6 : -6))   // ±6% : Minetti neutralise l'artefact (−100% brut → ~−6% ajusté)
    const heartrate = time.map(() => 150)
    const d = computeStreamMetrics({ time, velocity, grade, heartrate }).decouplingPct!
    expect(Math.abs(d)).toBeLessThan(8)   // pas d'aberration type -100%
  })
})

describe('computeStreamMetrics', () => {
  it('combine les 3 métriques quand les streams sont complets', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    const m = computeStreamMetrics({
      time,
      altitude: time.map((_, i) => (i < 650 ? i * 0.1 : 65 - (i - 650) * 0.1)),
      heartrate: time.map((_, i) => (i < 650 ? 150 : 160)),
      velocity: time.map(() => 3),
      grade: time.map((_, i) => (i < 650 ? 5 : -5)),
    })
    expect(m.elevationLossM).toBeGreaterThan(0)
    expect(m.decouplingPct).toBeGreaterThan(0)
    expect(m.gradeAdjustedPaceS).toBeGreaterThan(0)
  })
  it('renvoie null par métrique manquante', () => {
    const m = computeStreamMetrics({ altitude: [10, 5] })
    expect(m.elevationLossM).toBe(5)
    expect(m.decouplingPct).toBeNull()
    expect(m.gradeAdjustedPaceS).toBeNull()
  })
})
