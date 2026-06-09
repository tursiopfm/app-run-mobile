# Partage public des activités — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'URL canonique `/activities/<uuid>` accessible en lecture seule sans compte Trailcockpit, tout en préservant l'expérience propriétaire (édition + nav shell).

**Architecture:** Sortir la page détail du groupe gated `(main)` vers un groupe `(public)` dont le layout ne force pas le login. Un fetch service-role (`getPublicActivity`) lit l'activité par UUID en bypass RLS. La page calcule `isOwner` ; le propriétaire garde l'édition + le refresh Strava, le visiteur reçoit `readOnly`. Aucun appel Strava pour un visiteur. Page non indexée (`noindex`).

**Tech Stack:** Next.js 14 App Router (Server Components), TypeScript, Supabase (`@supabase/ssr`, service-role), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-09-public-activity-sharing-design.md`

**Raffinement vs spec (§4) :** les popups info effort/intensité/type (`ActivityPopups.tsx`) n'écrivent rien (aucun `supabase`/`fetch`/`update`) → ils restent **actifs** en lecture seule (explication utile, inoffensive). Seuls le bouton Modifier + `EditActivityModal` sont neutralisés par `readOnly`.

**Notes environnement (mémoire projet) :**
- Lancer jest/tsc/lint en se plaçant dans `web/` avec un chemin absolu : `cd c:\Users\Franc\app-run-mobile\web` puis la commande.
- `next build` local échoue si un `next dev` tourne (conflit `.next`). La vérif autoritaire est tsc + eslint + Vercel. Le build local sert surtout à valider l'absence de conflit de routes.
- ~50 tests jest échouent en pré-existant (`useI18n` hors provider) → lancer **seulement** les suites de ce plan.

---

## Structure de fichiers

| Fichier | Rôle |
|---|---|
| `web/lib/data/public-activity.ts` | **Créé.** Fetch service-role d'une activité par UUID (+ profil FC owner, splits/laps depuis `raw_payload`, courbe FC). Aucun appel Strava. |
| `web/__tests__/data/public-activity.test.ts` | **Créé.** Tests unitaires de `getPublicActivity`. |
| `web/app/(public)/activities/[id]/page.tsx` | **Déplacé depuis `(main)` puis réécrit.** Server component : `getPublicActivity` → `isOwner` → branche owner (refresh Strava) / visiteur (`readOnly`). `generateMetadata` noindex. |
| `web/app/(public)/activities/[id]/ActivityDetailClient.tsx` | **Déplacé depuis `(main)` puis modifié.** Nouveau prop `readOnly`. |
| `web/app/(public)/layout.tsx` | **Créé.** Connecté → `AppShell` (parité `(main)`) ; anonyme → chrome minimal + CTA inscription. |
| `web/__tests__/activities/ActivityDetailReadOnly.test.tsx` | **Créé.** Test composant : `readOnly` masque le bouton Modifier. |

Inchangés : `middleware.ts` (ne redirige que `/admin`), `(main)/activities/page.tsx` (liste, reste gated), `ActivityPopups.tsx`, `lib/database/supabase-server.ts`.

---

## Task 1 : Fetcher service-role `getPublicActivity`

**Files:**
- Create: `web/lib/data/public-activity.ts`
- Test: `web/__tests__/data/public-activity.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `web/__tests__/data/public-activity.test.ts` :

```ts
import { getPublicActivity } from '@/lib/data/public-activity'
import { createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({
  createServiceClient: jest.fn(),
}))

type Result = { data: unknown; error: unknown }

function builder(result: Result) {
  const b: Record<string, jest.Mock> = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    is: jest.fn(() => b),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  }
  return b
}

function mockClient(byTable: Record<string, ReturnType<typeof builder>>) {
  return {
    from: jest.fn((t: string) => byTable[t] ?? builder({ data: null, error: null })),
  }
}

const ACTIVITY_ROW = {
  id: 'abc', user_id: 'owner-1', sport_type: 'Run', manual_sport_type: null,
  name: 'Sortie matinale', start_time: '2026-06-01T07:00:00Z', ces: 90,
  manual_intensity: null, manual_workout_type: null, distance_m: 10000,
  manual_distance_m: null, elevation_gain_m: 200, manual_elevation_gain_m: null,
  moving_time_sec: 3000, manual_moving_time_sec: null, duration_sec: 3100,
  avg_hr: null, max_hr: null, calories: 500, raw_payload: {},
  provider: 'manual', provider_activity_id: null,
}

describe('getPublicActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retourne activity + ownerId quelle que soit la session (bypass RLS)', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({ data: ACTIVITY_ROW, error: null }),
      profiles: builder({ data: { max_hr: 190 }, error: null }),
    }))
    const res = await getPublicActivity('abc')
    expect(res).not.toBeNull()
    expect(res!.ownerId).toBe('owner-1')
    expect(res!.activity.name).toBe('Sortie matinale')
    // user_id ne doit pas fuiter dans l'objet activity passé au client
    expect((res!.activity as Record<string, unknown>).user_id).toBeUndefined()
  })

  it('retourne null si l\'activité est absente ou supprimée', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({ data: null, error: null }),
    }))
    const res = await getPublicActivity('inconnue')
    expect(res).toBeNull()
  })

  it('expose splits/laps présents dans raw_payload sans appeler Strava', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({
        data: { ...ACTIVITY_ROW, raw_payload: { splits_metric: [{ distance: 1000 }], laps: [{}, {}] } },
        error: null,
      }),
      profiles: builder({ data: null, error: null }),
    }))
    const res = await getPublicActivity('abc')
    expect(res!.splits).toHaveLength(1)
    expect(res!.laps).toHaveLength(2)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```
cd c:\Users\Franc\app-run-mobile\web
npx jest __tests__/data/public-activity.test.ts
```
Attendu : FAIL — `Cannot find module '@/lib/data/public-activity'`.

- [ ] **Step 3 : Implémenter `getPublicActivity`**

Créer `web/lib/data/public-activity.ts` :

```ts
import { cache } from 'react'
import { createServiceClient } from '@/lib/database/supabase-server'
import { unpackStreams } from '@/lib/providers/strava/streams'
import type { ActivityDetail } from '@/app/(public)/activities/[id]/ActivityDetailClient'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'

export type PublicAthleteProfile = {
  max_hr: number | null
  resting_hr: number | null
  aerobic_threshold_hr: number | null
  threshold_hr: number | null
  birth_year: number | null
  hr_zone_method: string | null
  hr_zones_custom: unknown
}

export type PublicActivity = {
  activity: ActivityDetail
  ownerId: string
  splits: StravaSplit[] | null
  laps: StravaLap[] | null
  athleteProfile: PublicAthleteProfile | null
  hrStream: { heartrate: number[]; time: number[] } | null
}

const ACTIVITY_COLS =
  'id, user_id, sport_type, manual_sport_type, name, start_time, ces, manual_intensity, manual_workout_type, distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m, moving_time_sec, manual_moving_time_sec, duration_sec, avg_hr, max_hr, calories, raw_payload, provider, provider_activity_id'

// Cache par requête (React cache) : metadata + page partagent un seul fetch.
export const getPublicActivity = cache(async (id: string): Promise<PublicActivity | null> => {
  const supabase = createServiceClient()

  const { data: row } = await supabase
    .from('activities')
    .select(ACTIVITY_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) return null

  const { user_id: ownerId, ...rest } = row as Record<string, unknown> & { user_id: string }
  const activity = rest as unknown as ActivityDetail

  // splits / laps : uniquement depuis raw_payload (jamais d'appel Strava ici)
  const rawPayload = (activity.raw_payload ?? null) as Record<string, unknown> | null
  const rawSplits = rawPayload?.splits_metric
  const rawLaps = rawPayload?.laps
  const splits = Array.isArray(rawSplits) ? (rawSplits as unknown as StravaSplit[]) : null
  const laps = Array.isArray(rawLaps) ? (rawLaps as unknown as StravaLap[]) : null

  // Profil FC du propriétaire (zones FC)
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
    .eq('id', ownerId)
    .maybeSingle()

  // Courbe FC (seulement si l'activité a une FC)
  let hrStream: { heartrate: number[]; time: number[] } | null = null
  if (activity.avg_hr) {
    const { data: streamRow } = await supabase
      .from('activity_streams')
      .select('streams_gz')
      .eq('activity_id', id)
      .maybeSingle()
    if (streamRow?.streams_gz) {
      try {
        const s = unpackStreams(String(streamRow.streams_gz))
        if (s.heartrate?.length && s.time?.length) hrStream = { heartrate: s.heartrate, time: s.time }
      } catch { /* stream corrompu → fallback estimation côté client */ }
    }
  }

  return {
    activity,
    ownerId,
    splits,
    laps,
    athleteProfile: (profile ?? null) as PublicAthleteProfile | null,
    hrStream,
  }
})
```

> NB : l'import `type { ActivityDetail }` pointe vers le **nouvel** emplacement créé en Task 2. Cette tâche se compile seulement une fois la Task 2 faite ; lancer la vérif tsc globale en Task 5. Le test jest de cette tâche n'importe pas le type (mock), il passe indépendamment.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

```
cd c:\Users\Franc\app-run-mobile\web
npx jest __tests__/data/public-activity.test.ts
```
Attendu : PASS (3 tests).

- [ ] **Step 5 : Commit**

```
git -C c:\Users\Franc\app-run-mobile add web/lib/data/public-activity.ts web/__tests__/data/public-activity.test.ts
git -C c:\Users\Franc\app-run-mobile commit -m "feat(activities): fetch service-role getPublicActivity (lecture publique par UUID)"
```

---

## Task 2 : Déplacer la route vers `(public)` + layout

**Files:**
- Move: `web/app/(main)/activities/[id]/page.tsx` → `web/app/(public)/activities/[id]/page.tsx`
- Move: `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` → `web/app/(public)/activities/[id]/ActivityDetailClient.tsx`
- Create: `web/app/(public)/layout.tsx`

- [ ] **Step 1 : Créer le dossier cible et déplacer les fichiers (git mv)**

```
cd c:\Users\Franc\app-run-mobile
New-Item -ItemType Directory -Force "web/app/(public)/activities/[id]" | Out-Null
git mv "web/app/(main)/activities/[id]/page.tsx" "web/app/(public)/activities/[id]/page.tsx"
git mv "web/app/(main)/activities/[id]/ActivityDetailClient.tsx" "web/app/(public)/activities/[id]/ActivityDetailClient.tsx"
```

- [ ] **Step 2 : Vérifier qu'aucun autre fichier n'importe l'ancien chemin**

```
cd c:\Users\Franc\app-run-mobile\web
```
Puis (outil Grep) chercher `(main)/activities/[id]` et `activities/[id]/ActivityDetailClient` dans `web/`.
Attendu : seules des références internes (la nouvelle `page.tsx` importe `./ActivityDetailClient`, relatif → OK). Aucun import absolu vers l'ancien chemin `(main)`. Si un fichier référence l'ancien chemin, le corriger vers `@/app/(public)/activities/[id]/ActivityDetailClient`.

- [ ] **Step 3 : Créer le layout `(public)`**

Créer `web/app/(public)/layout.tsx` :

```tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { getServerUser } from '@/lib/database/get-user'
import { AppShell } from '@/components/navigation/AppShell'
import { ImportProgressBanner } from '@/components/ui/ImportProgressBanner'
import { WhatsNewModal } from '@/components/ui/WhatsNewModal'
import { PreferencesProvider } from '@/lib/preferences/PreferencesProvider'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()

  // Connecté → expérience app complète (parité avec le layout (main)).
  if (user) {
    return (
      <PreferencesProvider>
        <ImportProgressBanner />
        <AppShell>{children}</AppShell>
        <WhatsNewModal />
      </PreferencesProvider>
    )
  }

  // Visiteur anonyme → chrome minimal + CTA inscription (PreferencesProvider no-op sans user).
  return (
    <PreferencesProvider>
      <div className="min-h-screen flex flex-col bg-trail-bg">
        <header
          className="sticky top-0 z-40 bg-trail-header border-b border-trail-border px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Link href="/" className="text-base font-bold tracking-widest uppercase font-display">
              <span className="text-trail-primary">Trail</span>
              <span className="text-trail-text"> Cockpit</span>
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-trail-primary border border-trail-primary/40 rounded-full px-3 py-1"
            >
              Créer un compte
            </Link>
          </div>
        </header>

        <div className="flex-1 min-w-0">{children}</div>

        <div
          className="sticky bottom-0 z-40 bg-trail-header border-t border-trail-border px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-trail-muted">Créé sur Trail Cockpit</span>
            <Link
              href="/signup"
              className="text-sm font-semibold rounded-full px-4 py-2 bg-trail-primary text-white"
            >
              Découvrir
            </Link>
          </div>
        </div>
      </div>
    </PreferencesProvider>
  )
}
```

- [ ] **Step 4 : Vérifier l'absence de conflit de routes**

État intermédiaire attendu : `page.tsx` est inchangée (elle contient encore son propre `redirect('/login')`), donc l'accès anonyme reste bloqué pour l'instant — c'est normal, on l'ouvre en Task 4. On valide ici uniquement le routing.

```
cd c:\Users\Franc\app-run-mobile\web
npx tsc --noEmit
```
Attendu : pas d'erreur. Puis vérifier le routing (si aucun `next dev` ne tourne) :
```
cd c:\Users\Franc\app-run-mobile\web
npm run build
```
Attendu : build OK, routes `/activities` (liste, `(main)`) **et** `/activities/[id]` (détail, `(public)`) présentes, **aucune** erreur « two parallel pages resolve to the same path ». Si `next dev` tourne et bloque le build, s'appuyer sur tsc + le déploiement Vercel ; ces chemins résolus diffèrent (`/activities` ≠ `/activities/[id]`) donc aucun conflit attendu.

- [ ] **Step 5 : Commit**

```
git -C c:\Users\Franc\app-run-mobile add -A web/app
git -C c:\Users\Franc\app-run-mobile commit -m "refactor(activities): déplacer le détail dans le groupe (public) + layout non gated"
```

---

## Task 3 : Prop `readOnly` sur `ActivityDetailClient`

**Files:**
- Modify: `web/app/(public)/activities/[id]/ActivityDetailClient.tsx`
- Test: `web/__tests__/activities/ActivityDetailReadOnly.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `web/__tests__/activities/ActivityDetailReadOnly.test.tsx` :

```tsx
import { render } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ActivityDetailClient, type ActivityDetail } from '@/app/(public)/activities/[id]/ActivityDetailClient'

jest.mock('next/dynamic', () => ({ __esModule: true, default: () => () => null }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}))

const ACTIVITY: ActivityDetail = {
  id: 'abc', sport_type: 'Run', manual_sport_type: null, name: 'Sortie',
  start_time: '2026-06-01T07:00:00Z', ces: 90, manual_intensity: null,
  manual_workout_type: null, distance_m: 10000, manual_distance_m: null,
  elevation_gain_m: 200, manual_elevation_gain_m: null, moving_time_sec: 3000,
  manual_moving_time_sec: null, duration_sec: 3100, avg_hr: null, max_hr: null,
  calories: 500, raw_payload: {}, provider: 'manual', provider_activity_id: null,
}

const PROFILE = {
  max_hr: 190, resting_hr: 50, aerobic_threshold_hr: null, threshold_hr: 170,
  birth_year: 1985, hr_zone_method: 'pct_max', hr_zones_custom: null,
}

function renderClient(readOnly: boolean) {
  return render(
    <I18nProvider initialLang="fr">
      <ActivityDetailClient
        activity={ACTIVITY}
        splits={null}
        laps={null}
        athleteProfile={PROFILE}
        hrStream={null}
        readOnly={readOnly}
      />
    </I18nProvider>
  )
}

describe('ActivityDetailClient readOnly', () => {
  it('masque le bouton Modifier en lecture seule', () => {
    const { queryByTestId } = renderClient(true)
    expect(queryByTestId('edit-activity-btn')).toBeNull()
  })

  it('affiche le bouton Modifier pour le propriétaire', () => {
    const { queryByTestId } = renderClient(false)
    expect(queryByTestId('edit-activity-btn')).not.toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```
cd c:\Users\Franc\app-run-mobile\web
npx jest __tests__/activities/ActivityDetailReadOnly.test.tsx
```
Attendu : FAIL — le bouton Modifier s'affiche dans les deux cas (prop `readOnly` pas encore géré / `data-testid` absent), donc le 1er test échoue.

- [ ] **Step 3 : Ajouter le prop `readOnly` à la signature**

Dans `web/app/(public)/activities/[id]/ActivityDetailClient.tsx`, la destructuration des props (vers la ligne 226-238) :

Remplacer :
```tsx
  athleteProfile,
  hrStream,
}: {
  activity:       ActivityDetail
  splits:         StravaSplit[] | null
  laps:           StravaLap[] | null
  athleteProfile: AthleteHrProfile
  hrStream?:      { heartrate: number[]; time: number[] } | null
}) {
```
par :
```tsx
  athleteProfile,
  hrStream,
  readOnly = false,
}: {
  activity:       ActivityDetail
  splits:         StravaSplit[] | null
  laps:           StravaLap[] | null
  athleteProfile: AthleteHrProfile
  hrStream?:      { heartrate: number[]; time: number[] } | null
  readOnly?:      boolean
}) {
```

- [ ] **Step 4 : Bouton Retour → accueil en lecture seule**

Remplacer (ligne ~342) :
```tsx
        <button
          onClick={() => router.back()}
```
par :
```tsx
        <button
          onClick={() => (readOnly ? router.push('/') : router.back())}
```

- [ ] **Step 5 : Masquer le bouton Modifier en lecture seule + `data-testid`**

Remplacer le bloc bouton Modifier (lignes ~357-373) :
```tsx
        {/* Edit button */}
        <button
          onClick={() => setShowEdit(true)}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 9999,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(232,101,26,0.28)', backdropFilter: 'blur(14px)',
            border: '2px solid rgba(232,101,26,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
```
par (ajout du garde `{!readOnly && (...)}` et de `data-testid`) :
```tsx
        {/* Edit button — propriétaire uniquement */}
        {!readOnly && (
          <button
            data-testid="edit-activity-btn"
            onClick={() => setShowEdit(true)}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 9999,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(232,101,26,0.28)', backdropFilter: 'blur(14px)',
              border: '2px solid rgba(232,101,26,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
```

- [ ] **Step 6 : Ne jamais monter `EditActivityModal` en lecture seule**

Remplacer (ligne ~565) :
```tsx
      {/* Edit modal */}
      {showEdit && (
```
par :
```tsx
      {/* Edit modal — propriétaire uniquement */}
      {!readOnly && showEdit && (
```

- [ ] **Step 7 : Lancer le test, vérifier le succès**

```
cd c:\Users\Franc\app-run-mobile\web
npx jest __tests__/activities/ActivityDetailReadOnly.test.tsx
```
Attendu : PASS (2 tests).

- [ ] **Step 8 : Commit**

```
git -C c:\Users\Franc\app-run-mobile add "web/app/(public)/activities/[id]/ActivityDetailClient.tsx" web/__tests__/activities/ActivityDetailReadOnly.test.tsx
git -C c:\Users\Franc\app-run-mobile commit -m "feat(activities): mode lecture seule (readOnly) sur ActivityDetailClient"
```

---

## Task 4 : Réécrire `page.tsx` (accès public + owner branch + noindex)

**Files:**
- Modify (réécriture complète) : `web/app/(public)/activities/[id]/page.tsx`

- [ ] **Step 1 : Réécrire la page**

Remplacer **tout** le contenu de `web/app/(public)/activities/[id]/page.tsx` par :

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { getPublicActivity } from '@/lib/data/public-activity'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { ActivityDetailClient } from './ActivityDetailClient'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getPublicActivity(id)
  const name = data?.activity.name
  return {
    title: name ? `${name} — Trail Cockpit` : 'Activité — Trail Cockpit',
    // « Non répertorié » : accessible par lien, mais pas indexé.
    robots: { index: false, follow: false },
    ...(name ? { openGraph: { title: name } } : {}),
  }
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPublicActivity(id)
  if (!data) notFound()

  const user = await getServerUser()
  const isOwner = !!user && user.id === data.ownerId

  let activity = data.activity
  let splits = data.splits
  let laps = data.laps

  // Enrichissement Strava (splits/laps/calories) RÉSERVÉ au propriétaire :
  // utilise son propre token. Jamais d'appel Strava pour un visiteur.
  if (isOwner && (!splits || !laps) && activity.provider === 'strava' && activity.provider_activity_id) {
    try {
      const token = await getValidStravaToken(user!.id)
      const detail = await fetchStravaActivity(token, Number(activity.provider_activity_id))
      const stravaDetail = detail as unknown as {
        splits_metric?: unknown[]
        laps?: unknown[]
        calories?: number
      }
      const supabase = await createClient()
      const rawPayload = (activity.raw_payload ?? {}) as Record<string, unknown>

      if (activity.calories == null && stravaDetail.calories != null) {
        await supabase
          .from('activities')
          .update({ calories: stravaDetail.calories })
          .eq('id', id)
          .eq('user_id', user!.id)
        activity = { ...activity, calories: stravaDetail.calories }
      }

      const payloadPatch: Record<string, unknown> = {}
      if (!splits && Array.isArray(stravaDetail.splits_metric)) {
        splits = stravaDetail.splits_metric as unknown as StravaSplit[]
        payloadPatch.splits_metric = stravaDetail.splits_metric
      }
      if (!laps && Array.isArray(stravaDetail.laps)) {
        laps = stravaDetail.laps as unknown as StravaLap[]
        payloadPatch.laps = stravaDetail.laps
      } else if (!laps) {
        laps = []
        payloadPatch.laps = []
      }

      if (Object.keys(payloadPatch).length > 0) {
        await supabase
          .from('activities')
          .update({ raw_payload: { ...rawPayload, ...payloadPatch } })
          .eq('id', id)
          .eq('user_id', user!.id)
      }
    } catch {
      // Token expiré ou rate limité — afficher la page sans splits/laps.
    }
  }

  return (
    <ActivityDetailClient
      activity={activity}
      splits={splits}
      laps={laps}
      athleteProfile={data.athleteProfile}
      hrStream={data.hrStream}
      readOnly={!isOwner}
    />
  )
}
```

- [ ] **Step 2 : Vérifier le typage**

```
cd c:\Users\Franc\app-run-mobile\web
npx tsc --noEmit
```
Attendu : pas d'erreur. (Si `athleteProfile` provoque une incompatibilité de type, vérifier que `PublicAthleteProfile` couvre les champs du type local `AthleteHrProfile` de `ActivityDetailClient` — ils sont optionnels, donc compatibles.)

- [ ] **Step 3 : Commit**

```
git -C c:\Users\Franc\app-run-mobile add "web/app/(public)/activities/[id]/page.tsx"
git -C c:\Users\Franc\app-run-mobile commit -m "feat(activities): page détail publique (lecture seule anonyme, refresh Strava owner, noindex)"
```

---

## Task 5 : Vérification finale

**Files:** aucun (vérif).

- [ ] **Step 1 : tsc + lint**

```
cd c:\Users\Franc\app-run-mobile\web
npx tsc --noEmit
npm run lint
```
Attendu : 0 erreur tsc ; lint sans nouvelle erreur sur les fichiers touchés.

- [ ] **Step 2 : Suites jest du plan**

```
cd c:\Users\Franc\app-run-mobile\web
npx jest __tests__/data/public-activity.test.ts __tests__/activities/ActivityDetailReadOnly.test.tsx
```
Attendu : PASS (5 tests). Ne pas lancer toute la suite (échecs i18n pré-existants).

- [ ] **Step 3 : Build / routes (si aucun `next dev` ne tourne)**

```
cd c:\Users\Franc\app-run-mobile\web
npm run build
```
Attendu : build OK, pas d'erreur de conflit de routes ; `/activities` et `/activities/[id]` présents. Si bloqué par un `next dev`, s'appuyer sur tsc + Vercel.

- [ ] **Step 4 : Smoke test manuel**

Démarrer `npm run dev` puis vérifier sur une activité réelle (ex. `/activities/8ba44ada-67c8-48b4-9f7f-40de521c29b9`) :
- **Navigation privée (déconnecté)** : la page s'affiche en lecture seule — pas de bouton Modifier, header minimal + CTA « Créer un compte » visibles, bouton Retour → accueil. Aucune redirection vers `/login`.
- **Connecté en tant que propriétaire** : bouton Modifier présent, nav `AppShell` (barre du bas) présente, édition fonctionnelle.
- **Connecté NON-propriétaire** (autre compte) : page en lecture seule, pas de bouton Modifier, AppShell présent (il a un compte).

- [ ] **Step 5 : Mettre à jour le bandeau Status de la spec**

Dans `docs/superpowers/specs/2026-06-09-public-activity-sharing-design.md`, remplacer la ligne :
```
> **Status: Spec** · 2026-06-09
```
par :
```
> **Status: Implémenté** · 2026-06-09 · Code: web/app/(public)/activities/[id]/, web/lib/data/public-activity.ts
```

- [ ] **Step 6 : Commit final**

```
git -C c:\Users\Franc\app-run-mobile add docs/superpowers/specs/2026-06-09-public-activity-sharing-design.md
git -C c:\Users\Franc\app-run-mobile commit -m "docs(spec): partage public des activités — Implémenté"
```

---

## Self-review (couverture spec)

- **§Routing** → Task 2 (déplacement `(public)` + layout owner/anonyme). ✓
- **§Data layer `getPublicActivity`** → Task 1 (service-role, profil owner, splits/laps raw_payload, courbe FC, pas d'appel Strava). ✓
- **§Page (server component)** → Task 4 (`isOwner`, branche owner refresh Strava, `readOnly={!isOwner}`). ✓
- **§Lecture seule** → Task 3 (`readOnly` masque Modifier + EditModal, Retour→accueil ; popups info conservés, cf. raffinement). ✓
- **§Sécurité & SEO** → Task 4 (`noindex`, OG title, pas de Strava pour visiteur) + Task 1 (`user_id` non exposé dans `activity`). ✓
- **§Tests** → Task 1 + Task 3. ✓
- **§Hors périmètre** (toggle is_public, RLS) → non touché. ✓

Cohérence des types : `getPublicActivity` renvoie `PublicActivity.activity: ActivityDetail` (importé du client) ; `page.tsx` passe `readOnly`, `athleteProfile: PublicAthleteProfile` (structurellement compatible avec `AthleteHrProfile` local, champs optionnels). `getPublicActivity` est appelé identiquement dans `generateMetadata` et la page (mémoïsé via `cache`).
```
