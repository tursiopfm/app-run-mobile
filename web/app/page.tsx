'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, Mountain } from 'lucide-react'
import { AppShell } from '@/components/navigation/AppShell'
import { createClient } from '@/lib/database/supabase-client'

type Mode = 'login' | 'signup'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
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
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.push('/dashboard')
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setCheckEmail(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion.')
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
          <button
            onClick={() => { setCheckEmail(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-trail-bg flex flex-col">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">
          <div className="mb-6">
            <img
              src="/icons/icon-192.png"
              alt="Trail Cockpit"
              className="w-16 h-16 rounded-2xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-trail-text mb-3 tracking-tight">Trail Cockpit</h1>
          <p className="text-trail-muted text-base max-w-xs leading-relaxed">
            Pilotez votre entraînement trail &amp; endurance avec précision
          </p>

          {/* Auth form */}
          <form onSubmit={handleSubmit} className="mt-8 w-full max-w-xs space-y-3">
            {error && (
              <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="Email"
              className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Mot de passe"
              className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
            />
            <button
              type="submit"
              disabled={loading}
              className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading
                ? (mode === 'login' ? 'Connexion…' : 'Création…')
                : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
            </button>
            <p className="text-xs text-trail-muted text-center">
              {mode === 'login' ? (
                <>Pas encore de compte ?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="text-trail-accent underline">
                    Créer un compte
                  </button>
                </>
              ) : (
                <>Déjà un compte ?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                    Se connecter
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Feature grid */}
        <div className="px-6 pb-16 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
          {[
            { icon: BarChart3, title: 'Charge', desc: 'ATL / CTL / TSB en temps réel' },
            { icon: Zap,       title: 'Effort', desc: 'Score effort multi-sports'     },
            { icon: Brain,     title: 'Coach',  desc: 'Analyse IA de vos séances'     },
            { icon: Mountain,  title: 'Ultra',  desc: 'Préparation ultra trails'       },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-trail-surface border border-trail-border rounded-2xl p-4">
              <Icon className="text-trail-primary mb-2" size={20} />
              <p className="font-semibold text-trail-text text-sm">{title}</p>
              <p className="text-trail-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
