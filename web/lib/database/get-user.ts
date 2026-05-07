import { cache } from 'react'
import { createClient } from './supabase-server'

export const getServerUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
