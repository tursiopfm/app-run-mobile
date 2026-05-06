import { redirect } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return <LoginForm />
}
