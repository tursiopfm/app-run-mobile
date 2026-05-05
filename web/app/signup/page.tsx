'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setCheckEmail(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion. Vérifiez votre .env.local.')
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Vérifiez votre email</h1>
          <p className="text-sm text-trail-muted">
            Un lien de confirmation a été envoyé à{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <a href="/login" className="inline-block text-sm text-trail-accent underline">
            Retour à la connexion
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">Créer un compte</h2>
          {error && (
            <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="email" className="text-xs text-trail-muted block mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs text-trail-muted block mb-1">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-trail-primary text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
          <p className="text-xs text-trail-muted text-center">
            Déjà un compte ?{' '}
            <a href="/login" className="text-trail-accent underline">Se connecter</a>
          </p>
        </form>
      </div>
    </div>
  )
}
