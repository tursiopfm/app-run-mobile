import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { getServerUser } from '@/lib/database/get-user'
import type { ReactNode } from 'react'

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return <AppShell>{children}</AppShell>
}
