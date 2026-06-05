import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { ImportProgressBanner } from '@/components/ui/ImportProgressBanner'
import { WhatsNewModal } from '@/components/ui/WhatsNewModal'
import { PreferencesProvider } from '@/lib/preferences/PreferencesProvider'
import { getServerUser } from '@/lib/database/get-user'
import type { ReactNode } from 'react'

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return (
    <PreferencesProvider>
      <ImportProgressBanner />
      <AppShell>{children}</AppShell>
      <WhatsNewModal />
    </PreferencesProvider>
  )
}
