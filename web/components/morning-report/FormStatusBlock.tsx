'use client'

import { LoadStatusCard } from '@/components/charge/blocks/LoadStatusCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

export function FormStatusBlock({ payload }: { payload: ChargeSportPayload }) {
  return <LoadStatusCard payload={payload} />
}
