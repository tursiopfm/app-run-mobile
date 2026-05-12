import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { getChargePageData } from '@/lib/data/charge'
import { ChargePageClient } from './ChargePageClient'

export default async function ChargePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const data = await getChargePageData(user.id)
  return <ChargePageClient data={data} />
}
