import PlanClient from './PlanClient'
import { getServerAppMode } from '@/lib/preferences/server'

export default async function PlanPage() {
  const mode = await getServerAppMode()
  return <PlanClient mode={mode} />
}
