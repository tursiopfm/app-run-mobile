import { cache } from 'react'
import { createServiceClient } from './supabase-server'

export const getIsAdmin = cache(async (userId: string): Promise<boolean> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    return data?.is_admin === true
  } catch {
    return false
  }
})
