'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, CalendarDays, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'
import { useT } from '@/lib/i18n/I18nProvider'
import { OtpCodeInput } from '@/components/auth/OtpCodeInput'

type Mode = 'login' | 'signup' | 'signupVerify' | 'forgot' | 'resetVerify'

const RESEND_COOLDOWN = 45

export function LoginForm({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const A = useT().auth
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Décompte du renvoi de code.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  // Bascule de mode en repartant d'un état d'identifiants propre (évite de
  // traîner un mot de passe/code saisi dans un mode précédent).
  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirmPassword('')
    setCode('')
    setShowPassword(false)
    setShowConfirm(false)
  }

  function goVerify(next: Mode) {
    switchMode(next)
    setCooldown(RESEND_COOLDOWN)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.push('/dashboard'); router.refresh()

      } else if (mode === 'signup') {
        if (password !== confirmPassword) { setError(A.pwMismatch); return }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        if (data.session) { router.push('/dashboard'); router.refresh() }
        else goVerify('signupVerify')

      } else if (mode === 'signupVerify') {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
        if (error) { setError(A.codeInvalid); return }
        router.push('/dashboard'); router.refresh()

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) { setError(error.message); return }
        goVerify('resetVerify')

      } else if (mode === 'resetVerify') {
        if (password !== confirmPassword) { setError(A.pwMismatch); return }
        const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
        if (vErr) { setError(A.codeInvalid); return }
        const { error: uErr } = await supabase.auth.updateUser({ password })
        if (uErr) { setError(uErr.message); return }
        router.push('/dashboard'); router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : A.genericError)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setError(null)
    const supabase = createClient()
    const { error } = mode === 'signupVerify'
      ? await supabase.auth.resend({ type: 'signup', email })
      : await supabase.auth.resetPasswordForEmail(email)
    if (error) { setError(error.message); return }
    setCooldown(RESEND_COOLDOWN)
  }

  const isVerify = mode === 'signupVerify' || mode === 'resetVerify'

  // --- Écran de saisie du code ---
  if (isVerify) {
    const title = mode === 'signupVerify' ? A.verifyTitle : A.resetTitle
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-xs">
          <h1 className="text-2xl font-bold text-trail-text text-center mb-2">{title}</h1>
          <p className="text-sm text-trail-muted text-center mb-6">
            {A.verifySubtitle} <strong className="text-trail-text">{email}</strong>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2 text-center">
                {error}
              </p>
            )}
            <OtpCodeInput value={code} onChange={setCode} disabled={loading} />

            {mode === 'resetVerify' && (
              <>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder={A.newPasswordPh}
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

            <button
              type="submit"
              disabled={
                loading ||
                code.length < 6 ||
                (mode === 'resetVerify' && (password.length < 6 || password !== confirmPassword))
              }
              className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? A.btnVerifying : A.btnVerify}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className="block w-full text-xs text-trail-accent underline disabled:text-trail-muted disabled:no-underline"
            >
              {cooldown > 0 ? `${A.resendIn} ${cooldown}s` : A.resendCode}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="block w-full text-xs text-trail-muted underline"
            >
              {A.backToLogin}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- Écran login / signup / forgot ---
  return (
    <div className="min-h-screen bg-trail-bg flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">
        <div className="mb-6">
          <img src="/icons/icon-192.png" alt="Trail Cockpit" className="w-16 h-16 rounded-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-trail-text mb-3 tracking-tight">Trail Cockpit</h1>
        <p className="text-trail-muted text-base max-w-xs leading-relaxed">{A.appTagline}</p>

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
                    onClick={() => switchMode('forgot')}
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
              : (mode === 'forgot' ? A.btnSendCode : mode === 'login' ? A.btnLogin : A.btnSignup)}
          </button>
          <p className="text-xs text-trail-muted text-center">
            {mode === 'login' ? (
              <>{A.noAccount}{' '}
                <button type="button" onClick={() => switchMode('signup')} className="text-trail-accent underline">
                  {A.createAccount}
                </button>
              </>
            ) : mode === 'signup' ? (
              <>{A.haveAccount}{' '}
                <button type="button" onClick={() => switchMode('login')} className="text-trail-accent underline">
                  {A.loginAction}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => switchMode('login')} className="text-trail-accent underline">
                {A.backToLogin}
              </button>
            )}
          </p>
        </form>
      </div>

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
