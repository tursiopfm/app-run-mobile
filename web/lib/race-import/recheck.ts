import 'server-only'
import { createServiceClient } from '@/lib/database/supabase-server'
import { findParserForUrl } from './sources'
import { hashWaypoints } from './hash'
import { isDueForRecheck, buildPendingDiff } from './recheck-logic'
import { rowToRaceWaypoint } from './schema'

const MAX_RACES_PER_TICK = 5
const THROTTLE_MS = 300

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const daysUntil = (raceDateISO: string, nowMs: number) =>
  Math.ceil((Date.parse(raceDateISO + 'T00:00:00Z') - nowMs) / 86400000)

export async function runFreshnessRecheck(): Promise<{ checked: number; changed: number; newEdition: number }> {
  const supabase = createServiceClient()
  const nowMs = Date.now()
  const nowISO = new Date(nowMs).toISOString()
  const today = nowISO.slice(0, 10)

  const { data: rows, error } = await supabase
    .from('race_tableau_meta')
    .select('race_id, source_url, source_hash, edition_year, freshness_status, source_checked_at, races!inner(date)')
    .not('source_url', 'is', null)
    .is('pending_diff', null)
    .gte('races.date', today)

  if (error || !rows) {
    console.error('[recheck] select error:', error?.message)
    return { checked: 0, changed: 0, newEdition: 0 }
  }

  // Seules les courses dues ET parsables (livetrail/utmb) occupent un slot du tick.
  // Un source_url générique (LLM) est hors 2a : on l'exclut AVANT le cap, sinon il
  // serait re-sélectionné à chaque tick (son horloge n'avance jamais) et affamerait
  // les courses parsables.
  const due = (rows as any[])
    .filter((r) => findParserForUrl(r.source_url) != null &&
      isDueForRecheck(daysUntil(r.races.date, nowMs), r.source_checked_at, nowISO))
    .slice(0, MAX_RACES_PER_TICK)

  let changed = 0, newEdition = 0
  for (let i = 0; i < due.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS)
    const r = due[i]
    const parser = findParserForUrl(r.source_url)
    if (!parser) continue
    try {
      const data = await parser.parse(r.source_url)
      if (data.waypoints.length === 0) continue
      const newHash = hashWaypoints(data.waypoints)

      const { data: oldRows } = await supabase
        .from('race_waypoints').select('*').eq('race_id', r.race_id).order('order_index', { ascending: true })
      const oldWaypoints = (oldRows ?? []).map(rowToRaceWaypoint as any)
        .map(({ id: _i, raceId: _r, ...rest }: any) => rest)

      const pending = buildPendingDiff({
        oldWaypoints, newData: data, newHash,
        meta: { source_hash: r.source_hash, edition_year: r.edition_year, freshness_status: r.freshness_status },
        raceDateISO: r.races.date, nowISO,
      })

      const patch: Record<string, unknown> = { source_checked_at: nowISO }
      if (pending) {
        patch.pending_diff = pending
        patch.pending_diff_at = nowISO
        if (pending.kind === 'new_edition') newEdition++; else changed++
      }
      await supabase.from('race_tableau_meta').update(patch).eq('race_id', r.race_id)
    } catch (err) {
      console.warn('[recheck] course', r.race_id, 'ignorée:', (err as Error).message)
    }
  }
  return { checked: due.length, changed, newEdition }
}
