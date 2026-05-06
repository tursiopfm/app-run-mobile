'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.push('/dashboard')
        router.refresh()
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) { setError(error.message); return }
        setForgotSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion. Vérifiez votre .env.local.')
    } finally {
      setLoading(false)
    }
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Email envoyé</h1>
          <p className="text-sm text-trail-muted">
            Un lien de réinitialisation a été envoyé à{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotSent(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">
            {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
          </h2>
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
          {mode === 'login' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="text-xs text-trail-muted">Mot de passe</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null) }}
                  className="text-xs text-trail-accent underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-trail-primary text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading
              ? (mode === 'login' ? 'Connexion…' : 'Envoi…')
              : (mode === 'login' ? 'Se connecter' : 'Envoyer le lien')}
          </button>
          <p className="text-xs text-trail-muted text-center">
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <a href="/" className="text-trail-accent underline">Créer un compte</a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="text-trail-accent underline"
              >
                Retour à la connexion
              </button>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
