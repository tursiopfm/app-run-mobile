'use client'

// Bloc « Ta prochaine séance » du mode expert. Réutilise la logique partagée
// (useTodaySession) + le héros (PlanHeroCard) + les modales. Déplaçable via
// BlockGrid ; masquable via le kebab (onHide → hideSelf).

import { useBlockContext } from '@/components/blocks/BlockGrid'
import { PlanHeroCard } from '@/components/mission/PlanHeroCard'
import { NextSessionModals } from '@/components/mission/NextSessionModals'
import { useTodaySession } from '@/components/mission/useTodaySession'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'

type Props = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]
  hrZones: HrZone[]
  reloadKey: number
  onChange: () => void
}

export function ProchaineSeanceBlock({ freshnessPayload, recentActivities, hrZones, reloadKey, onChange }: Props) {
  const { hideSelf } = useBlockContext()
  const { loaded, heroProps, modalsState } = useTodaySession({
    freshnessPayload, recentActivities, hrZones, reloadKey, onSaved: onChange,
  })
  if (!loaded) return null
  return (
    <>
      <PlanHeroCard {...heroProps} onHide={hideSelf} />
      <NextSessionModals state={modalsState} />
    </>
  )
}
