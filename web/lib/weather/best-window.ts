import type { WeatherHourly } from './open-meteo'

const IDEAL_TEMP_MIN = 10
const IDEAL_TEMP_MAX = 16
const TEMP_DECAY_PER_DEG = 4

export function scoreHour(h: WeatherHourly): number {
  let s = 100
  if (h.tempC < IDEAL_TEMP_MIN) s -= (IDEAL_TEMP_MIN - h.tempC) * TEMP_DECAY_PER_DEG
  if (h.tempC > IDEAL_TEMP_MAX) s -= (h.tempC - IDEAL_TEMP_MAX) * TEMP_DECAY_PER_DEG
  if (h.precipPct > 30) s -= (h.precipPct - 10) * 1.5
  else if (h.precipPct > 10) s -= (h.precipPct - 10) * 0.5
  if (h.windKmh > 15) s -= (h.windKmh - 15)
  if (h.uv > 5) s -= (h.uv - 5) * 10
  return Math.max(0, Math.min(100, Math.round(s)))
}

export type BestWindow = {
  startHour: number
  endHour:   number
  avgScore:  number
}

export function computeBestWindow(hourly: WeatherHourly[]): BestWindow | null {
  if (hourly.length === 0) return null
  const scores = hourly.map(h => ({ hour: new Date(h.time).getUTCHours(), score: scoreHour(h) }))

  let bestStart = -1, bestEnd = -1, bestLen = 0, bestAvg = 0
  let curStart = -1, curSum = 0, curLen = 0

  for (let i = 0; i < scores.length; i++) {
    if (scores[i].score >= 70) {
      if (curStart === -1) curStart = i
      curSum += scores[i].score
      curLen++
    } else {
      if (curLen > bestLen) {
        bestStart = curStart
        bestEnd = i - 1
        bestLen = curLen
        bestAvg = Math.round(curSum / curLen)
      }
      curStart = -1; curSum = 0; curLen = 0
    }
  }
  if (curLen > bestLen) {
    bestStart = curStart
    bestEnd = scores.length - 1
    bestLen = curLen
    bestAvg = Math.round(curSum / curLen)
  }

  if (bestLen === 0) return null

  return {
    startHour: scores[bestStart].hour,
    endHour:   scores[bestEnd].hour,
    avgScore:  bestAvg,
  }
}
