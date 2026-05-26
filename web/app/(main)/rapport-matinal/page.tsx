import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { getMorningReportData } from '@/lib/data/morning-report'
import { MorningReportClient } from './MorningReportClient'

export default async function MorningReportPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const data = await getMorningReportData(user.id)
  return <MorningReportClient data={data} />
}
