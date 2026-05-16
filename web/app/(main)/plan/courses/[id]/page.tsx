import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { CoursePageClient } from './CoursePageClient'

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return <CoursePageClient raceId={params.id} />
}
