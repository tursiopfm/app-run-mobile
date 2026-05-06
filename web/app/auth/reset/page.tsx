'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let recovered = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovered = true
        setReady(true)
      }
    })

    const timer = setTimeout(() => {
      if (!recovered) setExpired(true)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(error.message); return }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Lien expiré</h1>
          <p className="text-sm text-trail-muted">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <a href="/" className="text-sm text-trail-accent underline">
            Demander un nouveau lien
          </a>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <p className="text-sm text-trail-muted">Vérification du lien…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">Nouveau mot de passe</h2>
          {error && (
            <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password" className="text-xs text-trail-muted block mb-1">Nouveau mot de passe</label>
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
          <div>
            <label htmlFor="confirm" className="text-xs text-trail-muted block mb-1">Confirmer le mot de passe</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
