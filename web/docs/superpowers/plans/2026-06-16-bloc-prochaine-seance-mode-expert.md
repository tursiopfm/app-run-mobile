# Bloc « Ta prochaine séance » dans le mode expert — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer le bloc héros « Ta prochaine séance » (aujourd'hui réservé au mode mission) dans le mode expert de l'onglet Plan, comme bloc `BlockGrid` déplaçable et masquable, visible par défaut en première position.

**Architecture:** Approche A (extraction propre). La logique du héros est sortie de `MissionPlan.tsx` dans un hook partagé `useTodaySession`, consommé par `MissionPlan` (qui garde son fil « Ma semaine ») et par un nouveau `ProchaineSeanceBlock`. Le menu kebab « Masquer » est extrait de `BlockCard` dans un `BlockMenu` réutilisable, et `PlanHeroCard` gagne un prop optionnel `onHide`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Jest + Testing Library, `@dnd-kit` (via `BlockGrid`).

Spec : `docs/superpowers/specs/2026-06-16-bloc-prochaine-seance-mode-expert-design.md`

**Commandes** (toujours depuis `web/`, cf. [feedback_run_web_tooling_cwd]) :
- typecheck : `npx tsc --noEmit`
- lint : `npm run lint`
- test ciblé : `npx jest <chemin>`

---

### Task 1 : Clé i18n `blockProchaineSeance`

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts:545-546` (type) et `:2430` (valeurs)
- Modify: `web/lib/i18n/dictionaries/en.ts:1225` (valeurs)

- [ ] **Step 1 : Ajouter la clé au type**

Dans `web/lib/i18n/dictionaries/fr.ts`, le bloc d'interface lignes 545-546 :

```ts
    blockObjectif: string; blockResume: string; blockCycle: string
    blockCalendar: string; blockWeekLibrary: string; blockCharge: string
    blockProchaineSeance: string
```

- [ ] **Step 2 : Ajouter la valeur fr**

Dans `web/lib/i18n/dictionaries/fr.ts`, après la ligne 2430 (`blockObjectif:`) :

```ts
    blockObjectif:        'Objectif course',
    blockProchaineSeance: 'Prochaine séance',
```

- [ ] **Step 3 : Ajouter la valeur en**

Dans `web/lib/i18n/dictionaries/en.ts`, après la ligne 1225 (`blockObjectif:`) :

```ts
    blockObjectif:        'Race goal',
    blockProchaineSeance: 'Next session',
```

- [ ] **Step 4 : Vérifier la compilation des types**

Run: `npx tsc --noEmit`
Expected: aucune erreur (les deux dictionnaires implémentent le même type, donc une clé manquante dans l'un échouerait).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "i18n(plan): libellé du bloc « Prochaine séance »"
```

---

### Task 2 : Extraire le menu kebab dans `BlockMenu`

Refactor pur (aucun changement de comportement). Pas de test existant pour `BlockCard` → garde-fou = typecheck + lint + relecture.

**Files:**
- Create: `web/components/blocks/BlockMenu.tsx`
- Modify: `web/components/blocks/BlockCard.tsx`

- [ ] **Step 1 : Créer `BlockMenu.tsx`**

Contenu complet (logique extraite verbatim de `BlockCard`, lignes 20-64) :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

// Menu kebab « ⋮ » → « Masquer ». Extrait de BlockCard pour être réutilisé
// par les blocs qui ne passent pas par BlockCard (ex. PlanHeroCard).
export function BlockMenu({ onHide, className }: { onHide: () => void; className?: string }) {
  const C = useT().common
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handle(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [showMenu])

  return (
    <div className={`relative ${className ?? ''}`} ref={menuRef}>
      <button
        aria-label={C.blockMenuAria}
        onClick={() => setShowMenu(s => !s)}
        className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-h2 leading-none"
      >⋮</button>
      {showMenu && (
        <div className="absolute right-0 mt-1 w-32 rounded-[8px] bg-trail-surface border border-trail-border shadow-lg z-30">
          <button
            onClick={() => { setShowMenu(false); onHide() }}
            className="w-full px-3 py-2 text-left text-caption text-trail-text hover:bg-trail-card"
          >{C.blockHide}</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Remplacer le menu inline dans `BlockCard.tsx`**

Dans `web/components/blocks/BlockCard.tsx` :

1. Ajouter l'import en tête : `import { BlockMenu } from './BlockMenu'`
2. Supprimer les états/ref/effet du menu désormais inutiles : `showMenu`, `setShowMenu`, `menuRef`, et le `useEffect` de clic-extérieur (lignes 21-37). Conserver `showHelp`.
3. Retirer `useEffect`/`useRef` de l'import React s'ils ne sont plus utilisés ailleurs (ils ne le sont plus après suppression). Garder `useState`, `type ReactNode`.
4. Remplacer le bloc `<div className="relative" ref={menuRef}> … </div>` (lignes 50-64) par :

```tsx
          <BlockMenu onHide={hideSelf} />
```

Le résultat conserve `rightSlot`, le bouton aide `ⓘ`, et `hideSelf` issu de `useBlockContext()`.

- [ ] **Step 3 : Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur, aucune variable orpheline (`showMenu`, `menuRef`).

- [ ] **Step 4 : Commit**

```bash
git add web/components/blocks/BlockMenu.tsx web/components/blocks/BlockCard.tsx
git commit -m "refactor(blocks): extraire le menu kebab dans BlockMenu"
```

---

### Task 3 : `PlanHeroCard` — exporter le type + prop `onHide`

**Files:**
- Modify: `web/components/mission/PlanHeroCard.tsx`

- [ ] **Step 1 : Exporter le type des props**

Dans `web/components/mission/PlanHeroCard.tsx`, ligne 156, remplacer `type Props =` par `export type Props =` (le reste de l'union active|done|rest inchangé).

- [ ] **Step 2 : Ajouter `onHide` à la signature**

Ligne 178, remplacer :

```tsx
export function PlanHeroCard(props: Props) {
```

par :

```tsx
export function PlanHeroCard(props: Props & { onHide?: () => void }) {
```

Et ajouter l'import en tête : `import { BlockMenu } from '@/components/blocks/BlockMenu'`

- [ ] **Step 3 : Afficher le kebab — état `active`**

Dans l'en-tête de l'état `active` (lignes 200-213), remplacer le `<span>` du badge par un cluster contenant badge + kebab :

```tsx
        {/* en-tête : label + badge (+ kebab en mode expert) */}
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-bold"
            style={{ color: 'var(--primary-text)' }}
          >
            {M.heroNextTitle}
          </p>
          <div className="flex items-center gap-1">
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'var(--ink-800)', color: 'var(--text-secondary)' }}
            >
              {M.heroTodayBadge}
            </span>
            {props.onHide && <BlockMenu onHide={props.onHide} className="-mr-1" />}
          </div>
        </div>
```

- [ ] **Step 4 : Afficher le kebab — états `done` et `rest`**

Ces deux états n'ont pas de cluster d'en-tête. Ajouter `relative` à leur `<div>` racine (la carte `rounded-[16px] border p-5`) puis insérer, juste après l'ouverture de ce `<div>`, un kebab positionné en absolu :

```tsx
        {props.onHide && (
          <div className="absolute top-3 right-3 z-10">
            <BlockMenu onHide={props.onHide} />
          </div>
        )}
```

À placer dans l'état `done` (le `<div>` ouvert ligne 278) et dans l'état `rest` (le `<div>` ouvert ligne 305), en ajoutant `relative` à la `className` de chacun de ces deux `<div>`.

- [ ] **Step 5 : Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur. `PlanHeroCard` sans `onHide` (mode mission) reste inchangé visuellement.

- [ ] **Step 6 : Commit**

```bash
git add web/components/mission/PlanHeroCard.tsx
git commit -m "feat(plan): PlanHeroCard accepte un prop onHide (kebab Masquer)"
```

---

### Task 4 : Extraire `useTodaySession` + `NextSessionModals` de `MissionPlan`

Cœur de l'extraction. Garde-fou : `MissionPlan.test.tsx` doit rester vert AVANT et APRÈS.

**Files:**
- Create: `web/components/mission/useTodaySession.ts`
- Create: `web/components/mission/NextSessionModals.tsx`
- Modify: `web/components/mission/MissionPlan.tsx`
- Test (garde-fou existant): `web/__tests__/components/mission/MissionPlan.test.tsx`

- [ ] **Step 1 : Baseline — lancer le test de non-régression AVANT toute modif**

Run: `npx jest __tests__/components/mission/MissionPlan.test.tsx`
Expected: 4 tests PASS. (Si rouge avant de commencer, stop — problème d'environnement, pas le refactor.)

- [ ] **Step 2 : Créer `useTodaySession.ts`**

Hook partagé. Il déplace depuis `MissionPlan.tsx` : les consts `DISCIPLINES`/`TYPE_ACCENT`/`accentForType`, les helpers `todayISO`/`isoOfWeekDay`/`makeId`/`actKm`, tout l'état (macros/plan/planned/race/loaded/reloadKey/slider), l'état des modales, la dérivation moteur (`ctx`/`rec`/`sliderBase`/`outcome`/`virtualToday`/`effectivePlanned`/`finalAdvice`/`feed`), la construction de `heroProps`, et tous les handlers. Contenu complet :

```tsx
'use client'

// Logique « séance du jour » partagée entre MissionPlan (fil « Ma semaine »)
// et ProchaineSeanceBlock (mode expert). Tout est calculé EN RENDER (pas de
// useEffect de sync) → le curseur et le fil restent cohérents sans décalage.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Props as PlanHeroCardProps } from './PlanHeroCard'
import {
  deletePlannedSession, getAllMacrocycles, getMainRace, getPlannedSessions,
  isRaceMirrorSession, pickActiveMacrocycle,
} from '@/lib/plan/storage'
import { adviseWeek, applySlider, type SliderBase, type SliderOutcome, type ReasonCode } from '@/lib/mission/session-advisor'
import { buildWeekFeed, sessionCategory, type FeedEntry } from '@/lib/mission/week-feed'
import { activityCategory } from '@/lib/plan/session-matching'
import { habitualWeekly } from '@/lib/mission/rhythm'
import { raceProfile } from '@/lib/mission/race-profile'
import { resolveMissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { estimateCharge } from '@/lib/training/charge'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'
import type { IntensityLevel, PlannedSession, Race, SessionTemplate, TrainingPlan } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

const DISCIPLINES = new Set(['run', 'bike', 'swim'])
const TYPE_ACCENT: Record<string, string> = {
  velo: 'var(--data-bike)', velotaf: 'var(--data-bike)', natation: 'var(--data-swim)',
}
const accentForType = (type: string): string => TYPE_ACCENT[type] ?? 'var(--primary)'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoOfWeekDay(idx: number): string {
  const now = new Date()
  const dow = now.getDay() || 7
  const d = new Date(now)
  d.setDate(now.getDate() - (dow - 1) + idx)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
function actKm(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }

export type NextSessionModalsState = {
  add: { open: boolean; dateISO: string; onClose: () => void; onPickTemplate: (t: SessionTemplate) => void; onCreateBlank: () => void }
  editor: { session: PlannedSession | null; initialDate: string; open: boolean; prefillTemplate: SessionTemplate | null; onClose: () => void; onSaved: () => void | Promise<void> }
  race: { open: boolean; onClose: () => void; onSaved: () => void }
}

export type TodaySession = {
  loaded: boolean
  heroProps: PlanHeroCardProps
  modalsState: NextSessionModalsState
  // extras consommés uniquement par MissionPlan :
  feed: FeedEntry[]
  today: string
  plan: TrainingPlan | null
  race: Race | null
  openAdd: (date: string) => void
  openEditSession: (s: PlannedSession) => void
}

type Params = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]
  hrZones: HrZone[]
  reloadKey?: number
  onSaved?: () => void
}

export function useTodaySession({ freshnessPayload, recentActivities, hrZones, reloadKey = 0, onSaved }: Params): TodaySession {
  const M = useT().mission

  const hrTargetLabel = (intensity: IntensityLevel): string | null => {
    const z = hrZones[intensity - 1]
    if (!z) return null
    const range = z.min != null ? `${z.min}–${z.max}` : `< ${z.max}`
    return `${z.name} · ${range} bpm`
  }

  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [macros, setMacros] = useState<TrainingPlan[]>([])
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [internalReload, setInternalReload] = useState(0)
  const bumpReload = useCallback(() => setInternalReload(k => k + 1), [])

  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState(todayISO())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState<PlannedSession | null>(null)
  const [editorPrefill, setEditorPrefill] = useState<SessionTemplate | null>(null)
  const [editorDate, setEditorDate] = useState(todayISO())
  const [createRaceOpen, setCreateRaceOpen] = useState(false)
  const [replaceIds, setReplaceIds] = useState<string[]>([])

  const [sliderPos, setSliderPosState] = useState(2)
  useEffect(() => {
    try {
      const v = localStorage.getItem(`tc_form_slider_${todayISO()}`)
      if (v != null) setSliderPosState(Number(v))
    } catch { /* ignore */ }
  }, [])
  const setSliderPos = useCallback((p: number) => {
    setSliderPosState(p)
    try { localStorage.setItem(`tc_form_slider_${todayISO()}`, String(p)) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const today = todayISO()
        const [allMacros, week, mainRace] = await Promise.all([
          getAllMacrocycles(),
          getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
          getMainRace(),
        ])
        if (cancelled) return
        setMacros(allMacros)
        setPlan(pickActiveMacrocycle(allMacros, today))
        setPlanned(week.filter(s => !isRaceMirrorSession(s)))
        setRace(mainRace)
      } catch { /* états vides : dégrade proprement */ }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [internalReload, reloadKey])

  const today = todayISO()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoOfWeekDay(i)), [])

  const weekActivities = useMemo(
    () => recentActivities.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= weekDates[0] && d <= weekDates[6]
        && DISCIPLINES.has(activityCategory(a.manual_sport_type ?? a.sport_type))
    }),
    [recentActivities, weekDates],
  )
  const weekPlanned = useMemo(
    () => planned.filter(s => DISCIPLINES.has(sessionCategory(s.type))),
    [planned],
  )

  const ctx = useMemo(() => {
    const weekDoneKm = weekActivities.reduce((s, a) => s + actKm(a), 0)
    const recentHardCount = weekPlanned.filter(s => s.status === 'completed' && s.intensity >= 4).length
    const freshnessZone = freshnessPayload ? computeFreshness(freshnessPayload.dailyMetrics).zone : null
    const planTarget = resolveMissionWeeklyTarget(macros, today)
    const targetKm = planTarget?.km ?? (habitualWeekly(recentActivities, today).km || null)
    const phaseType = plan?.phases.find(p => p.startDate <= today && today <= p.endDate)?.type ?? null
    return { todayISO: today, weekDates, freshnessZone, weekDoneKm, recentHardCount, targetKm, phaseType, daysToRace: race ? daysUntil(race.date) : null, raceProfile: raceProfile(race) }
  }, [weekActivities, weekPlanned, freshnessPayload, macros, plan, race, today, weekDates, recentActivities])

  const plannedInputs = (list: PlannedSession[]) => {
    const future = list.filter(s => s.date >= today && s.status !== 'completed')
    return {
      plannedDates: list.map(s => s.date),
      plannedRemainingKm: future.reduce((sum, s) => sum + (s.distance ?? 0), 0),
      hasPlannedLongRun: future.some(s => s.type === 'sortie_longue' || s.type === 'course'),
    }
  }

  const rec = adviseWeek({ ...ctx, ...plannedInputs(weekPlanned) }).today
  const todayPlanned = weekPlanned.find(s => s.date === today && s.status !== 'completed') ?? null
  const centerIsRest = !todayPlanned && rec.kind === 'rest'
  const sliderBase: SliderBase = todayPlanned
    ? { type: todayPlanned.type, title: todayPlanned.title, durationMin: todayPlanned.duration, distanceKm: todayPlanned.distance, elevationM: todayPlanned.elevation, intensity: todayPlanned.intensity }
    : rec.kind === 'suggested'
      ? { type: rec.session.type, title: M.sessionTitles[rec.session.titleKey] ?? rec.session.titleKey, durationMin: rec.session.durationMin, distanceKm: rec.session.distanceKm, elevationM: rec.session.elevationM, intensity: rec.session.intensity }
      : { type: 'footing', title: M.sessionTitles.sessionFooting, durationMin: 45, distanceKm: 8, intensity: 2 }
  const outcome = applySlider(sliderBase, sliderPos, centerIsRest)

  const outcomeToPlanned = (o: SliderOutcome): PlannedSession | null => {
    if (o.kind !== 'session') return null
    return { id: 'slider-today', planId: '', date: today, type: o.type, title: o.title, duration: o.durationMin, distance: o.distanceKm, elevation: o.elevationM, intensity: o.intensity, estimatedCharge: estimateCharge(o.durationMin, o.intensity, o.elevationM), status: 'planned' }
  }

  const todayDone = weekActivities.some(a => a.start_time.slice(0, 10) === today)
  const virtualToday = (!todayDone && outcome.kind === 'session') ? outcomeToPlanned(outcome) : null
  const effectivePlanned = todayDone
    ? weekPlanned
    : [...weekPlanned.filter(s => s.date !== today), ...(virtualToday ? [virtualToday] : [])]
  const finalAdvice = adviseWeek({ ...ctx, ...plannedInputs(effectivePlanned) })
  const feedRaw = buildWeekFeed({ weekDates, todayISO: today, activities: weekActivities, planned: effectivePlanned, advice: finalAdvice })
  const feed: FeedEntry[] = (!todayDone && outcome.kind === 'rest')
    ? feedRaw.map(e => e.date === today ? { date: today, isToday: true, kind: 'rest', reasonCode: 'rest-recovery' as ReasonCode } : e)
    : feedRaw

  // ─── Handlers ───────────────────────────────────────────────────────────
  const todaySessionIds = () => planned.filter(s => s.date === today).map(s => s.id)
  function openAdd(date: string) { setReplaceIds(date === today ? todaySessionIds() : []); setAddDate(date); setAddOpen(true) }
  function openEditSession(s: PlannedSession) { setReplaceIds([]); setEditorSession(s); setEditorPrefill(null); setEditorDate(s.date); setEditorOpen(true) }
  function openTodayEditor() {
    if (todayPlanned) {
      setReplaceIds(todaySessionIds().filter(id => id !== todayPlanned.id))
      setEditorSession(todayPlanned); setEditorPrefill(null); setEditorDate(today); setEditorOpen(true)
      return
    }
    if (outcome.kind !== 'session') { openAdd(today); return }
    setReplaceIds(todaySessionIds())
    setEditorSession({
      id: makeId(), planId: '', date: today, type: outcome.type, title: outcome.title,
      duration: outcome.durationMin, distance: outcome.distanceKm, elevation: outcome.elevationM, intensity: outcome.intensity,
      estimatedCharge: estimateCharge(outcome.durationMin, outcome.intensity, outcome.elevationM), status: 'planned',
    })
    setEditorPrefill(null); setEditorDate(today); setEditorOpen(true)
  }
  function handlePickTemplate(t: SessionTemplate) { setAddOpen(false); setEditorSession(null); setEditorPrefill(t); setEditorDate(addDate); setEditorOpen(true) }
  function handleCreateBlank() { setAddOpen(false); setEditorSession(null); setEditorPrefill(null); setEditorDate(addDate); setEditorOpen(true) }
  function goToCreateRace() { setCreateRaceOpen(true) }

  async function handleSessionSaved() {
    setEditorOpen(false)
    if (replaceIds.length > 0) {
      await Promise.all(replaceIds.map(id => deletePlannedSession(id)))
      setReplaceIds([])
    }
    if (editorDate === today) setSliderPos(2)
    bumpReload()
    onSaved?.()
  }

  // ─── heroProps (active | done | rest) ─────────────────────────────────────
  const atDefault = sliderPos === 2
  const doneEntry = feed.find(f => f.date === today)
  let heroProps: PlanHeroCardProps
  if (todayDone && doneEntry?.kind === 'done') {
    const t = doneEntry.multiple ? M.weekMultiSessions(doneEntry.count) : doneEntry.title
    heroProps = { state: 'done', title: t, km: doneEntry.km, dPlus: doneEntry.dPlus, durationSec: doneEntry.durationSec }
  } else if (outcome.kind === 'session') {
    const whyText = atDefault
      ? (todayPlanned ? null : (rec.kind === 'suggested' ? M.reasonWhy[rec.session.reasonCode] : null))
      : M.heroSliderAdjusted
    heroProps = {
      state: 'active', title: outcome.title, sessionType: outcome.type,
      durationMin: outcome.durationMin, distanceKm: outcome.distanceKm, elevationM: outcome.elevationM, intensity: outcome.intensity,
      whyText, targetLabel: hrTargetLabel(outcome.intensity), accentColor: accentForType(outcome.type),
      onOpen: openTodayEditor, sliderPos, onSliderChange: setSliderPos, onOpenLibrary: () => { setSliderPos(2); openAdd(today) },
    }
  } else {
    const text = !atDefault ? M.heroSliderAdjusted : (rec.kind === 'rest' ? M.reasonWhy[rec.reasonCode] : M.reasonWhy['rest-recovery'])
    heroProps = { state: 'rest', text, sliderPos, onSliderChange: setSliderPos, onOpenLibrary: () => { setSliderPos(2); openAdd(today) } }
  }

  const modalsState: NextSessionModalsState = {
    add: { open: addOpen, dateISO: addDate, onClose: () => setAddOpen(false), onPickTemplate: handlePickTemplate, onCreateBlank: handleCreateBlank },
    editor: { session: editorSession, initialDate: editorDate, open: editorOpen, prefillTemplate: editorPrefill, onClose: () => setEditorOpen(false), onSaved: handleSessionSaved },
    race: { open: createRaceOpen, onClose: () => setCreateRaceOpen(false), onSaved: bumpReload },
  }

  return { loaded, heroProps, modalsState, feed, today, plan, race, openAdd, openEditSession }
}

function daysUntil(dateISO: string): number {
  const today = new Date(`${todayISO()}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
}
```

- [ ] **Step 3 : Créer `NextSessionModals.tsx`**

```tsx
'use client'

// Les 3 modales partagées (ajout / édition / création de course), pilotées par
// l'état renvoyé par useTodaySession. Mêmes composants qu'en mode expert.

import { SessionAddSheet } from '@/components/plan/SessionAddSheet'
import { SessionEditorModal } from '@/components/plan/SessionEditorModal'
import { RaceEditorModal } from '@/components/plan/RaceEditorModal'
import type { NextSessionModalsState } from './useTodaySession'

export function NextSessionModals({ state }: { state: NextSessionModalsState }) {
  return (
    <>
      <SessionAddSheet
        open={state.add.open} dateISO={state.add.dateISO} onClose={state.add.onClose}
        onPickTemplate={state.add.onPickTemplate} onCreateBlank={state.add.onCreateBlank}
      />
      <SessionEditorModal
        session={state.editor.session} initialDate={state.editor.initialDate} open={state.editor.open}
        prefillTemplate={state.editor.prefillTemplate} onClose={state.editor.onClose} onSaved={state.editor.onSaved}
      />
      <RaceEditorModal race={null} open={state.race.open} onClose={state.race.onClose} onSaved={state.race.onSaved} />
    </>
  )
}
```

- [ ] **Step 4 : Refactor `MissionPlan.tsx` pour consommer le hook**

Dans `web/components/mission/MissionPlan.tsx` :

1. Remplacer les imports devenus inutiles. Garder uniquement ce dont le RENDU a besoin :
   - garder : `useMemo` n'est plus nécessaire si plus utilisé → vérifier ; garder `Link`, `MissionCard`/`MissionCardLabel`, `PlanHeroCard`, `RythmeCard`, `weeklyVolumes`/`habitualWeekly` (RythmeCard), `raceProfile` non (déplacé), `computePhaseSegments`/`weekOfPlan`, `daysUntil` (destination), `FeedEntry`/`ReasonCode` (rendu du fil), `useT`.
   - ajouter : `import { useTodaySession } from './useTodaySession'` et `import { NextSessionModals } from './NextSessionModals'`.
   - supprimer : imports `adviseWeek`/`applySlider`/`SliderBase`/`SliderOutcome`, `buildWeekFeed`/`sessionCategory`, `activityCategory`, `resolveMissionWeeklyTarget`, `computeFreshness`, `estimateCharge`, `deletePlannedSession`/`getAllMacrocycles`/`getMainRace`/`getPlannedSessions`/`isRaceMirrorSession`/`pickActiveMacrocycle`, les 3 modales (rendues par NextSessionModals), `SessionTemplate`. Conserver `getMainRace`? non. Conserver les types `PlannedSession`/`Race`/`TrainingPlan` si encore référencés dans le rendu (oui : feed handlers `openEditSession(s: PlannedSession)`).

2. Garder en module : `DAY_SHORT`, `CAT_COLOR`, `daysUntil`, `fmtKmDp`, `fmtMeta`. Supprimer (déplacés vers le hook) : `DISCIPLINES`, `TYPE_ACCENT`, `accentForType`, `todayISO`, `isoOfWeekDay`, `makeId`, `actKm`.

3. Remplacer tout le corps du composant (de la déclaration des states ligne 102 jusqu'à la construction de `hero` incluse, ligne 292) par :

```tsx
export function MissionPlan({ freshnessPayload, recentActivities, hrZones }: Props) {
  const M = useT().mission
  const { loaded, heroProps, modalsState, feed, today, plan, race, openAdd, openEditSession } =
    useTodaySession({ freshnessPayload, recentActivities, hrZones })

  if (!loaded) return null

  const week = plan ? weekOfPlan(plan, today) : null
  const segments = plan ? computePhaseSegments(plan, today) : []
```

4. Dans le JSX de retour : remplacer `{hero}` par `<PlanHeroCard {...heroProps} />`. Le bloc « Ma semaine » itère sur `feed` (inchangé), avec `openEditSession(s)` pour les lignes planifiées et `openAdd(today)` pour le bouton « Ajouter une séance ». La destination utilise `race`/`daysUntil`/`week`/`segments`. Le `RythmeCard` utilise `recentActivities` (prop) et `goToCreateRace` → remplacer `onAddRace={goToCreateRace}` par `onAddRace={() => modalsState.race.onClose}`… **non** : exposer plutôt une ouverture. Voir Step 5.

- [ ] **Step 5 : Gérer l'ouverture « créer une course » dans MissionPlan**

Le bouton `RythmeCard onAddRace` ouvrait `goToCreateRace` (= `setCreateRaceOpen(true)`), désormais dans le hook. Ajouter au retour du hook un handler `openCreateRace`. Dans `useTodaySession.ts`, ajouter `openCreateRace: goToCreateRace` au type `TodaySession` et à l'objet retourné :

```ts
  // dans TodaySession :
  openCreateRace: () => void
  // dans le return :
  return { loaded, heroProps, modalsState, feed, today, plan, race, openAdd, openEditSession, openCreateRace: goToCreateRace }
```

Puis dans `MissionPlan.tsx`, récupérer `openCreateRace` du hook et faire `<RythmeCard … onAddRace={openCreateRace} />`. Et remplacer le bloc des 3 modales (lignes 440-445) par `<NextSessionModals state={modalsState} />`.

- [ ] **Step 6 : Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur, aucun import/variable orphelin dans `MissionPlan.tsx`.

- [ ] **Step 7 : Rejouer le test de non-régression**

Run: `npx jest __tests__/components/mission/MissionPlan.test.tsx __tests__/lib/mission/session-advisor.test.ts`
Expected: tous PASS (mêmes 4 tests MissionPlan + advisor). Le mock `@/lib/plan/storage` s'applique aussi aux imports du hook (même chemin de module).

- [ ] **Step 8 : Commit**

```bash
git add web/components/mission/useTodaySession.ts web/components/mission/NextSessionModals.tsx web/components/mission/MissionPlan.tsx
git commit -m "refactor(mission): extraire la logique séance du jour dans useTodaySession"
```

---

### Task 5 : `ProchaineSeanceBlock` (bloc expert)

TDD : test d'abord.

**Files:**
- Create: `web/components/plan/ProchaineSeanceBlock.tsx`
- Test: `web/__tests__/components/plan/ProchaineSeanceBlock.test.tsx`

- [ ] **Step 1 : Écrire le test (échoue)**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ProchaineSeanceBlock } from '@/components/plan/ProchaineSeanceBlock'
import { BlockContext } from '@/components/blocks/BlockGrid'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
}))
jest.mock('@/components/plan/SessionAddSheet', () => ({ SessionAddSheet: () => null }))
jest.mock('@/components/plan/SessionEditorModal', () => ({ SessionEditorModal: () => null }))
jest.mock('@/components/plan/RaceEditorModal', () => ({ RaceEditorModal: () => null }))

function renderBlock(hideSelf = jest.fn()) {
  render(
    <I18nProvider initialLang="fr">
      <BlockContext.Provider value={{ hideSelf }}>
        <ProchaineSeanceBlock freshnessPayload={null} recentActivities={[]} hrZones={[]} reloadKey={0} onChange={jest.fn()} />
      </BlockContext.Provider>
    </I18nProvider>,
  )
  return hideSelf
}

it('affiche le héros (curseur « Selon ta forme ») une fois chargé', async () => {
  renderBlock()
  expect(await screen.findByText(/Selon ta forme/)).toBeInTheDocument()
})

it('le kebab « Masquer » déclenche hideSelf', async () => {
  const hideSelf = renderBlock()
  await screen.findByText(/Selon ta forme/)
  fireEvent.click(screen.getByLabelText(/menu/i))
  fireEvent.click(screen.getByText('Masquer'))
  expect(hideSelf).toHaveBeenCalled()
})
```

> Prérequis : `BlockContext` doit être exporté depuis `BlockGrid`. Il ne l'est pas → l'ajouter (Step 2).

- [ ] **Step 2 : Exporter `BlockContext` depuis `BlockGrid.tsx`**

Dans `web/components/blocks/BlockGrid.tsx` ligne 31, remplacer `const BlockContext = createContext(...)` par `export const BlockContext = createContext(...)` (laisser `useBlockContext` inchangé).

- [ ] **Step 3 : Lancer le test (échoue)**

Run: `npx jest __tests__/components/plan/ProchaineSeanceBlock.test.tsx`
Expected: FAIL — `ProchaineSeanceBlock` n'existe pas encore.

- [ ] **Step 4 : Créer `ProchaineSeanceBlock.tsx`**

```tsx
'use client'

// Bloc « Ta prochaine séance » du mode expert. Réutilise la logique partagée
// (useTodaySession) + le héros (PlanHeroCard) + les modales. Déplaçable via
// BlockGrid ; masquable via le kebab (onHide → hideSelf).

import { useBlockContext } from '@/components/blocks/BlockGrid'
import { PlanHeroCard } from '@/components/mission/PlanHeroCard'
import { NextSessionModals } from '@/components/mission/NextSessionModals'
import { useTodaySession } from '@/components/mission/useTodaySession'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'

type Props = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]
  hrZones: HrZone[]
  reloadKey: number
  onChange: () => void
}

export function ProchaineSeanceBlock({ freshnessPayload, recentActivities, hrZones, reloadKey, onChange }: Props) {
  const { hideSelf } = useBlockContext()
  const { loaded, heroProps, modalsState } = useTodaySession({
    freshnessPayload, recentActivities, hrZones, reloadKey, onSaved: onChange,
  })
  if (!loaded) return null
  return (
    <>
      <PlanHeroCard {...heroProps} onHide={hideSelf} />
      <NextSessionModals state={modalsState} />
    </>
  )
}
```

- [ ] **Step 5 : Lancer le test (passe)**

Run: `npx jest __tests__/components/plan/ProchaineSeanceBlock.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 6 : Commit**

```bash
git add web/components/plan/ProchaineSeanceBlock.tsx web/__tests__/components/plan/ProchaineSeanceBlock.test.tsx web/components/blocks/BlockGrid.tsx
git commit -m "feat(plan): bloc « Prochaine séance » pour le mode expert"
```

---

### Task 6 : Câbler `page.tsx` + `PlanClient`

**Files:**
- Modify: `web/app/(main)/plan/page.tsx`
- Modify: `web/app/(main)/plan/PlanClient.tsx`

- [ ] **Step 1 : Extraire le fetch dans `page.tsx`**

Dans `web/app/(main)/plan/page.tsx`, factoriser le chargement des 3 jeux de données (aujourd'hui dans la branche mission, lignes 24-61) dans un helper module, et l'appeler dans les deux branches :

```tsx
async function loadHeroData(userId: string): Promise<{
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]
  hrZones: HrZone[]
}> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 28)
  const [{ data: rows }, charge, { data: profile }] = await Promise.all([
    supabase.from('activities').select(ACTIVITY_CARD_FIELDS)
      .eq('user_id', userId).is('deleted_at', null)
      .gte('start_time', since.toISOString()).order('start_time', { ascending: false }),
    getChargePageData(userId).catch(() => null),
    supabase.from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
      .eq('id', userId).maybeSingle(),
  ])
  const recentActivities = (rows ?? []) as ActivityRow[]
  let freshnessPayload: ChargeSportPayload | null = null
  if (charge) freshnessPayload = charge.perSport.run.historyDays > 0 ? charge.perSport.run : charge.perSport.all
  let hrZones: HrZone[] = []
  if (profile) {
    const method = (profile.hr_zone_method as HrZoneMethod | null) ?? getRecommendedHeartRateZoneMode(profile).mode
    hrZones = calculateHrZones({
      method, maxHr: profile.max_hr, restingHr: profile.resting_hr,
      aerobicThresholdHr: profile.aerobic_threshold_hr, thresholdHr: profile.threshold_hr,
      birthYear: profile.birth_year,
      customZones: (profile.hr_zones_custom as CustomZoneInput[] | null) ?? null,
    }).zones
  }
  return { freshnessPayload, recentActivities, hrZones }
}
```

Branche mission : `const data = user ? await loadHeroData(user.id) : { freshnessPayload: null, recentActivities: [], hrZones: [] }; return <MissionPlan {...data} />`.

Branche expert : récupérer `mission` (comme aujourd'hui) **et** `data`, puis `return <PlanClient mode="expert" mission={mission} {...data} />`. (Réutiliser le même `user`/`supabase` ; un seul `getServerUser()`.)

- [ ] **Step 2 : Étendre `PlanClient` (props + BlockDef)**

Dans `web/app/(main)/plan/PlanClient.tsx` :

1. Imports : `import { ProchaineSeanceBlock } from '@/components/plan/ProchaineSeanceBlock'` + types `ChargeSportPayload`, `ActivityRow`, `HrZone`.
2. `DEFAULT_ORDER` (ligne 48) : préfixer `'prochaine-seance'` →
   `const DEFAULT_ORDER = ['prochaine-seance', 'objectif', 'resume-semaine', 'structure', 'calendrier-mois', 'semaine-bibliotheque', 'charge']`
3. Signature : ajouter les 3 props.

```tsx
export default function PlanClient({
  mode = 'expert', mission = null, freshnessPayload = null, recentActivities = [], hrZones = [],
}: {
  mode?: 'mission' | 'expert'; mission?: string | null
  freshnessPayload?: ChargeSportPayload | null
  recentActivities?: ActivityRow[]
  hrZones?: HrZone[]
} = {}) {
```

4. Ajouter le `BlockDef` en tête du tableau `blocks` :

```tsx
    {
      id: 'prochaine-seance',
      label: L.blockProchaineSeance,
      emoji: '🏃',
      render: () => (
        <ProchaineSeanceBlock
          freshnessPayload={freshnessPayload}
          recentActivities={recentActivities}
          hrZones={hrZones}
          reloadKey={reloadKey}
          onChange={bumpReload}
        />
      ),
    },
```

- [ ] **Step 3 : Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add web/app/(main)/plan/page.tsx web/app/(main)/plan/PlanClient.tsx
git commit -m "feat(plan): exposer le bloc « Prochaine séance » dans le mode expert"
```

---

### Task 7 : Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1 : Typecheck + lint global**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 2 : Suites de tests pertinentes**

Run: `npx jest __tests__/components/mission/MissionPlan.test.tsx __tests__/components/plan/ProchaineSeanceBlock.test.tsx __tests__/lib/mission/session-advisor.test.ts`
Expected: tous PASS. (Ne pas lancer toute la suite : ~50 tests échouent en pré-existant pour cause de `useI18n` hors provider — cf. [reference_jest_i18n_preexisting_failures].)

- [ ] **Step 3 : Vérif visuelle manuelle (`npm run dev`)**

- Mode mission : héros + « Ma semaine » + destination/rythme identiques à avant (non-régression). Curseur, ouverture des modales OK.
- Mode expert : le bloc « Prochaine séance » apparaît en tête. Déplacement (poignée) OK. Kebab `⋮` → « Masquer » → le bloc disparaît et « Ajouter un bloc » le propose. Le curseur « forme du jour » et l'ouverture des modales fonctionnent. Ajouter une séance depuis le héros rafraîchit les blocs frères (VueSemaine / Calendrier / Charge).

- [ ] **Step 4 : Mettre à jour la spec (bandeau Implémenté)**

En tête de `docs/superpowers/specs/2026-06-16-bloc-prochaine-seance-mode-expert-design.md`, ajouter :
`> **Status: Implémenté** · 2026-06-16 · Code: web/components/plan/ProchaineSeanceBlock.tsx, web/components/mission/useTodaySession.ts`

- [ ] **Step 5 : Commit final**

```bash
git add web/docs/superpowers/specs/2026-06-16-bloc-prochaine-seance-mode-expert-design.md
git commit -m "docs(plan): bandeau Implémenté sur la spec bloc Prochaine séance"
```

---

## Self-Review

**Couverture spec :**
- Hook partagé `useTodaySession` → Task 4. ✔
- Modales partagées `NextSessionModals` → Task 4. ✔
- `ProchaineSeanceBlock` → Task 5. ✔
- `BlockMenu` extrait → Task 2 ; utilisé par `BlockCard` (Task 2) et `PlanHeroCard` (Task 3). ✔
- `PlanHeroCard onHide` → Task 3. ✔
- Fetch partagé `page.tsx` → Task 6. ✔
- `PlanClient` props + `BlockDef` en tête de `DEFAULT_ORDER` → Task 6. ✔
- i18n fr+en → Task 1. ✔
- Non-régression mission (`MissionPlan.test`, `session-advisor.test`) → Tasks 4 & 7. ✔

**Cohérence des types/noms :** `Props as PlanHeroCardProps` (exporté Task 3, importé Task 4) ; `NextSessionModalsState` (défini Task 4, consommé par `NextSessionModals` Task 4) ; `BlockContext` exporté (Task 5) et utilisé par le test ; `blockProchaineSeance` (Task 1) référencé Task 6 ; `onChange`/`onSaved`/`reloadKey` cohérents bloc→hook ; état `macros`/`setMacros` unique dans le hook.
