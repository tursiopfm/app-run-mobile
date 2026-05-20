import { generateWeeks } from '@/lib/training/load-patterns'

describe('generateWeeks — progressive_3_1', () => {
  it('génère un cycle de 4 semaines : 3 load (80/90/100%) + 1 deload (65%)', () => {
    const weeks = generateWeeks('progressive_3_1', {
      startDate: '2026-06-01',
      weekCount: 4,
      baselineLoadTss: 500,
      baselineVolumeKm: 60,
      baselineDplusM: 1500,
    })

    expect(weeks).toHaveLength(4)
    expect(weeks[0]).toMatchObject({
      weekIndex: 0,
      weekStartDate: '2026-06-01',
      weekType: 'load',
      targetLoadTss: 400,    // 500 * 0.80
      targetVolumeKm: 48,    // 60 * 0.80
      targetDplusM: 1200,    // 1500 * 0.80
      generatedFromPattern: true,
      isManualOverride: false,
    })
    expect(weeks[1]).toMatchObject({
      weekIndex: 1,
      weekStartDate: '2026-06-08',
      weekType: 'load',
      targetLoadTss: 450,
      targetVolumeKm: 54,
      targetDplusM: 1350,
    })
    expect(weeks[2]).toMatchObject({
      weekIndex: 2,
      weekStartDate: '2026-06-15',
      weekType: 'load',
      targetLoadTss: 500,
      targetVolumeKm: 60,
      targetDplusM: 1500,
    })
    expect(weeks[3]).toMatchObject({
      weekIndex: 3,
      weekStartDate: '2026-06-22',
      weekType: 'deload',
      targetLoadTss: 325,    // 500 * 0.65
      targetVolumeKm: 39,
      targetDplusM: 975,
    })
  })

  it('génère 8 semaines : 2 cycles complets (6 load + 2 deload)', () => {
    const weeks = generateWeeks('progressive_3_1', {
      startDate: '2026-06-01',
      weekCount: 8,
      baselineLoadTss: 500,
      baselineVolumeKm: 60,
      baselineDplusM: 1500,
    })

    expect(weeks).toHaveLength(8)
    const types = weeks.map(w => w.weekType)
    expect(types).toEqual(['load', 'load', 'load', 'deload', 'load', 'load', 'load', 'deload'])
    expect(weeks[7].weekStartDate).toBe('2026-07-20')
  })

  it('génère 6 semaines : cycle tronqué (4 load + 1 deload + 1 load partiel)', () => {
    const weeks = generateWeeks('progressive_3_1', {
      startDate: '2026-06-01',
      weekCount: 6,
      baselineLoadTss: 500,
      baselineVolumeKm: 60,
      baselineDplusM: 1500,
    })

    expect(weeks).toHaveLength(6)
    expect(weeks.map(w => w.weekType)).toEqual(['load', 'load', 'load', 'deload', 'load', 'load'])
    expect(weeks[5].targetLoadTss).toBe(450)   // 500 * 0.90 (2e position du cycle suivant)
  })
})

describe('generateWeeks — progressive_2_1', () => {
  it('génère 6 semaines : 2 cycles complets (4 load + 2 deload)', () => {
    const weeks = generateWeeks('progressive_2_1', {
      startDate: '2026-06-01',
      weekCount: 6,
      baselineLoadTss: 500,
      baselineVolumeKm: 60,
      baselineDplusM: 1500,
    })

    expect(weeks).toHaveLength(6)
    expect(weeks.map(w => w.weekType)).toEqual(['load', 'load', 'deload', 'load', 'load', 'deload'])
    expect(weeks[0].targetLoadTss).toBe(425)   // 500 * 0.85
    expect(weeks[1].targetLoadTss).toBe(500)
    expect(weeks[2].targetLoadTss).toBe(325)   // 500 * 0.65
  })

  it('génère 2 semaines : deload non atteinte', () => {
    const weeks = generateWeeks('progressive_2_1', {
      startDate: '2026-06-01',
      weekCount: 2,
      baselineLoadTss: 500,
      baselineVolumeKm: 60,
      baselineDplusM: 1500,
    })

    expect(weeks).toHaveLength(2)
    expect(weeks.map(w => w.weekType)).toEqual(['load', 'load'])
  })
})

describe('generateWeeks — taper', () => {
  it('génère 4 semaines : décroissance linéaire 0.85 → 0.40, type taper', () => {
    const weeks = generateWeeks('taper', {
      startDate: '2026-08-05',
      weekCount: 4,
      baselineLoadTss: 400,
      baselineVolumeKm: 50,
      baselineDplusM: 1000,
    })

    expect(weeks).toHaveLength(4)
    expect(weeks.every(w => w.weekType === 'taper')).toBe(true)
    expect(weeks[0].targetLoadTss).toBe(340)   // 400 * 0.85
    expect(weeks[1].targetLoadTss).toBe(280)   // 400 * 0.70
    expect(weeks[2].targetLoadTss).toBe(220)   // 400 * 0.55
    expect(weeks[3].targetLoadTss).toBe(160)   // 400 * 0.40
  })

  it('génère 1 semaine : 1 entrée à 0.85', () => {
    const weeks = generateWeeks('taper', {
      startDate: '2026-08-25',
      weekCount: 1,
      baselineLoadTss: 400,
      baselineVolumeKm: 50,
      baselineDplusM: 1000,
    })

    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekType).toBe('taper')
    expect(weeks[0].targetLoadTss).toBe(340)   // 400 * 0.85
  })

  it('génère 3 semaines : ratios [0.85, 0.625, 0.40]', () => {
    const weeks = generateWeeks('taper', {
      startDate: '2026-08-12',
      weekCount: 3,
      baselineLoadTss: 400,
      baselineVolumeKm: 50,
      baselineDplusM: 1000,
    })

    expect(weeks).toHaveLength(3)
    expect(weeks[0].targetLoadTss).toBe(340)
    expect(weeks[1].targetLoadTss).toBe(250)   // 400 * 0.625
    expect(weeks[2].targetLoadTss).toBe(160)
  })
})
