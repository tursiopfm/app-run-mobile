import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { createClient } from '@/lib/database/supabase-server'
import CoursesClient from './CoursesClient'

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell>
      <CoursesClient />
    </AppShell>
  )
}
