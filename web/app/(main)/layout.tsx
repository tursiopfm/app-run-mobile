import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { ImportProgressBanner } from '@/components/ui/ImportProgressBanner'
import { getServerUser } from '@/lib/database/get-user'
import type { ReactNode } from 'react'

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return (
    <>
      <ImportProgressBanner />
      <AppShell>{children}</AppShell>
    </>
  )
}
