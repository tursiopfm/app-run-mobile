> **Status: Implémenté** · Date: 2026-05-02 · Code: `web/lib/database/supabase-server.ts`, `web/middleware.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Supabase Auth Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase Auth into the Trail Cockpit web app — auto-create user profiles on signup, add login/signup pages, show email + logout in Settings, refresh sessions via middleware, and update README with a Supabase setup guide.

**Architecture:** Existing `@supabase/ssr` browser/server clients are already in place. Auth state lives in Supabase session cookies. A Next.js middleware refreshes those cookies on every request (required by `@supabase/ssr`). Login and signup are dedicated `'use client'` pages. Settings gains a client component `AccountSection` that fetches the current user and renders email + logout. A new migration adds `role`/`subscription_status` columns and an `auth.users` trigger that auto-inserts a row in `public.profiles` on every signup.

**Tech Stack:** Next.js 14 App Router, `@supabase/ssr` 0.5, TypeScript 5, Tailwind CSS 3, Jest 29 + Testing Library

---

## Audit Summary (already done — do not re-create)

| File | Status |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | ✅ All 10 tables exist |
| `supabase/migrations/002_rls_policies.sql` | ✅ RLS enabled on all tables |
| `lib/database/supabase-client.ts` | ✅ Browser client |
| `lib/database/supabase-server.ts` | ✅ Server + service clients |
| `app/api/strava/connect/route.ts` | ✅ Strava OAuth initiation |
| `app/api/strava/callback/route.ts` | ✅ Strava OAuth callback |
| `.env.example` | ✅ All variables present incl. NEXT_PUBLIC_APP_URL |
| `middleware.ts` | ❌ Missing — needs session refresh |
| `app/login/page.tsx` | ❌ Missing |
| `app/signup/page.tsx` | ❌ Missing |
| `components/settings/AccountSection.tsx` | ❌ Missing |
| Migration 003 (profile trigger) | ❌ Missing |

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/003_profile_trigger.sql` | Add role/subscription_status columns + trigger to auto-create profile on auth.users insert |
| Create | `middleware.ts` | Refresh Supabase session cookies on every request; protect /admin in production |
| Create | `__tests__/auth/login.test.tsx` | Unit tests for login page |
| Create | `app/login/page.tsx` | Email+password login form (client component) |
| Create | `__tests__/auth/signup.test.tsx` | Unit tests for signup page |
| Create | `app/signup/page.tsx` | Email+password signup form (client component) |
| Create | `__tests__/auth/account-section.test.tsx` | Unit tests for AccountSection |
| Create | `components/settings/AccountSection.tsx` | Client component: show email + logout button |
| Modify | `app/settings/page.tsx` | Import and render AccountSection |
| Modify | `README.md` | Add Supabase setup section (project creation, keys, migrations, test signup) |

---

### Task 1: Migration 003 — profile trigger

**Files:**
- Create: `supabase/migrations/003_profile_trigger.sql`

No unit test for SQL. This migration:
1. Adds `role` and `subscription_status` columns to `profiles` (missing from migration 001)
2. Creates a `handle_new_user()` PL/pgSQL function that inserts into `public.profiles` whenever a row is created in `auth.users`
3. Attaches that function as a trigger

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/003_profile_trigger.sql

-- Add role + subscription_status to profiles (not in migration 001)
alter table profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'pro', 'premium'));

-- Function: insert a profiles row when a new auth.users row is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, subscription_status)
  values (
    new.id,
    new.email,
    'user',
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: fire after every auth.users INSERT
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_profile_trigger.sql
git commit -m "feat(db): add role/subscription_status columns + auto-create profile trigger"
```

---

### Task 2: Middleware — session refresh + /admin protection

**Files:**
- Create: `middleware.ts` (in `web/` root, same level as `next.config.mjs`)

No unit test (Next.js middleware runs in the edge runtime, incompatible with jest-jsdom).

- [ ] **Step 1: Create middleware.ts**

```typescript
// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Required: refresh session tokens on every request
  const { data: { user } } = await supabase.auth.getUser()

  // /admin: open in development, require auth in production
  if (
    request.nextUrl.pathname.startsWith('/admin') &&
    process.env.NODE_ENV === 'production' &&
    !user
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add session-refresh middleware, protect /admin in production"
```

---

### Task 3: Login page (TDD)

**Files:**
- Create: `__tests__/auth/login.test.tsx`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/auth/login.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

const mockSignIn = jest.fn()
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignIn },
  }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('LoginPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders email and password fields with submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
  })

  it('shows error message on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to /dashboard on successful login', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (file not found)**

```bash
cd web && npx jest __tests__/auth/login.test.tsx --no-coverage
```

Expected: `Cannot find module '@/app/login/page'`

- [ ] **Step 3: Implement app/login/page.tsx**

```typescript
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">Connexion</h2>
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
              autoComplete="current-password"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-trail-accent text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="text-xs text-trail-muted text-center">
            Pas encore de compte ?{' '}
            <a href="/signup" className="text-trail-accent underline">Créer un compte</a>
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd web && npx jest __tests__/auth/login.test.tsx --no-coverage
```

Expected: `PASS __tests__/auth/login.test.tsx` with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add __tests__/auth/login.test.tsx app/login/page.tsx
git commit -m "feat(auth): add /login page with email+password form"
```

---

### Task 4: Signup page (TDD)

**Files:**
- Create: `__tests__/auth/signup.test.tsx`
- Create: `app/signup/page.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/auth/signup.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

const mockSignUp = jest.fn()
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp },
  }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('SignupPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders email and password fields with submit button', () => {
    render(<SignupPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeInTheDocument()
  })

  it('shows error message on signup failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User already registered')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to /dashboard when session is returned immediately (email confirmation off)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: '1' }, session: { access_token: 'tok' } },
      error: null,
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows check-email message when email confirmation is required', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: '1' }, session: null },
      error: null,
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'confirm@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(screen.getByText(/vérifiez votre email/i)).toBeInTheDocument()
      expect(screen.getByText('confirm@example.com')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (file not found)**

```bash
cd web && npx jest __tests__/auth/signup.test.tsx --no-coverage
```

Expected: `Cannot find module '@/app/signup/page'`

- [ ] **Step 3: Implement app/signup/page.tsx**

```typescript
// app/signup/page.tsx
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
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setCheckEmail(true)
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
            className="w-full bg-trail-accent text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd web && npx jest __tests__/auth/signup.test.tsx --no-coverage
```

Expected: `PASS __tests__/auth/signup.test.tsx` with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add __tests__/auth/signup.test.tsx app/signup/page.tsx
git commit -m "feat(auth): add /signup page with email+password form, handle email confirmation"
```

---

### Task 5: AccountSection component (TDD)

**Files:**
- Create: `__tests__/auth/account-section.test.tsx`
- Create: `components/settings/AccountSection.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/auth/account-section.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AccountSection } from '@/components/settings/AccountSection'

const mockGetUser = jest.fn()
const mockSignOut = jest.fn()
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser, signOut: mockSignOut },
  }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('AccountSection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { container } = render(<AccountSection />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('displays user email when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'runner@example.com' } } })
    render(<AccountSection />)
    await waitFor(() => {
      expect(screen.getByText('runner@example.com')).toBeInTheDocument()
    })
  })

  it('signs out and redirects to / on logout click', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'runner@example.com' } } })
    mockSignOut.mockResolvedValue({})
    render(<AccountSection />)
    await waitFor(() => screen.getByText('runner@example.com'))
    fireEvent.click(screen.getByRole('button', { name: /se déconnecter/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (file not found)**

```bash
cd web && npx jest __tests__/auth/account-section.test.tsx --no-coverage
```

Expected: `Cannot find module '@/components/settings/AccountSection'`

- [ ] **Step 3: Implement components/settings/AccountSection.tsx**

```typescript
// components/settings/AccountSection.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export function AccountSection() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!email) return null

  return (
    <section>
      <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Compte</p>
      <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
        <div className="flex items-center justify-between p-4">
          <p className="text-sm text-trail-muted">Email</p>
          <p className="text-sm text-trail-text truncate max-w-[200px]">{email}</p>
        </div>
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-red-500 font-medium py-1"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd web && npx jest __tests__/auth/account-section.test.tsx --no-coverage
```

Expected: `PASS __tests__/auth/account-section.test.tsx` with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add __tests__/auth/account-section.test.tsx components/settings/AccountSection.tsx
git commit -m "feat(auth): add AccountSection component with email display and logout"
```

---

### Task 6: Wire AccountSection into Settings page

**Files:**
- Modify: `app/settings/page.tsx` (add import + render AccountSection at bottom)

- [ ] **Step 1: Update app/settings/page.tsx**

Replace the top of the file (imports + export) — add `AccountSection` import and render it as the last section inside `<AppShell>`:

```typescript
// app/settings/page.tsx
import { AppShell } from '@/components/navigation/AppShell'
import { ExternalLink, ChevronRight, Circle } from 'lucide-react'
import { AccountSection } from '@/components/settings/AccountSection'

export default function SettingsPage() {
  return (
    <AppShell title="Réglages">
      <div className="px-4 py-4 space-y-4">
        {/* Connexions */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Connexions</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#FC4C02]/15 flex items-center justify-center flex-shrink-0">
                <ExternalLink size={16} className="text-[#FC4C02]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-trail-text">Strava</p>
                <p className="text-xs text-trail-muted">Non connecté</p>
              </div>
              <a
                href="/api/strava/connect"
                className="px-3 py-1.5 rounded-lg bg-[#FC4C02] text-white text-xs font-semibold"
              >
                Connecter
              </a>
            </div>
            {['Garmin', 'Polar', 'Suunto', 'Coros'].map((p) => (
              <div key={p} className="flex items-center gap-3 p-4 opacity-50">
                <Circle size={18} className="text-trail-muted" />
                <p className="text-sm text-trail-text flex-1">{p}</p>
                <span className="text-xs text-trail-muted">Bientôt</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil athlète */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Profil athlète</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            {[
              ['FC max',         '185 bpm'],
              ['FC seuil',       '165 bpm'],
              ['Allure seuil',   '5:00/km'],
              ['FTP vélo',       '220 W'  ],
              ['Objectif annuel','3 000 km'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-4">
                <p className="text-sm text-trail-text">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-trail-muted">{value}</span>
                  <ChevronRight size={14} className="text-trail-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Compte (affiché uniquement si connecté) */}
        <AccountSection />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat(settings): show AccountSection with email and logout when authenticated"
```

---

### Task 7: Update README.md with Supabase setup guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Supabase Setup section after the existing Installation section**

Append the following section to `README.md` (after the "Tester sur mobile avec ngrok" section):

```markdown
## Configuration Supabase

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Choisir un nom de projet (ex: `trail-cockpit`)
3. Choisir un mot de passe pour la base de données (le noter)
4. Sélectionner une région proche (ex: `West EU`)
5. Attendre ~2 minutes que le projet soit prêt

### 2. Récupérer les clés

Dans le dashboard Supabase → **Settings → API** :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Section **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Section **Project API keys → anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Section **Project API keys → service_role** (⚠️ secret) |

Copier ces trois valeurs dans `.env.local`.

### 3. Appliquer les migrations

**Option A — Supabase CLI (recommandé)**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-project-ref>
# Le project-ref est dans Settings → General → Reference ID
supabase db push
```

**Option B — SQL Editor dans le dashboard**

Dans Supabase → **SQL Editor**, exécuter dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_profile_trigger.sql`

### 4. Vérifier les tables créées

Dans Supabase → **Table Editor**, vous devez voir :
`profiles`, `provider_connections`, `activities`, `activity_metrics`,
`daily_metrics`, `weekly_metrics`, `webhook_events`, `sync_jobs`,
`coach_messages`, `admin_logs`

### 5. Tester signup / login

```bash
cd web && npm run dev
```

1. Ouvrir http://localhost:3000/signup
2. Saisir un email et un mot de passe (min 6 caractères)
3. Cliquer **Créer mon compte**
   - Si email confirmation désactivée → redirection vers `/dashboard`
   - Si email confirmation activée → message "Vérifiez votre email"
4. Aller dans Supabase → **Authentication → Users** : votre utilisateur apparaît
5. Aller dans Supabase → **Table Editor → profiles** : une ligne a été créée automatiquement
6. Ouvrir http://localhost:3000/settings : votre email apparaît dans la section **Compte**
7. Cliquer **Se déconnecter** → retour à la page d'accueil

### Désactiver la confirmation email (optionnel en développement)

Dans Supabase → **Authentication → Providers → Email** :
désactiver **Confirm email** pour un accès immédiat sans vérifier l'email.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Supabase setup guide to README (project, keys, migrations, test signup)"
```

---

### Task 8: Lint + Build verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd web && npm test -- --no-coverage
```

Expected: all tests pass including the 3 new auth test files (10 new tests total).

- [ ] **Step 2: Run lint**

```bash
cd web && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
cd web && npm run build
```

Expected: `✓ Compiled successfully` — no TypeScript or build errors.

If the build fails because `NEXT_PUBLIC_SUPABASE_URL` is required at build time, add a dummy fallback to the `requireEnv` call in `lib/database/supabase-client.ts` and `lib/database/supabase-server.ts`. Do NOT do this pre-emptively — only if the build actually fails with a missing-env error.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(build): <describe what was fixed>"
```

---

## Commands summary

```bash
# From repo root
cd C:\Users\Franc\app-run-mobile\web

# Install (already done, but in case)
npm install

# Run all tests
npm test

# Lint
npm run lint

# Build
npm run build

# Dev server
npm run dev
# → http://localhost:3000/login
# → http://localhost:3000/signup
# → http://localhost:3000/settings

# Apply migrations via Supabase CLI
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Spec coverage check

| Requirement | Task |
|---|---|
| Audit existing Supabase files | ✅ Done pre-plan |
| Verify .env.example complete | ✅ Already complete (NEXT_PUBLIC_APP_URL present) |
| Migration: profiles + all 10 tables | ✅ Already in 001/002; 003 adds trigger |
| RLS on user tables | ✅ Already in 002 |
| Auto-create profile on signup | Task 1 |
| role = user, subscription_status = free defaults | Task 1 |
| /login page (email+password) | Task 3 |
| /signup page (email+password) | Task 4 |
| User email in Settings | Task 5 + 6 |
| Logout button | Task 5 + 6 |
| middleware.ts session refresh | Task 2 |
| /admin open in dev, protected in prod | Task 2 |
| /dashboard accessible with mock fallback | ✅ Not changed |
| README Supabase setup guide | Task 7 |
| npm run lint + build | Task 8 |
| SERVICE_ROLE_KEY never client-side | ✅ Only in supabase-server.ts createServiceClient() |
| supabase-server.ts never in client component | ✅ AccountSection uses supabase-client.ts |
| .env.local gitignored | ✅ Already in .gitignore |
