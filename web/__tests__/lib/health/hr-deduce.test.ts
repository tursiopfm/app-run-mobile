import { deduceFromActivities } from '@/lib/health/hr-deduce'

const mkAct = (max_hr: number | null, moving_time_sec = 1800) => ({ max_hr, moving_time_sec })

describe('deduceFromActivities', () => {
  it('retourne null sur tous les champs si pas d\'activités', () => {
    const result = deduceFromActivities([], null)
    expect(result.maxHrObserved).toBeNull()
    expect(result.restingHrEstimated).toBeNull()
    expect(result.lthrEstimated).toBeNull()
  })

  it('calcule maxHrObserved comme max global', () => {
    const result = deduceFromActivities([mkAct(180), mkAct(192), mkAct(175)], null)
    expect(result.maxHrObserved).toBe(192)
  })

  it('ignore les max_hr null', () => {
    const result = deduceFromActivities([mkAct(null), mkAct(185)], null)
    expect(result.maxHrObserved).toBe(185)
  })

  it('utilise restingHr depuis athlete_data si présent', () => {
    const result = deduceFromActivities([mkAct(180)], { resting_heart_rate: 52 })
    expect(result.restingHrEstimated).toBe(52)
  })

  it('retourne null pour restingHr si athlete_data ne le contient pas', () => {
    const result = deduceFromActivities([mkAct(180)], {})
    expect(result.restingHrEstimated).toBeNull()
  })

  it('calcule lthrEstimated comme p90 des max_hr sur runs >= 30min', () => {
    const acts = Array.from({ length: 10 }, (_, i) => mkAct(170 + i, 1800))
    expect(deduceFromActivities(acts, null).lthrEstimated).toBe(179)
  })

  it('ignore les activités < 30min pour lthrEstimated', () => {
    const acts = [mkAct(200, 600), mkAct(170, 2000)]
    expect(deduceFromActivities(acts, null).lthrEstimated).toBe(170)
  })

  it('inclut un timestamp computedAt', () => {
    const result = deduceFromActivities([mkAct(180)], null)
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
