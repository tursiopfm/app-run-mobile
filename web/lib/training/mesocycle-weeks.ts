// Storage des semaines d'un mésocycle (table mesocycle_weeks).
// Porte la règle is_manual_override : par défaut, regenerateWeeks préserve les
// semaines éditées manuellement. forceOverwrite=true écrase tout.

import { createClient } from '@/lib/database/supabase-client'
import type { LoadPattern, MesocycleWeek, Phase, WeekType } from '@/types/plan'
import { generateWeeks } from '@/lib/training/load-patterns'
import { phaseWeekCount } from '@/lib/training/phases'

type Row = {
  id: string
  phase_id: string
  week_index: number
  week_start_date: string
  week_type: WeekType
  target_load_tss: number
  target_volume_km: number
  target_dplus_m: number
  comment: string | null
  is_manual_override: boolean
  generated_from_pattern: boolean
}

function weekFromRow(r: Row): MesocycleWeek {
  return {
    id: r.id,
    phaseId: r.phase_id,
    weekIndex: r.week_index,
    weekStartDate: r.week_start_date,
    weekType: r.week_type,
    targetLoadTss: r.target_load_tss,
    targetVolumeKm: Number(r.target_volume_km),
    targetDplusM: r.target_dplus_m,
    comment: r.comment ?? undefined,
    isManualOverride: r.is_manual_override,
    generatedFromPattern: r.generated_from_pattern,
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `week-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function getWeeksForPhase(phaseId: string): Promise<MesocycleWeek[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mesocycle_weeks')
    .select('*')
    .eq('phase_id', phaseId)
    .order('week_index', { ascending: true })
  if (error || !data) return []
  return (data as Row[]).map(weekFromRow)
}

export async function regenerateWeeks(
  phase: Phase,
  opts?: { forceOverwrite?: boolean },
): Promise<MesocycleWeek[]> {
  const weekCount = phaseWeekCount(phase)

  // 1. Lire les rows existantes (indexées par week_index).
  const existing = await getWeeksForPhase(phase.id)
  const existingByIndex = new Map<number, MesocycleWeek>(existing.map(w => [w.weekIndex, w]))

  // 2. Pattern 'custom' = pas de génération, retourne l'existant.
  if (phase.loadPattern === 'custom') {
    return existing
  }

  // 3. Générer les semaines depuis le pattern.
  const generated = generateWeeks(phase.loadPattern, {
    startDate: phase.startDate,
    weekCount,
    baselineLoadTss: phase.weeklyChargeTarget,
    baselineVolumeKm: phase.weeklyDistanceKmTarget,
    baselineDplusM: phase.weeklyElevationMTarget,
  })

  // 4. Pour chaque semaine générée : UPSERT sauf si override préservé.
  const supabase = createClient()
  const toUpsert: Row[] = []
  const result: MesocycleWeek[] = []

  for (const gen of generated) {
    const prev = existingByIndex.get(gen.weekIndex)
    if (prev && prev.isManualOverride && !opts?.forceOverwrite) {
      result.push(prev)
      continue
    }
    const row: Row = {
      id: prev?.id ?? makeId(),
      phase_id: phase.id,
      week_index: gen.weekIndex,
      week_start_date: gen.weekStartDate,
      week_type: gen.weekType,
      target_load_tss: gen.targetLoadTss,
      target_volume_km: gen.targetVolumeKm,
      target_dplus_m: gen.targetDplusM,
      comment: prev?.comment ?? null,
      is_manual_override: false,
      generated_from_pattern: true,
    }
    toUpsert.push(row)
    result.push(weekFromRow(row))
  }

  if (toUpsert.length > 0) {
    await supabase
      .from('mesocycle_weeks')
      .upsert(toUpsert, { onConflict: 'phase_id,week_index' })
  }

  // 5. Supprimer les rows hors plage (phase raccourcie). Note : supprime aussi
  // les overrides hors plage — assumé : la semaine n'existe plus, ses données partent.
  await supabase
    .from('mesocycle_weeks')
    .delete()
    .eq('phase_id', phase.id)
    .gte('week_index', weekCount)

  return result.sort((a, b) => a.weekIndex - b.weekIndex)
}
