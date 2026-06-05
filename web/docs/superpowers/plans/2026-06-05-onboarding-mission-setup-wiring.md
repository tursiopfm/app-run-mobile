# Onboarding « Mission Setup » Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promouvoir le flow 5 étapes `MissionSetupFlow` comme onboarding de production à `/onboarding`, en persistant les 4 réponses (discipline/mission/mode/source) et en pilotant le parcours via une colonne `onboarding_completed_at`.

**Architecture:** Le composant client `MissionSetupFlow` PATCH les réponses vers `/api/profile`. Deux chemins de complétion : (a) Strava — persiste puis redirige vers OAuth, le callback pose `onboarding_completed_at` ; (b) sans Strava — PATCH avec `onboarding_complete:true`, le serveur pose le timestamp. Le gate (dashboard + page onboarding) lit `onboarding_completed_at`. Migration 033 ajoute les colonnes + backfill anti-régression pour les users existants.

**Tech Stack:** Next.js 14 App Router (server components + client), Supabase (`@supabase/ssr`), TypeScript, Tailwind (tokens Deep Mission `ink-*`), Jest + React Testing Library (jsdom).

**Spec:** `web/docs/superpowers/specs/2026-06-05-onboarding-mission-setup-wiring-design.md`

**Note environnement :** toutes les commandes `npm`/`npx` se lancent depuis `web/` (`cd c:/Users/Franc/app-run-mobile/web`). Git depuis la racine. Branche de travail : `feat/onboarding-mission-setup`.

---

## File Structure

- **Create** `web/supabase/migrations/033_profile_onboarding_answers.sql` — colonnes + backfill.
- **Create** `web/lib/profile/onboarding-completion.ts` — helper pur `onboardingCompletionPatch()` (logique du timestamp serveur, testable).
- **Create** `web/__tests__/lib/profile/onboarding-completion.test.ts` — test du helper.
- **Modify** `web/app/api/profile/route.ts` — allowlist + helper de complétion.
- **Modify** `web/app/api/strava/callback/route.ts` — poser `onboarding_completed_at` quand `from=onboarding`.
- **Modify** `web/app/(main)/dashboard/page.tsx` — gate sur `onboarding_completed_at`, retrait de la requête `provider_connections`.
- **Rewrite** `web/app/onboarding/page.tsx` — rend `<MissionSetupFlow>` avec props.
- **Rewrite** `web/components/onboarding/mission-setup/MissionSetupFlow.tsx` — version production (props, persistance, complétion, erreurs).
- **Create** `web/__tests__/onboarding/MissionSetupFlow.test.tsx` — comportement du composant.
- **Delete** `web/app/onboarding-preview/page.tsx`.
- **Delete** `web/components/onboarding/OnboardingStrava.tsx` + `web/__tests__/onboarding/OnboardingStrava.test.tsx`.

Les clés i18n `onboarding` dans `lib/i18n/dictionaries/{fr,en}.ts` deviennent inutilisées mais restent en place (typées par l'interface du dictionnaire) — ne pas y toucher, nettoyage optionnel ultérieur.

---

## Task 1: Migration 033 — colonnes + backfill

**Files:**
- Create: `web/supabase/migrations/033_profile_onboarding_answers.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- Onboarding « Mission Setup » : réponses + gate de complétion.
-- onboarding_completed_at est la source de vérité du gate (null = à faire).
-- Les 4 colonnes onboarding_* stockent les réponses (stockées-seulement en v1).
alter table profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_discipline text,
  add column if not exists onboarding_mission text,
  add column if not exists onboarding_mode text,
  add column if not exists onboarding_data_source text;

-- Backfill : ne pas renvoyer les users existants dans l'onboarding.
-- Un user est « déjà passé » s'il a skippé OU s'il a une connexion Strava.
update profiles p set onboarding_completed_at = now()
where p.onboarding_completed_at is null
  and (p.onboarding_skipped = true
       or exists (select 1 from provider_connections pc
                  where pc.user_id = p.id and pc.provider = 'strava'));
```

- [ ] **Step 2: Commit**

```bash
git add web/supabase/migrations/033_profile_onboarding_answers.sql
git commit -m "feat(onboarding): migration 033 — colonnes onboarding_* + backfill completed_at"
```

> ⚠️ Migration **non auto-appliquée**. À la fin du plan : rappeler à Franck de coller ce SQL dans le Supabase SQL Editor avant que le code en prod ne lise/écrive ces colonnes.

---

## Task 2: Helper de complétion + `/api/profile`

Logique nouvelle isolée dans un helper pur (testable sans mock Supabase), puis câblée dans la route.

**Files:**
- Create: `web/lib/profile/onboarding-completion.ts`
- Test: `web/__tests__/lib/profile/onboarding-completion.test.ts`
- Modify: `web/app/api/profile/route.ts`

- [ ] **Step 1: Écrire le test du helper**

```ts
// web/__tests__/lib/profile/onboarding-completion.test.ts
import { onboardingCompletionPatch } from '@/lib/profile/onboarding-completion'

describe('onboardingCompletionPatch', () => {
  it('pose onboarding_completed_at (ISO) quand onboarding_complete === true', () => {
    const patch = onboardingCompletionPatch({ onboarding_complete: true })
    expect(typeof patch.onboarding_completed_at).toBe('string')
    expect(new Date(patch.onboarding_completed_at as string).toISOString())
      .toBe(patch.onboarding_completed_at)
  })

  it('ne pose rien quand le flag est absent ou falsy', () => {
    expect(onboardingCompletionPatch({})).toEqual({})
    expect(onboardingCompletionPatch({ onboarding_complete: false })).toEqual({})
    expect(onboardingCompletionPatch({ onboarding_complete: 'true' as unknown as boolean })).toEqual({})
  })
})
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx jest __tests__/lib/profile/onboarding-completion.test.ts`
Expected: FAIL (`Cannot find module '@/lib/profile/onboarding-completion'`).

- [ ] **Step 3: Implémenter le helper**

```ts
// web/lib/profile/onboarding-completion.ts

// Décide le timestamp serveur de complétion d'onboarding.
// Strict `=== true` : on n'accepte jamais un timestamp fourni par le client.
export function onboardingCompletionPatch(
  body: { onboarding_complete?: unknown },
): { onboarding_completed_at?: string } {
  return body.onboarding_complete === true
    ? { onboarding_completed_at: new Date().toISOString() }
    : {}
}
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run: `npx jest __tests__/lib/profile/onboarding-completion.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Câbler la route `/api/profile`**

Dans `web/app/api/profile/route.ts` :

Ajouter l'import en tête :
```ts
import { onboardingCompletionPatch } from '@/lib/profile/onboarding-completion'
```

Étendre l'allowlist (remplacer la dernière ligne du tableau `allowed`) :
```ts
    'plan_auto_push_title', 'onboarding_skipped',
    'onboarding_discipline', 'onboarding_mission', 'onboarding_mode', 'onboarding_data_source',
  ]
```

Juste avant le `const { error } = await supabase.from('profiles').update(update)…`, fusionner le patch de complétion :
```ts
  Object.assign(update, onboardingCompletionPatch(body))
```

- [ ] **Step 6: Vérifier types + lint**

Run: `npx tsc --noEmit && npx eslint app/api/profile/route.ts lib/profile/onboarding-completion.ts`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add web/lib/profile/onboarding-completion.ts web/__tests__/lib/profile/onboarding-completion.test.ts web/app/api/profile/route.ts
git commit -m "feat(onboarding): /api/profile accepte les réponses + pose completed_at"
```

---

## Task 3: Callback Strava pose `onboarding_completed_at`

Quand l'utilisateur connecte Strava **depuis l'onboarding** (`from=onboarding`), le callback marque l'onboarding terminé après l'upsert réussi. Pas de test unitaire (handler dépendant de Supabase/OAuth, sans précédent de test de route dans ce repo) — vérifié par `tsc` + manuellement.

**Files:**
- Modify: `web/app/api/strava/callback/route.ts`

- [ ] **Step 1: Marquer la complétion après l'upsert réussi**

Dans `web/app/api/strava/callback/route.ts`, juste après le bloc `if (upsertError) { … }` (l'upsert a réussi) et **avant** le trigger cron, insérer :

```ts
    // Onboarding : connecter Strava depuis le flow termine l'onboarding
    // et enregistre la source de données côté serveur (fiable).
    if (from === 'onboarding') {
      await supabase
        .from('profiles')
        .update({ onboarding_completed_at: now, onboarding_data_source: 'strava' })
        .eq('id', user.id)
    }
```

(`now` et `from` sont déjà définis plus haut dans le handler.)

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/strava/callback/route.ts
git commit -m "feat(onboarding): callback Strava marque completed_at + data_source (from=onboarding)"
```

---

## Task 4: Gate dashboard sur `onboarding_completed_at`

**Files:**
- Modify: `web/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Retirer la requête `provider_connections` (devenue inutile)**

Dans le `Promise.all`, supprimer la dernière entrée et sa destructuration.

Destructuration — remplacer :
```ts
    { data: weekRows },
    { data: athleteProfile },
    { data: stravaConnection },
  ] = await Promise.all([
```
par :
```ts
    { data: weekRows },
    { data: athleteProfile },
  ] = await Promise.all([
```

Et supprimer le bloc de requête `provider_connections` (les ~7 lignes `supabase.from('provider_connections').select('user_id')…maybeSingle(),`) à la fin du tableau `Promise.all`.

- [ ] **Step 2: Ajouter `onboarding_completed_at` au select `profiles`**

Remplacer, dans le `.select(...)` de la requête `profiles`, le token `onboarding_skipped` par `onboarding_completed_at` :
```ts
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, onboarding_completed_at, hr_zone_method, hr_zones_custom')
```

- [ ] **Step 3: Remplacer la condition du gate**

Remplacer :
```ts
  if (!stravaConnection && !athleteProfile?.onboarding_skipped) {
    redirect('/onboarding')
  }
```
par :
```ts
  if (!athleteProfile?.onboarding_completed_at) {
    redirect('/onboarding')
  }
```

- [ ] **Step 4: Vérifier types + lint**

Run: `npx tsc --noEmit && npx eslint "app/(main)/dashboard/page.tsx"`
Expected: aucune erreur (notamment, plus de variable `stravaConnection` inutilisée).

- [ ] **Step 5: Commit**

```bash
git add "web/app/(main)/dashboard/page.tsx"
git commit -m "feat(onboarding): gate dashboard sur onboarding_completed_at"
```

---

## Task 5: Page `/onboarding` rend le flow

**Files:**
- Rewrite: `web/app/onboarding/page.tsx`

- [ ] **Step 1: Remplacer le contenu de la page**

```tsx
// web/app/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { MissionSetupFlow } from '@/components/onboarding/mission-setup/MissionSetupFlow'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { strava?: string }
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, onboarding_discipline, onboarding_mission, onboarding_mode, onboarding_data_source')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarding_completed_at) redirect('/dashboard')

  return (
    <MissionSetupFlow
      stravaStatus={searchParams?.strava}
      initialAnswers={{
        discipline: profile?.onboarding_discipline ?? null,
        mission: profile?.onboarding_mission ?? null,
        mode: profile?.onboarding_mode ?? null,
        dataSource: profile?.onboarding_data_source ?? null,
      }}
    />
  )
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: échec attendu ici (`MissionSetupFlow` n'accepte pas encore `stravaStatus`/`initialAnswers`) — corrigé en Task 6. Si tu exécutes les tâches dans l'ordre, enchaîne la Task 6 avant de committer, OU commit après la Task 6. **Ne pas committer un état qui casse `tsc`.**

> Note d'exécution : Tasks 5 et 6 sont couplées par le type des props. Les implémenter ensemble, committer une fois `tsc` vert après la Task 6.

---

## Task 6: Réécrire `MissionSetupFlow` (version production)

**Files:**
- Test: `web/__tests__/onboarding/MissionSetupFlow.test.tsx`
- Rewrite: `web/components/onboarding/mission-setup/MissionSetupFlow.tsx`

- [ ] **Step 1: Écrire le test du composant**

```tsx
// web/__tests__/onboarding/MissionSetupFlow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MissionSetupFlow } from '@/components/onboarding/mission-setup/MissionSetupFlow'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock
})

describe('MissionSetupFlow', () => {
  it('bloque « Continuer » tant qu\'aucune discipline n\'est choisie', () => {
    render(<MissionSetupFlow />)
    // Étape 1 → 2
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    expect(screen.getByRole('button', { name: /continuer/i })).toBeDisabled()
    // Choisir une discipline débloque
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))
    expect(screen.getByRole('button', { name: /continuer/i })).not.toBeDisabled()
  })

  it('persiste chaque réponse au moment de la sélection', async () => {
    render(<MissionSetupFlow />)
    fireEvent.click(screen.getByRole('button', { name: /continuer/i })) // étape 2
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
    })
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.onboarding_discipline).toBe('trail')
  })

  it('affiche l\'erreur Strava, démarre sur l\'étape Données, et la tuile Strava est un lien', () => {
    render(<MissionSetupFlow stravaStatus="already_linked" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/déjà connecté/i)
    expect(screen.getByRole('link', { name: /^strava/i }))
      .toHaveAttribute('href', '/api/strava/connect?from=onboarding')
  })

  it('« Entrer dans le cockpit » complète l\'onboarding et route vers le dashboard', async () => {
    render(<MissionSetupFlow stravaStatus="error" />)
    fireEvent.click(screen.getByRole('button', { name: /lancer le cockpit/i }))
    fireEvent.click(screen.getByRole('button', { name: /entrer dans le cockpit/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
    })
    const calls = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(calls[calls.length - 1][1].body)
    expect(body.onboarding_complete).toBe(true)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })
})
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx jest __tests__/onboarding/MissionSetupFlow.test.tsx`
Expected: FAIL (le composant actuel n'accepte pas `stravaStatus`, n'appelle pas `fetch`, pas de bouton « Entrer dans le cockpit »).

- [ ] **Step 3: Réécrire le composant (fichier complet)**

Remplacer **tout** le contenu de `web/components/onboarding/mission-setup/MissionSetupFlow.tsx` par :

```tsx
'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, Check,
  Mountain, Footprints, Bike, Waves, Medal,
  Activity, TrendingUp, Compass, BarChart3,
  Upload, Watch, Rocket,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// Onboarding « Mission Setup » — écran de production (/onboarding).
// Collecte discipline / mission / mode / source et les persiste dans
// `profiles` (colonnes onboarding_*). Seuls la connexion Strava et le flag
// onboarding_completed_at pilotent le parcours ; les autres réponses sont
// stockées pour usage futur. FR codé en dur (v1).
// ─────────────────────────────────────────────────────────────────────────

type Option = { id: string; label: string; desc: string; icon: typeof Mountain; accent: string }

export type OnboardingAnswers = {
  discipline: string | null
  mission: string | null
  mode: string | null
  dataSource: string | null
}

const DISCIPLINES: Option[] = [
  { id: 'trail',     label: 'Trail',     desc: 'Sentiers & dénivelé',     icon: Mountain,   accent: 'var(--data-run)' },
  { id: 'route',     label: 'Route',     desc: 'Running sur route',        icon: Footprints, accent: 'var(--data-run)' },
  { id: 'velo',      label: 'Vélo',      desc: 'Cyclisme & home-trainer',  icon: Bike,       accent: 'var(--data-bike)' },
  { id: 'triathlon', label: 'Triathlon', desc: 'Multi-discipline',         icon: Medal,      accent: 'var(--primary)' },
  { id: 'natation',  label: 'Natation',  desc: 'Bassin & eau libre',       icon: Waves,      accent: 'var(--data-swim)' },
]

const MISSIONS: Option[] = [
  { id: 'trail',    label: 'Préparer un trail',             desc: 'Objectif daté, plan progressif', icon: Mountain,    accent: 'var(--data-run)' },
  { id: 'marathon', label: 'Préparer un marathon',          desc: 'Route, allure cible',            icon: Footprints,  accent: 'var(--data-run)' },
  { id: 'charge',   label: 'Suivre ma charge',              desc: 'Fatigue, fraîcheur, forme',      icon: Activity,    accent: 'var(--data-charge)' },
  { id: 'libre',    label: 'Progresser sans objectif précis', desc: 'Rester régulier, voir ses tendances', icon: TrendingUp, accent: 'var(--data-bike)' },
]

const MODES: (Option & { points: string[] })[] = [
  { id: 'mission', label: 'Mode Mission', desc: 'Simple, lisible, guidé.',  icon: Compass,   accent: 'var(--primary)',   points: ['Vue épurée', 'Une mission à la fois', 'Conseils guidés'] },
  { id: 'expert',  label: 'Mode Expert',  desc: 'Données complètes.',        icon: BarChart3, accent: 'var(--data-bike)', points: ['Charge & fatigue', 'Graphiques avancés', 'Cockpit complet'] },
]

const TOTAL = 5

function ringStyle(accent: string, extra?: CSSProperties): CSSProperties {
  return { ['--tw-ring-color' as string]: accent, ...extra } as CSSProperties
}

function SelectTile({
  selected, accent, icon: Icon, title, desc, onClick, compact,
}: {
  selected: boolean; accent: string; icon: typeof Mountain
  title: string; desc?: string; onClick: () => void; compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative w-full text-left rounded-xl border bg-ink-700 p-4 cursor-pointer',
        'transition-[border-color,transform,box-shadow] duration-150',
        'hover:-translate-y-0.5 active:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        selected ? 'border-transparent' : 'border-ink-600 hover:border-ink-500',
      )}
      style={
        selected
          ? ringStyle(accent, { borderColor: accent, boxShadow: `0 0 0 1px ${accent}, 0 10px 28px -16px ${accent}` })
          : ringStyle(accent)
      }
    >
      <div className={cn('flex items-center gap-3.5', compact && 'gap-3')}>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
        >
          <Icon size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">{title}</p>
          {desc && <p className="font-body text-[12.5px] text-fg-muted leading-snug mt-0.5">{desc}</p>}
        </div>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-opacity',
            selected ? 'opacity-100' : 'opacity-0',
          )}
          style={{ backgroundColor: accent, borderColor: accent }}
        >
          <Check size={13} className="text-ink-900" strokeWidth={3} />
        </span>
      </div>
    </button>
  )
}

function StepShell({ eyebrow, title, subtitle, children, stepKey }: {
  eyebrow: string; title: string; subtitle?: ReactNode; children: ReactNode; stepKey: number
}) {
  return (
    <div key={stepKey} className="animate-[stepIn_320ms_cubic-bezier(0.32,0.72,0,1)]">
      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-text">{eyebrow}</p>
      <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-fg-primary mt-1.5">{title}</h2>
      {subtitle && <p className="font-body text-[14px] text-fg-muted leading-relaxed mt-2">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function MissionSetupFlow({
  stravaStatus,
  initialAnswers,
}: {
  stravaStatus?: string
  initialAnswers?: OnboardingAnswers
}) {
  const router = useRouter()
  // Retour d'un échec OAuth → on réaffiche directement l'étape Données.
  const [step, setStep] = useState(stravaStatus ? TOTAL : 1)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [discipline, setDiscipline] = useState<string | null>(initialAnswers?.discipline ?? null)
  const [mission, setMission] = useState<string | null>(initialAnswers?.mission ?? null)
  const [mode, setMode] = useState<string | null>(initialAnswers?.mode ?? null)
  const [dataSource, setDataSource] = useState<string | null>(initialAnswers?.dataSource ?? null)

  const errorMsg =
    stravaStatus === 'already_linked' ? 'Ce compte Strava est déjà connecté à un autre compte Trail Cockpit.'
    : stravaStatus === 'error'        ? 'La connexion Strava a échoué. Réessaie.'
    : null

  const canNext =
    step === 1 ? true :
    step === 2 ? !!discipline :
    step === 3 ? !!mission :
    step === 4 ? !!mode :
    true

  function answersPayload(): Record<string, unknown> {
    return {
      onboarding_discipline: discipline,
      onboarding_mission: mission,
      onboarding_mode: mode,
      onboarding_data_source: dataSource,
    }
  }

  async function persist(payload: Record<string, unknown>) {
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // best-effort : on continue le parcours même si la persistance échoue
    }
  }

  // Persistance au fil des sélections : chaque choix est sauvegardé seul, ce
  // qui survit au round-trip OAuth (la tuile Strava est un simple lien, pas
  // de navigation pilotée par JS). Le callback Strava pose data_source='strava'.
  function selectAndPersist(field: string, value: string, set: (v: string) => void) {
    set(value)
    void persist({ [field]: value })
  }

  // Chemin sans Strava : persister les réponses + demander la complétion
  // (le serveur pose onboarding_completed_at), puis dashboard.
  async function finish() {
    setBusy(true)
    await persist({ ...answersPayload(), onboarding_complete: true })
    router.push('/dashboard')
  }

  const disciplineOpt = DISCIPLINES.find(d => d.id === discipline)
  const missionOpt = MISSIONS.find(m => m.id === mission)
  const modeOpt = MODES.find(m => m.id === mode)

  return (
    <main className="min-h-screen bg-ink-900 text-fg-primary flex flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-[14px] font-bold tracking-widest uppercase">
            <span className="text-primary-text">Mission</span>
            <span className="text-fg-primary"> Setup</span>
          </span>
        </div>

        {!done && (
          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL }, (_, i) => (
                <span
                  key={i}
                  className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < step ? 'bg-primary' : 'bg-ink-600')}
                />
              ))}
            </div>
            <p className="font-body text-[11px] text-fg-muted mt-2">Étape {step} sur {TOTAL}</p>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-7">
        {done ? (
          <CompletionScreen discipline={disciplineOpt} mission={missionOpt} mode={modeOpt} busy={busy} onEnter={finish} />
        ) : (
          <div className="flex-1">
            {step === 1 && (
              <StepShell
                stepKey={1}
                eyebrow="Bienvenue"
                title="Bienvenue dans Trail Cockpit"
                subtitle="Le centre de contrôle intelligent des sportifs d'endurance."
              >
                <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
                  <div className="h-28 w-full">
                    <TrajectoryLine orientation="horizontal" animated duration={1.8} />
                  </div>
                  <p className="font-display text-center text-[18px] font-semibold tracking-tight text-fg-primary mt-2">
                    Préparer. <span className="text-primary-text">Piloter.</span> Accomplir.
                  </p>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell stepKey={2} eyebrow="Discipline" title="Choisis ta discipline principale"
                subtitle="Elle colore ton cockpit. Tu pourras en ajouter d'autres ensuite.">
                <div className="grid gap-2.5">
                  {DISCIPLINES.map(d => (
                    <SelectTile key={d.id} icon={d.icon} title={d.label} desc={d.desc} accent={d.accent}
                      selected={discipline === d.id} onClick={() => selectAndPersist('onboarding_discipline', d.id, setDiscipline)} />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell stepKey={3} eyebrow="Mission" title="Définis ta mission"
                subtitle="Quel est ton cap pour les prochaines semaines ?">
                <div className="grid gap-2.5">
                  {MISSIONS.map(m => (
                    <SelectTile key={m.id} icon={m.icon} title={m.label} desc={m.desc} accent={m.accent}
                      selected={mission === m.id} onClick={() => selectAndPersist('onboarding_mission', m.id, setMission)} />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell stepKey={4} eyebrow="Mode" title="Choisis ton mode"
                subtitle="Tu pourras basculer à tout moment.">
                <div className="grid gap-3">
                  {MODES.map(m => {
                    const selected = mode === m.id
                    const Icon = m.icon
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectAndPersist('onboarding_mode', m.id, setMode)}
                        aria-pressed={selected}
                        className={cn(
                          'w-full text-left rounded-xl border bg-ink-700 p-4 cursor-pointer',
                          'transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
                          selected ? 'border-transparent' : 'border-ink-600 hover:border-ink-500',
                        )}
                        style={selected
                          ? ringStyle(m.accent, { borderColor: m.accent, boxShadow: `0 0 0 1px ${m.accent}, 0 10px 28px -16px ${m.accent}` })
                          : ringStyle(m.accent)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `color-mix(in srgb, ${m.accent} 16%, transparent)`, color: m.accent }}>
                            <Icon size={22} />
                          </span>
                          <div className="flex-1">
                            <p className="font-display text-[16px] font-semibold tracking-tight text-fg-primary">{m.label}</p>
                            <p className="font-body text-[12.5px] text-fg-muted">{m.desc}</p>
                          </div>
                          {selected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: m.accent }}>
                              <Check size={13} className="text-ink-900" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5 pl-14">
                          {m.points.map(p => (
                            <span key={p} className="font-body text-[11px] text-fg-secondary rounded-full bg-ink-600/70 px-2 py-0.5">{p}</span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell stepKey={5} eyebrow="Données" title="Connecte tes données"
                subtitle="Synchronise tes activités pour activer le cockpit.">
                {errorMsg && (
                  <p role="alert" className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
                    {errorMsg}
                  </p>
                )}
                <div className="grid gap-2.5">
                  <a
                    href="/api/strava/connect?from=onboarding"
                    className="group flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(252,76,2,0.15)', color: '#FC4C02' }}>
                      <Activity size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Strava</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Recommandé · import automatique</p>
                    </div>
                    <ArrowRight size={18} className="text-fg-muted group-hover:text-fg-primary" />
                  </a>

                  <div className="flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 opacity-60">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-600 text-fg-muted">
                      <Watch size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Garmin</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Bientôt disponible</p>
                    </div>
                    <Badge variant="neutral" size="sm">Bientôt</Badge>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectAndPersist('onboarding_data_source', 'manual', setDataSource)}
                    aria-pressed={dataSource === 'manual'}
                    className={cn(
                      'flex items-center gap-3.5 rounded-xl border bg-ink-700 p-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
                      dataSource === 'manual' ? 'border-primary' : 'border-ink-600',
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-600 text-fg-secondary">
                      <Upload size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Import manuel</p>
                      <p className="font-body text-[12.5px] text-fg-muted">J'ajouterai mes activités plus tard</p>
                    </div>
                    {dataSource === 'manual' && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check size={13} className="text-ink-900" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </div>
              </StepShell>
            )}
          </div>
        )}

        {!done && (
          <nav className="mt-7 flex items-center gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} leadingIcon={<ArrowLeft size={16} />}>
                Retour
              </Button>
            )}
            <div className="flex-1" />
            {step < TOTAL ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext} trailingIcon={<ArrowRight size={16} />}>
                Continuer
              </Button>
            ) : (
              <Button onClick={() => setDone(true)} leadingIcon={<Rocket size={16} />}>
                Lancer le cockpit
              </Button>
            )}
          </nav>
        )}
      </div>
    </main>
  )
}

function CompletionScreen({ discipline, mission, mode, busy, onEnter }: {
  discipline?: Option; mission?: Option; mode?: Option; busy: boolean; onEnter: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-[stepIn_320ms_cubic-bezier(0.32,0.72,0,1)]">
      <div className="h-20 w-full max-w-[220px]">
        <TrajectoryLine orientation="horizontal" animated duration={1.4} progress={1} />
      </div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mt-2">
        <Check size={26} strokeWidth={3} />
      </span>
      <h2 className="font-display text-[24px] font-bold tracking-tight text-fg-primary mt-4">Mission prête</h2>
      <p className="font-body text-[14px] text-fg-muted mt-1.5 max-w-xs">
        Ton cockpit est configuré. Préparer. Piloter. Accomplir.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {discipline && <Badge color={discipline.accent} dot>{discipline.label}</Badge>}
        {mission && <Badge variant="charge" dot>{mission.label}</Badge>}
        {mode && <Badge color={mode.accent} dot>{mode.label}</Badge>}
      </div>

      <div className="mt-7 w-full">
        <Button fullWidth onClick={onEnter} disabled={busy} trailingIcon={<ArrowRight size={16} />}>
          Entrer dans le cockpit
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test du composant → succès attendu**

Run: `npx jest __tests__/onboarding/MissionSetupFlow.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Vérifier types + lint (Tasks 5 + 6 ensemble)**

Run: `npx tsc --noEmit && npx eslint app/onboarding/page.tsx components/onboarding/mission-setup/MissionSetupFlow.tsx`
Expected: aucune erreur.

- [ ] **Step 6: Commit (Tasks 5 + 6)**

```bash
git add web/app/onboarding/page.tsx web/components/onboarding/mission-setup/MissionSetupFlow.tsx web/__tests__/onboarding/MissionSetupFlow.test.tsx
git commit -m "feat(onboarding): MissionSetupFlow en production avec persistance + complétion"
```

---

## Task 7: Nettoyage (preview + OnboardingStrava)

**Files:**
- Delete: `web/app/onboarding-preview/page.tsx`
- Delete: `web/components/onboarding/OnboardingStrava.tsx`
- Delete: `web/__tests__/onboarding/OnboardingStrava.test.tsx`

- [ ] **Step 1: Supprimer les fichiers obsolètes**

```bash
git rm web/app/onboarding-preview/page.tsx web/components/onboarding/OnboardingStrava.tsx web/__tests__/onboarding/OnboardingStrava.test.tsx
```

Si le dossier `web/app/onboarding-preview/` reste vide, le supprimer aussi.

- [ ] **Step 2: Vérifier qu'aucune référence ne subsiste**

Run (depuis `web/`): `npx tsc --noEmit`
Expected: aucune erreur (aucun import résiduel de `OnboardingStrava` ni de la route preview).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(onboarding): retire la preview et l'ancien OnboardingStrava"
```

---

## Task 8: Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1: Suite de tests complète**

Run (depuis `web/`): `npx jest`
Expected: tous les tests passent (dont `onboarding-completion`, `MissionSetupFlow`).

- [ ] **Step 2: Types + lint global**

Run (depuis `web/`): `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3: Rappels (NE PAS automatiser)**

Annoncer à Franck :
1. **Migration Supabase** : coller `web/supabase/migrations/033_profile_onboarding_answers.sql` dans le Supabase SQL Editor (sinon les lectures/écritures `onboarding_*` échouent en prod). Le déploiement code **ne doit pas** précéder l'application de la migration.
2. **Déploiement** : push de la branche `feat/onboarding-mission-setup` → ouvrir une PR vers `master` (Vercel auto-deploy au merge). Ne pas `vercel --prod`.
3. Mettre à jour le bandeau `Status: Implémenté` dans la spec une fois mergé.

---

## Self-Review (à exécuter mentalement avant de coder)

- **Couverture spec :** migration 033 (Task 1) ✓ ; persistance colonnes + complétion serveur (Task 2) ✓ ; callback pose completed_at (Task 3) ✓ ; gate dashboard + page onboarding (Tasks 4, 5) ✓ ; ré-hydratation `initialAnswers` + affichage erreur (Tasks 5, 6) ✓ ; nettoyage preview/OnboardingStrava (Task 7) ✓ ; tests proportionnés (Tasks 2, 6) ✓. Le bug « slash » de la spec initiale a été retiré (faux positif — la source est correcte).
- **Cohérence des types :** `OnboardingAnswers` (Task 6) consommé par `page.tsx` (Task 5) avec les mêmes clés `discipline/mission/mode/dataSource`. Payload PATCH (`onboarding_discipline/mission/mode/data_source` + `onboarding_complete`) ↔ allowlist route + helper (Task 2) cohérents. `onboarding_completed_at` : posé par le helper (Task 2), le callback (Task 3) ; lu par le gate (Tasks 4, 5).
- **Pas de placeholder :** chaque step contient le code/commande exacts.
