import { computeBestWindow, scoreHour } from '@/lib/weather/best-window'

describe('scoreHour', () => {
  it('score = 100 pour température idéale 13°C, pas pluie, pas vent, UV faible', () => {
    expect(scoreHour({ time: 't', tempC: 13, weatherCode: 0, precipPct: 0, windKmh: 5, uv: 2 })).toBe(100)
  })
  it('score réduit pour précipitation 50%', () => {
    expect(scoreHour({ time: 't', tempC: 13, weatherCode: 0, precipPct: 50, windKmh: 5, uv: 2 })).toBeLessThan(60)
  })
  it('score réduit pour température élevée 28°C', () => {
    expect(scoreHour({ time: 't', tempC: 28, weatherCode: 0, precipPct: 0, windKmh: 5, uv: 2 })).toBeLessThan(70)
  })
  it('score réduit pour vent fort 35 km/h', () => {
    expect(scoreHour({ time: 't', tempC: 13, weatherCode: 0, precipPct: 0, windKmh: 35, uv: 2 })).toBeLessThan(90)
  })
  it('score clamped 0-100', () => {
    expect(scoreHour({ time: 't', tempC: -20, weatherCode: 0, precipPct: 100, windKmh: 80, uv: 11 })).toBe(0)
  })
})

describe('computeBestWindow', () => {
  function mkHour(hour: number, score: number) {
    // tempC adjusted to roughly produce the score (rough fixture)
    // score>=100 → 13°C (score=100), score>=70 → 18°C (score=92), else → 30°C (score=52)
    const tempC = score >= 100 ? 13 : (score >= 70 ? 18 : 30)
    return { time: `2026-05-26T${String(hour).padStart(2,'0')}:00:00Z`, tempC, weatherCode: 0, precipPct: 0, windKmh: 5, uv: 2 }
  }

  it('renvoie null si aucune heure ≥ 70', () => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({ time: `t${i}`, tempC: -10, weatherCode: 0, precipPct: 0, windKmh: 0, uv: 0 }))
    expect(computeBestWindow(hourly)).toBeNull()
  })

  it('trouve la plus longue fenêtre contigüe ≥ 70', () => {
    // Hours 7-10 should be a contiguous block of high scores
    const hourly = [
      mkHour(6, 60), mkHour(7, 100), mkHour(8, 100), mkHour(9, 100), mkHour(10, 100), mkHour(11, 60),
      mkHour(12, 50), mkHour(13, 50), mkHour(14, 50), mkHour(15, 50), mkHour(16, 50), mkHour(17, 50),
      mkHour(18, 100), mkHour(19, 100), mkHour(20, 60), mkHour(21, 50), mkHour(22, 50), mkHour(23, 50),
    ]
    const win = computeBestWindow(hourly)
    expect(win).not.toBeNull()
    expect(win!.startHour).toBe(7)
    expect(win!.endHour).toBe(10)
    expect(win!.avgScore).toBeGreaterThanOrEqual(70)
  })

  it('retourne un seul créneau si une seule heure ≥ 70', () => {
    const hourly = [
      mkHour(8, 60), mkHour(9, 100), mkHour(10, 60),
    ]
    const win = computeBestWindow(hourly)
    expect(win).not.toBeNull()
    expect(win!.startHour).toBe(9)
    expect(win!.endHour).toBe(9)
  })

  it('retourne null si hourly est vide', () => {
    expect(computeBestWindow([])).toBeNull()
  })
})
