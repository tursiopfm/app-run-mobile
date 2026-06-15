import { createServiceClient } from '@/lib/database/supabase-server'
import { WhatsNewManager } from './WhatsNewManager'
import type { Bullet } from '@/lib/admin/whats-new'

export type PopupRow = {
  id: string
  title: string
  bullets: Bullet[]
  is_active: boolean
  created_at: string
}

export async function TabWhatsNew() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('whats_new_popups')
    .select('id, title, bullets, is_active, created_at')
    .order('created_at', { ascending: false })

  return <WhatsNewManager popups={(data ?? []) as PopupRow[]} />
}
