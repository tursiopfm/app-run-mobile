import { redirect } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  // ?mode=signup → ouvre directement le formulaire en mode inscription
  // (utilisé par les CTA des pages publiques partagées).
  const { mode } = await searchParams
  const initialMode = mode === 'signup' ? 'signup' : 'login'

  return <LoginForm initialMode={initialMode} />
}
