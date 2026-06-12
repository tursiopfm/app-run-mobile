import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'

export default async function PlanPage({
  searchParams,
}: { searchParams?: { full?: string } }) {
  const mode = await getServerAppMode()
  if (mode === 'mission' && searchParams?.full !== '1') return <MissionPlan />
  return <PlanClient mode="expert" mission={null} />
}
