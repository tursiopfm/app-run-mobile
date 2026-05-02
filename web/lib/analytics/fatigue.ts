export type DailyLoad = {
  date: string
  ces: number
}

export type DailyMetrics = {
  date: string
  dailyLoad: number
  atl: number
  ctl: number
  tsb: number
}

export type EwmaPoint = {
  date: string
  ewma: number
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return date.toISOString().split('T')[0]
}

function fillConsecutiveDays(loads: DailyLoad[]): DailyLoad[] {
  if (loads.length === 0) return []
  const sorted = [...loads].sort((a, b) => a.date.localeCompare(b.date))
  const map    = new Map(sorted.map((l) => [l.date, l.ces]))
  const result: DailyLoad[] = []
  let cur = sorted[0].date
  const end = sorted[sorted.length - 1].date
  while (cur <= end) {
    result.push({ date: cur, ces: map.get(cur) ?? 0 })
    cur = nextDay(cur)
  }
  return result
}

export function computeEwma(loads: DailyLoad[], periodDays: number): EwmaPoint[] {
  const filled = fillConsecutiveDays(loads)
  if (filled.length === 0) return []
  const alpha = 1 - Math.exp(-1 / periodDays)
  let ewma = filled[0].ces
  return filled.map((d, i) => {
    if (i > 0) ewma = ewma + alpha * (d.ces - ewma)
    return { date: d.date, ewma }
  })
}

export function buildDailyMetrics(loads: DailyLoad[]): DailyMetrics[] {
  const filled   = fillConsecutiveDays(loads)
  if (filled.length === 0) return []
  const alphaAtl = 1 - Math.exp(-1 / 7)
  const alphaCtl = 1 - Math.exp(-1 / 42)
  let atl = filled[0].ces
  let ctl = filled[0].ces
  return filled.map((d, i) => {
    if (i > 0) {
      atl = atl + alphaAtl * (d.ces - atl)
      ctl = ctl + alphaCtl * (d.ces - ctl)
    }
    return {
      date:      d.date,
      dailyLoad: d.ces,
      atl:       Math.round(atl * 10) / 10,
      ctl:       Math.round(ctl * 10) / 10,
      tsb:       Math.round((ctl - atl) * 10) / 10,
    }
  })
}
