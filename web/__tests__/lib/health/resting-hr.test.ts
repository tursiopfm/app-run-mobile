import { estimateRestingHrFromHrStreams } from '@/lib/health/resting-hr'

const flat = (v: number, n = 50) => Array.from({ length: n }, () => v)

describe('estimateRestingHrFromHrStreams', () => {
  it('retourne null si aucun stream', () => {
    expect(estimateRestingHrFromHrStreams([])).toBeNull()
  })

  it('retourne null si tous les streams sont vides ou non exploitables', () => {
    expect(estimateRestingHrFromHrStreams([[], undefined, null])).toBeNull()
  })

  it('ignore les valeurs artefactuelles (<35 ou >220)', () => {
    // un stream avec dropouts 0/20 et un pic capteur 250 → min plausible = 70
    const hr = [0, 20, 250, 70, 80, 90, 100, 0]
    expect(estimateRestingHrFromHrStreams([hr])).toBe(70)
  })

  it('skip un stream entièrement artefactuel', () => {
    expect(estimateRestingHrFromHrStreams([[10, 20, 30], [60, 70, 80]])).toBe(60)
  })

  it('prend le 10e percentile des minima par activité', () => {
    // minima par activité : 50,52,54,56,58,60,62,64,66,68 → p10 (idx floor(10*0.1)=1) = 52
    const streams = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68].map((m) => [m, ...flat(150)])
    expect(estimateRestingHrFromHrStreams(streams)).toBe(52)
  })

  it('reproduit le cas réel de Franck (~64, vrai repos 58)', () => {
    // minima observés sur ses 40 streams (les 12 plus bas), reste élevé
    const minima = [57, 63, 63, 64, 64, 68, 69, 69, 69, 70, 71, 73,
                    80, 82, 85, 88, 90, 92, 95, 98, 100, 102, 105, 108,
                    110, 112, 115, 118, 120, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145, 150]
    const streams = minima.map((m) => [m, ...flat(160)])
    // 40 minima → p10 idx floor(40*0.1)=4 → 5e plus bas = 64
    expect(estimateRestingHrFromHrStreams(streams)).toBe(64)
  })

  it('clampe à 90 max', () => {
    const streams = [95, 96, 97, 98].map((m) => [m, ...flat(160)])
    expect(estimateRestingHrFromHrStreams(streams)).toBe(90)
  })

  it('clampe à 40 min', () => {
    const streams = [36, 37, 38, 39].map((m) => [m, ...flat(120)])
    expect(estimateRestingHrFromHrStreams(streams)).toBe(40)
  })
})
