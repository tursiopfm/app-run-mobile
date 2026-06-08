# Auth par code OTP à 6 chiffres — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les liens email (confirmation d'inscription + reset mot de passe) par un code à 6 chiffres saisi en-app, immunisé contre le prefetch des scanners email (Outlook SafeLinks), et unifier la page de login.

**Architecture:** Tout le flux auth devient une machine à états dans le composant unique `LoginForm` (rendu par `/`). L'inscription et le reset envoient un code OTP (`{{ .Token }}`, sans lien), vérifié inline via `verifyOtp({ email, token, type })`. Les routes `/login` et `/auth/reset` redirigent vers `/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `@supabase/ssr` (browser client, supabase-js 2.105.x), Jest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-06-08-auth-otp-code-design.md](../specs/2026-06-08-auth-otp-code-design.md)

---

## File Structure

**Créés :**
- `web/components/auth/OtpCodeInput.tsx` — champ de saisie 6 chiffres (contrôlé, paste-friendly). Responsabilité unique : capture du code, zéro appel réseau.
- `web/__tests__/auth/OtpCodeInput.test.tsx`
- `web/__tests__/auth/LoginForm.test.tsx`
- `Prompts/email-confirm-signup-code-mockup.html` — template email inscription, code-only.
- `Prompts/email-reset-password-code-mockup.html` — template email reset, code-only.

**Modifiés :**
- `web/lib/i18n/dictionaries/fr.ts` — clés `auth` (type + valeurs FR).
- `web/lib/i18n/dictionaries/en.ts` — valeurs EN.
- `web/components/auth/LoginForm.tsx` — machine à états + flux OTP + renvoi.
- `web/app/login/page.tsx` — devient `redirect('/')`.
- `web/app/auth/reset/page.tsx` — devient `redirect('/')`.
- `tasks/lessons.md` — leçon prefetch/scanner.
- `docs/superpowers/specs/2026-06-08-auth-otp-code-design.md` — bandeau Status à jour.

---

## Task 0: Branche de travail

- [ ] **Step 1: Vérifier la branche courante et créer la feature branch**

Run :
```bash
git -C c:/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD
git -C c:/Users/Franc/app-run-mobile checkout -b feat/auth-otp-code
```
Expected : on quitte `master` pour `feat/auth-otp-code`.

---

## Task 1: Clés i18n

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (bloc type `auth` ~ligne 890 + bloc valeurs `auth` ~ligne 2862)
- Modify: `web/lib/i18n/dictionaries/en.ts` (bloc valeurs `auth` ~ligne 1718)

- [ ] **Step 1: Ajouter les clés au type `auth` (fr.ts)**

Dans le bloc de **type** (celui où les valeurs sont `string`), juste après `genericError: string`, ajouter :

```ts
    verifyTitle: string
    verifySubtitle: string
    resetTitle: string
    newPasswordPh: string
    btnVerify: string
    btnVerifying: string
    resendCode: string
    resendIn: string
    codeInvalid: string
```

- [ ] **Step 2: Ajouter les valeurs FR (fr.ts)**

Dans l'objet **valeurs** FR, juste après `genericError: 'Erreur de connexion.',`, ajouter :

```ts
    verifyTitle:      'Entre le code reçu',
    verifySubtitle:   'Code à 6 chiffres envoyé à',
    resetTitle:       'Réinitialise ton mot de passe',
    newPasswordPh:    'Nouveau mot de passe',
    btnVerify:        'Vérifier',
    btnVerifying:     'Vérification…',
    resendCode:       'Renvoyer le code',
    resendIn:         'Renvoyer dans',
    codeInvalid:      'Code invalide ou expiré.',
```

- [ ] **Step 3: Ajouter les valeurs EN (en.ts)**

Dans l'objet `auth` de en.ts, juste après la ligne `genericError:` (valeur EN), ajouter :

```ts
    verifyTitle:      'Enter the code',
    verifySubtitle:   '6-digit code sent to',
    resetTitle:       'Reset your password',
    newPasswordPh:    'New password',
    btnVerify:        'Verify',
    btnVerifying:     'Verifying…',
    resendCode:       'Resend code',
    resendIn:         'Resend in',
    codeInvalid:      'Invalid or expired code.',
```

- [ ] **Step 4: Vérifier que les deux dictionnaires satisfont le type**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```
Expected : aucune erreur (si une clé manque dans en.ts, tsc signale `Property 'verifyTitle' is missing`).

- [ ] **Step 5: Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "feat(auth): clés i18n pour la saisie de code OTP"
```

---

## Task 2: Composant `OtpCodeInput`

**Files:**
- Create: `web/components/auth/OtpCodeInput.tsx`
- Test: `web/__tests__/auth/OtpCodeInput.test.tsx`

- [ ] **Step 1: Écrire le test (échoue car le composant n'existe pas)**

`web/__tests__/auth/OtpCodeInput.test.tsx` :
```tsx
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { OtpCodeInput } from '@/components/auth/OtpCodeInput'

// Wrapper contrôlé : OtpCodeInput est piloté par value/onChange.
function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [value, setValue] = useState('')
  return <OtpCodeInput value={value} onChange={setValue} onComplete={onComplete} />
}

describe('OtpCodeInput', () => {
  it('rend 6 cases', () => {
    render(<Harness />)
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('saisit chiffre par chiffre et appelle onComplete au 6e', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.change(boxes[i], { target: { value: d } })
    })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('accepte un code collé', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => '987654' } })
    expect(onComplete).toHaveBeenCalledWith('987654')
  })

  it('ignore les caractères non numériques', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => 'ab12cd34ef56' } })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/OtpCodeInput.test.tsx
```
Expected : FAIL — `Cannot find module '@/components/auth/OtpCodeInput'`.

- [ ] **Step 3: Implémenter le composant**

`web/components/auth/OtpCodeInput.tsx` :
```tsx
'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

type Props = {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  length?: number
  disabled?: boolean
}

export function OtpCodeInput({ value, onChange, onComplete, length = 6, disabled = false }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.slice(0, length).split('')

  function commit(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  function handleInput(i: number, raw: string) {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    const clean = commit(value.slice(0, i) + typed)
    refs.current[Math.min(clean.length, length - 1)]?.focus()
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const clean = commit(value.slice(0, -1))
      refs.current[Math.min(clean.length, length - 1)]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const clean = commit(e.clipboardData.getData('text'))
    refs.current[Math.min(clean.length, length - 1)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ''}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`Chiffre ${i + 1}`}
          className="w-11 h-14 text-center text-xl font-semibold bg-trail-surface border border-trail-border rounded-xl text-trail-text outline-none focus:border-trail-accent disabled:opacity-50"
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test → succès**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/OtpCodeInput.test.tsx
```
Expected : PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/auth/OtpCodeInput.tsx web/__tests__/auth/OtpCodeInput.test.tsx
git commit -m "feat(auth): composant OtpCodeInput (saisie 6 chiffres, paste)"
```

---

## Task 3: `LoginForm` — machine à états + flux OTP

**Files:**
- Modify: `web/components/auth/LoginForm.tsx` (réécriture complète)
- Test: `web/__tests__/auth/LoginForm.test.tsx`

- [ ] **Step 1: Écrire les tests (échouent)**

`web/__tests__/auth/LoginForm.test.tsx` :
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LoginForm } from '@/components/auth/LoginForm'

const auth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  verifyOtp: jest.fn(),
  updateUser: jest.fn(),
  resend: jest.fn(),
}
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({ auth }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

function renderForm() {
  return render(
    <I18nProvider initialLang="fr">
      <LoginForm />
    </I18nProvider>
  )
}

function type(placeholderOrLabel: RegExp, val: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholderOrLabel), { target: { value: val } })
}

beforeEach(() => jest.clearAllMocks())

describe('LoginForm — inscription par code', () => {
  it('après signUp sans session, passe à la saisie du code', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => expect(screen.getByText(/entre le code reçu/i)).toBeInTheDocument())
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@runner.io', password: 'secret6' })
  })

  it('vérifie le code (type signup) puis redirige vers /dashboard', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await screen.findByText(/entre le code reçu/i)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => {
      expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'new@runner.io', token: '123456', type: 'signup' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('affiche une erreur si le code est invalide', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired or is invalid' } })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await screen.findByText(/entre le code reçu/i)
    const boxes = screen.getAllByRole('textbox')
    ;['9', '9', '9', '9', '9', '9'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('LoginForm — reset par code', () => {
  it('demande le code puis change le mot de passe', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    auth.updateUser.mockResolvedValue({ data: {}, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }))
    type(/^email$/i, 'lost@runner.io')
    fireEvent.click(screen.getByRole('button', { name: /envoyer le lien|envoyer le code/i }))
    await screen.findByText(/réinitialise ton mot de passe/i)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.change(screen.getByPlaceholderText(/nouveau mot de passe/i), { target: { value: 'brandnew6' } })
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => {
      expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'lost@runner.io', token: '123456', type: 'recovery' })
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'brandnew6' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
```

- [ ] **Step 2: Lancer les tests → échec**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/LoginForm.test.tsx
```
Expected : FAIL (les modes `signupVerify`/`resetVerify`, le bouton « Vérifier », et OtpCodeInput n'existent pas encore dans LoginForm).

- [ ] **Step 3: Réécrire `LoginForm.tsx`**

Remplacer intégralement `web/components/auth/LoginForm.tsx` par :
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, CalendarDays, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'
import { useT } from '@/lib/i18n/I18nProvider'
import { OtpCodeInput } from '@/components/auth/OtpCodeInput'

type Mode = 'login' | 'signup' | 'signupVerify' | 'forgot' | 'resetVerify'

const RESEND_COOLDOWN = 45

export function LoginForm() {
  const A = useT().auth
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
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

  function goVerify(next: Mode) {
    setCode('')
    setError(null)
    setCooldown(RESEND_COOLDOWN)
    setMode(next)
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
    setCooldown(RESEND_COOLDOWN)
    const supabase = createClient()
    if (mode === 'signupVerify') await supabase.auth.resend({ type: 'signup', email })
    else if (mode === 'resetVerify') await supabase.auth.resetPasswordForEmail(email)
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
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
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
              onClick={() => { setMode('login'); setError(null); setCode('') }}
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
```

> **Note (risque spec #1)** : `verifyOtp({ type: 'signup' })` est le type attendu pour la confirmation d'un `signUp()`. À confirmer en QA manuelle (Task 7) ; si Supabase renvoie « invalid type », basculer sur `type: 'email'`.

- [ ] **Step 4: Lancer les tests → succès**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/LoginForm.test.tsx
```
Expected : PASS (4 tests).

- [ ] **Step 5: Type-check**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```
Expected : aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add web/components/auth/LoginForm.tsx web/__tests__/auth/LoginForm.test.tsx
git commit -m "feat(auth): inscription & reset par code OTP dans LoginForm"
```

---

## Task 4: Nettoyage des routes `/login` et `/auth/reset`

**Files:**
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/auth/reset/page.tsx`
- Test: `web/__tests__/auth/auth-redirects.test.tsx`

- [ ] **Step 1: Écrire le test (échoue)**

`web/__tests__/auth/auth-redirects.test.tsx` :
```tsx
import { redirect } from 'next/navigation'
import LoginRedirect from '@/app/login/page'
import ResetRedirect from '@/app/auth/reset/page'

jest.mock('next/navigation', () => ({ redirect: jest.fn() }))

describe('redirections auth héritées', () => {
  beforeEach(() => jest.clearAllMocks())

  it('/login redirige vers /', () => {
    LoginRedirect()
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('/auth/reset redirige vers /', () => {
    ResetRedirect()
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/auth-redirects.test.tsx
```
Expected : FAIL (les pages exportent encore les anciens composants client, `redirect` non appelé).

- [ ] **Step 3: Remplacer `web/app/login/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

// Page de login historique : tout l'auth vit désormais sur `/` (LoginForm).
export default function LoginRedirect() {
  redirect('/')
}
```

- [ ] **Step 4: Remplacer `web/app/auth/reset/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

// Reset par lien email supprimé (flux code OTP inline sur `/`).
// Les anciens liens encore en circulation atterrissent ici → on les renvoie sur l'accueil.
export default function ResetRedirect() {
  redirect('/')
}
```

- [ ] **Step 5: Lancer le test → succès + type-check**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth/auth-redirects.test.tsx && npx tsc --noEmit
```
Expected : PASS (2 tests), aucune erreur tsc.

- [ ] **Step 6: Commit**

```bash
git add web/app/login/page.tsx web/app/auth/reset/page.tsx web/__tests__/auth/auth-redirects.test.tsx
git commit -m "refactor(auth): /login et /auth/reset redirigent vers / (page unique)"
```

---

## Task 5: Templates email code-only (mockups)

**Files:**
- Create: `Prompts/email-confirm-signup-code-mockup.html`
- Create: `Prompts/email-reset-password-code-mockup.html`

> Pas de test automatisé (HTML statique). Ces fichiers sont **paste-ready** pour Supabase → Authentication → Email Templates. Action manuelle de Franck (Task 7).

- [ ] **Step 1: Créer le mockup inscription**

`Prompts/email-confirm-signup-code-mockup.html` :
```html
<!--
  Trail Cockpit — e-mail « Confirm signup » CODE-ONLY (Supabase). Charte « Deep Mission ».
  >>> PASTE-READY : Supabase → Authentication → Email Templates → « Confirm signup ».
      Sujet suggéré : « Ton code de confirmation Trail Cockpit »
      {{ .Token }} = code à 6 chiffres. NE PAS ajouter de lien (token partagé = prefetchable).
-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#0B0F14;background:radial-gradient(120% 90% at 50% -10%, rgba(255,121,0,0.10) 0%, rgba(255,121,0,0) 55%), #0B0F14;padding:40px 16px;margin:0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;background:#121821;border:1px solid #25303E;border-radius:16px;overflow:hidden;">
      <tr><td style="height:3px;line-height:3px;font-size:3px;background:linear-gradient(90deg, rgba(255,121,0,0) 0%, #FF7900 50%, rgba(255,121,0,0) 100%);">&nbsp;</td></tr>
      <tr><td style="padding:40px 36px 36px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:18px;">
          <img src="https://trailcockpit.run/icons/icon-512.png" width="64" height="64" alt="Trail Cockpit"
               style="display:block;margin:0 auto 14px auto;width:64px;height:64px;border:0;" />
          <div style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:21px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#E2ECE9;">
            <span style="color:#FF7900;">Trail</span>&nbsp;Cockpit
          </div>
        </td></tr></table>

        <h1 style="margin:0 0 14px 0;text-align:center;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;line-height:1.2;color:#E2ECE9;">
          Bienvenue à bord.
        </h1>
        <p style="margin:0 0 26px 0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#B7C6C1;">
          Entre ce code dans l'application pour activer ton compte :
        </p>

        <div style="margin:0 auto 26px auto;text-align:center;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:40px;font-weight:700;letter-spacing:0.36em;color:#FF8A33;padding:18px 0;background:#0B0F14;border:1px solid #25303E;border-radius:12px;">
          {{ .Token }}
        </div>

        <p style="margin:0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8BA8A3;">
          Ce code expire dans 1 heure. Si tu n'es pas à l'origine de cette inscription, ignore cet e-mail.
        </p>
      </td></tr>
      <tr><td style="border-top:1px solid #25303E;padding:22px 36px 30px 36px;">
        <p style="margin:0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8BA8A3;">
          À très vite sur les sentiers,<br />
          <span style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-weight:600;color:#B7C6C1;">L'équipe Trail Cockpit</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

- [ ] **Step 2: Créer le mockup reset**

`Prompts/email-reset-password-code-mockup.html` : identique au précédent, sauf :
- commentaire d'en-tête → « Reset Password », sujet « Ton code de réinitialisation Trail Cockpit ».
- `<h1>` → `Réinitialise ton mot de passe.`
- paragraphe d'intro → `Entre ce code dans l'application pour choisir un nouveau mot de passe :`
- le reste (logo, bloc `{{ .Token }}`, mention d'expiration, footer) **strictement identique**.

```html
<!--
  Trail Cockpit — e-mail « Reset Password » CODE-ONLY (Supabase). Charte « Deep Mission ».
  >>> PASTE-READY : Supabase → Authentication → Email Templates → « Reset Password ».
      Sujet suggéré : « Ton code de réinitialisation Trail Cockpit »
      {{ .Token }} = code à 6 chiffres. NE PAS ajouter de lien (token partagé = prefetchable).
-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#0B0F14;background:radial-gradient(120% 90% at 50% -10%, rgba(255,121,0,0.10) 0%, rgba(255,121,0,0) 55%), #0B0F14;padding:40px 16px;margin:0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;background:#121821;border:1px solid #25303E;border-radius:16px;overflow:hidden;">
      <tr><td style="height:3px;line-height:3px;font-size:3px;background:linear-gradient(90deg, rgba(255,121,0,0) 0%, #FF7900 50%, rgba(255,121,0,0) 100%);">&nbsp;</td></tr>
      <tr><td style="padding:40px 36px 36px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:18px;">
          <img src="https://trailcockpit.run/icons/icon-512.png" width="64" height="64" alt="Trail Cockpit"
               style="display:block;margin:0 auto 14px auto;width:64px;height:64px;border:0;" />
          <div style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:21px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#E2ECE9;">
            <span style="color:#FF7900;">Trail</span>&nbsp;Cockpit
          </div>
        </td></tr></table>

        <h1 style="margin:0 0 14px 0;text-align:center;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;line-height:1.2;color:#E2ECE9;">
          Réinitialise ton mot de passe.
        </h1>
        <p style="margin:0 0 26px 0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#B7C6C1;">
          Entre ce code dans l'application pour choisir un nouveau mot de passe :
        </p>

        <div style="margin:0 auto 26px auto;text-align:center;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:40px;font-weight:700;letter-spacing:0.36em;color:#FF8A33;padding:18px 0;background:#0B0F14;border:1px solid #25303E;border-radius:12px;">
          {{ .Token }}
        </div>

        <p style="margin:0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8BA8A3;">
          Ce code expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.
        </p>
      </td></tr>
      <tr><td style="border-top:1px solid #25303E;padding:22px 36px 30px 36px;">
        <p style="margin:0;text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8BA8A3;">
          À très vite sur les sentiers,<br />
          <span style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-weight:600;color:#B7C6C1;">L'équipe Trail Cockpit</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

- [ ] **Step 3: Commit**

```bash
git add Prompts/email-confirm-signup-code-mockup.html Prompts/email-reset-password-code-mockup.html
git commit -m "feat(auth): templates email code-only (inscription + reset)"
```

---

## Task 6: Docs (lessons + bandeau spec)

**Files:**
- Modify: `tasks/lessons.md`
- Modify: `docs/superpowers/specs/2026-06-08-auth-otp-code-design.md`

- [ ] **Step 1: Ajouter la leçon en tête de `tasks/lessons.md`**

Insérer juste après la ligne `<!-- Les entrées les plus récentes en premier -->` :
```
[2026-06-08] | Confirmation d'inscription / reset MdP cassés pour les utilisateurs Orange/Outlook : le lien magique (`/auth/confirm?token_hash=…`) porte un OTP à usage unique, et le scanner SafeLinks d'Outlook **prefetch** le lien → consomme le token avant le clic de l'utilisateur → `otp_expired` → `/login?error=confirm`. Diagnostic via logs auth Supabase (`POST /verify 200` suivi 2 s après de `403 otp_expired`). | Pour toute confirmation par email (signup, recovery, magic link), préférer un **code OTP à 6 chiffres** (`{{ .Token }}`, saisi en-app via verifyOtp) plutôt qu'un lien cliquable. Le code et le lien (`{{ .TokenHash }}`) étant le **même OTP**, garder le lien réintroduit la faille → templates **code-only**, lien retiré. Mode d'échec documenté Supabase : guide « OTP Verification Failures / email prefetching ».
```

- [ ] **Step 2: Mettre à jour le bandeau de la spec**

Dans `docs/superpowers/specs/2026-06-08-auth-otp-code-design.md`, remplacer la ligne :
```
> **Status: Spec** · 2026-06-08 · Code: _(à implémenter)_
```
par :
```
> **Status: Implémenté** · 2026-06-08 · Code: web/components/auth/LoginForm.tsx, web/components/auth/OtpCodeInput.tsx
```

- [ ] **Step 3: Commit**

```bash
git add tasks/lessons.md docs/superpowers/specs/2026-06-08-auth-otp-code-design.md
git commit -m "docs(auth): leçon prefetch + bandeau spec OTP"
```

---

## Task 7: Vérification finale (suite complète + QA manuelle)

- [ ] **Step 1: Lancer les suites auth + type-check**

Run :
```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/auth && npx tsc --noEmit
```
Expected : toutes les suites `__tests__/auth` PASS, aucune erreur tsc.
(Rappel : ~50 tests jest pré-existants échouent hors de ces suites — `useI18n` hors provider — ne pas s'en alarmer, ce n'est pas notre changement.)

- [ ] **Step 2: Action manuelle Franck — templates Supabase**

Coller dans Supabase → Authentication → Email Templates :
- « Confirm signup » ← `Prompts/email-confirm-signup-code-mockup.html`
- « Reset Password » ← `Prompts/email-reset-password-code-mockup.html`
Vérifier que **« Confirm email » reste activé** (Authentication → Providers → Email).

- [ ] **Step 3: QA manuelle bout-en-bout** (après déploiement de la branche)

  1. Inscription avec une vraie adresse → recevoir le code → le saisir → arriver sur `/dashboard`. **Confirme que `type: 'signup'` fonctionne** (sinon basculer Task 3 sur `'email'`).
  2. « Mot de passe oublié » → recevoir le code → saisir code + nouveau MdP → `/dashboard`.
  3. Bouton « Renvoyer le code » : grisé pendant 45 s puis renvoie un code valide.
  4. Visiter `/login` et `/auth/reset` → redirigés vers `/`.

---

## Self-Review (rempli pendant la rédaction)

**Couverture spec :**
- Flux inscription code → Task 1 (i18n) + Task 3. ✓
- Flux reset code (écran combiné) → Task 3. ✓
- `OtpCodeInput` isolé → Task 2. ✓
- Renvoi avec cooldown → Task 3 (`handleResend` + `cooldown`). ✓
- Nettoyage `/login` + `/auth/reset` → Task 4. ✓
- Templates code-only → Task 5. ✓
- i18n → Task 1. ✓
- Tests → Tasks 2, 3, 4. ✓
- Docs (lessons + bandeau) → Task 6. ✓
- Risques spec (#1 type signup, #2 PKCE, #3 rate-limit, #4 confirm email activé) → notés Task 3 (#1), Task 7 (#3, #4) ; #2 résolu (verifyOtp par code indépendant du flowType). ✓

**Placeholders :** aucun « TBD/TODO » ; tout le code est fourni in extenso (le mockup reset reprend le HTML complet, pas un renvoi « comme Task 5 »).

**Cohérence des types :** `verifyOtp({ email, token, type })`, `setMode`/`Mode`, `OtpCodeInput` props (`value`/`onChange`/`onComplete`/`disabled`) cohérents entre composant (Task 2) et consommateur (Task 3). Clés i18n (`verifyTitle`, `resetTitle`, `newPasswordPh`, `btnVerify`, `btnVerifying`, `resendCode`, `resendIn`, `codeInvalid`) définies Task 1 et toutes consommées Task 3.
