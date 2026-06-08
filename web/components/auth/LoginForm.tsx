'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, CalendarDays, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'
import { useT } from '@/lib/i18n/I18nProvider'

type Mode = 'login' | 'signup' | 'forgot'

export function LoginForm() {
  const A = useT().auth
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
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
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError(A.pwMismatch)
          return
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setCheckEmail(true)
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) { setError(error.message); return }
        setForgotSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : A.genericError)
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">{A.checkEmailTitle}</h1>
          <p className="text-sm text-trail-muted">
            {A.checkEmailBody}{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setCheckEmail(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            {A.backToLogin}
          </button>
        </div>
      </div>
    )
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">{A.forgotSentTitle}</h1>
          <p className="text-sm text-trail-muted">
            {A.forgotSentBody}{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotSent(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            {A.backToLogin}
          </button>
        </div>
      </div>
    )
  }

  return (
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
          {A.appTagline}
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
            placeholder={A.emailPh}
            className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
          />
          {mode !== 'forgot' && (
            <>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={A.passwordPh}
                  className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 pr-12 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? A.hidePw : A.showPw}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-trail-muted hover:text-trail-text rounded-lg"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {mode === 'signup' && (
                <>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder={A.confirmPasswordPh}
                      className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 pr-12 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      aria-label={showConfirm ? A.hidePw : A.showPw}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-trail-muted hover:text-trail-text rounded-lg"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs px-1 text-left ${password === confirmPassword ? 'text-trail-success' : 'text-trail-danger'}`}>
                      {password === confirmPassword ? A.pwMatch : A.pwMismatch}
                    </p>
                  )}
                </>
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null) }}
                    className="text-xs text-trail-accent underline"
                  >
                    {A.forgotPw}
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading
              ? (mode === 'forgot' ? A.btnSending : mode === 'login' ? A.btnLoggingIn : A.btnCreating)
              : (mode === 'forgot' ? A.btnSendLink : mode === 'login' ? A.btnLogin : A.btnSignup)}
          </button>
          <p className="text-xs text-trail-muted text-center">
            {mode === 'login' ? (
              <>{A.noAccount}{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="text-trail-accent underline">
                  {A.createAccount}
                </button>
              </>
            ) : mode === 'signup' ? (
              <>{A.haveAccount}{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                  {A.loginAction}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                {A.backToLogin}
              </button>
            )}
          </p>
        </form>
      </div>

      {/* Feature grid */}
      <div className="px-6 pb-16 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
        {[
          { icon: BarChart3,   title: A.featCharge, desc: A.featChargeDesc },
          { icon: Zap,         title: A.featEffort, desc: A.featEffortDesc },
          { icon: Brain,       title: A.featCoach,  desc: A.featCoachDesc },
          { icon: CalendarDays, title: A.featPlan,  desc: A.featPlanDesc },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-trail-surface border border-trail-border rounded-2xl p-4">
            <Icon className="text-trail-primary mb-2" size={20} />
            <p className="font-semibold text-trail-text text-sm">{title}</p>
            <p className="text-trail-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
