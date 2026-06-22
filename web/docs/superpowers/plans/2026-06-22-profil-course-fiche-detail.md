# Profil de course — fiche détail + puces ravito + sélection unifiée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le mode dense du profil de course (page Plan → course) avec des puces ravito au-dessus du graphe, une fiche détail sous le graphe, et une sélection unifiée graphe ↔ tableau.

**Architecture:** Deux libs purs testables (`supply-chips`, `passage-clock`) alimentent un nouveau composant `WaypointDetailCard` et la branche dense de `ElevationProfileChart`. `CoursePageClient` détient l'état `selectedWaypointIndex` (source unique), calcule les heures de passage, et câble le tout. Tout dérive des `RaceWaypoint` existants ; aucune donnée dupliquée.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Recharts (ComposedChart/Area/Scatter), Jest + @testing-library/react.

**Spec:** `web/docs/superpowers/specs/2026-06-22-profil-course-fiche-detail-design.md`

## Global Constraints

- **Périmètre : mode dense uniquement** (trace GPX présente). Le mode escalier (sans trace) reste **inchangé** : les props de sélection/puces sont ignorées sans `denseProfile`.
- **Orange d'accent = `colors.chargeOrange` (`#FF7900`)** pour le point sélectionné, le connecteur sélectionné, l'étiquette km, le fond/valeur barrière de la fiche.
- **Puces — vue graphe (réduite)** : `hot`→`C` sinon `solid`→`S` sinon `liquid`→`L`, puis `+base_vie`→`BV`, `+assistance`→`A`. **Vue fiche (complète)** : toutes, ordre canonique `liquid, solid, hot, base_vie, assistance`.
- **Empilement graphe** : puces **verticales**, nourriture en haut → BV → A vers le bas (près du point).
- **Sélection unifiée** : un seul index ; défaut = 1er waypoint de type `ravito`. Nav `‹ ›` bornée.
- **Passage estimé** : via `estimatePassageTimes` ; chaîne vide `''` si objectif (`targetDurationMin`) absent — aucune valeur inventée.
- **Lecture seule** : la fiche n'édite rien.
- **Couleurs puces** : valeurs `light` de `lib/design/colors.ts` (identiques aux puces du tableau — `light.seriesBlue/seriesYellow/seriesRed/greenOk` + `#7C5CFC`), pour un texte blanc lisible sur fond clair. L'orange d'accent reste `colors.chargeOrange` (#FF7900).
- **Tests** : exécuter depuis `web/` (`cd web && npx jest <chemin>`). Ne lancer que les suites pertinentes (≈50 tests i18n échouent en pré-existant, hors sujet). Ne PAS utiliser `useI18n` dans les nouveaux composants (textes français en dur), pour éviter le piège « hors I18nProvider ».
- **Commits fréquents**, un par tâche, message français, terminé par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `web/lib/plan/supply-chips.ts` *(créer)* | Logique pure des puces : méta (lettre/label/couleur), `chartChips` (réduit), `allChips` (complet). |
| `web/lib/plan/passage-clock.ts` *(créer)* | Heure de passage absolue par waypoint, dérivée de `estimatePassageTimes`. |
| `web/components/plan/WaypointDetailCard.tsx` *(créer)* | La fiche détail (lecture seule) sous le graphe. |
| `web/components/plan/ElevationProfileChart.tsx` *(modifier)* | Branche dense : `ProfileWaypoint` étendu, puces empilées, point sélectionné, props sélection. |
| `web/components/plan/WaypointsTable.tsx` *(modifier)* | Props `selectedIndex`/`onSelectIndex`, tap ligne → sélection, style ligne sélectionnée. |
| `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` *(modifier)* | État `selectedWaypointIndex`, calcul `passages`, câblage, rendu de la fiche (mode dense). |

Tests : `web/__tests__/lib/plan/supply-chips.test.ts`, `web/__tests__/lib/plan/passage-clock.test.ts`, `web/__tests__/components/plan/WaypointDetailCard.test.tsx`, et mises à jour de `web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx` + `WaypointsTable.*.test.tsx`.

---

### Task 1: `lib/plan/supply-chips.ts` — logique pure des puces

**Files:**
- Create: `web/lib/plan/supply-chips.ts`
- Test: `web/__tests__/lib/plan/supply-chips.test.ts`

**Interfaces:**
- Consumes: `WaypointSupply` de `@/types/plan` (`'liquid' | 'solid' | 'hot' | 'base_vie' | 'assistance'`) ; `colors` de `@/lib/design/colors`.
- Produces:
  - `SUPPLY_ORDER: readonly WaypointSupply[]` = `['liquid','solid','hot','base_vie','assistance']`
  - `SUPPLY_META: Record<WaypointSupply, { letter: string; label: string; color: string }>`
  - `chartChips(supplies: WaypointSupply[]): WaypointSupply[]`
  - `allChips(supplies: WaypointSupply[]): WaypointSupply[]`

- [ ] **Step 1: Write the failing test**

`web/__tests__/lib/plan/supply-chips.test.ts` :
```ts
import { chartChips, allChips, SUPPLY_META, SUPPLY_ORDER } from '@/lib/plan/supply-chips'

describe('chartChips (vue graphe réduite)', () => {
  it('liquide seul → [L]', () => {
    expect(chartChips(['liquid'])).toEqual(['liquid'])
  })
  it('liquide+solide → [S] (le liquide est implicite)', () => {
    expect(chartChips(['liquid', 'solid'])).toEqual(['solid'])
  })
  it('liquide+solide+chaud → [C] (solide et liquide implicites)', () => {
    expect(chartChips(['liquid', 'solid', 'hot'])).toEqual(['hot'])
  })
  it('chaud + base vie + assistance → [C, BV, A] dans cet ordre', () => {
    expect(chartChips(['liquid', 'solid', 'hot', 'base_vie', 'assistance']))
      .toEqual(['hot', 'base_vie', 'assistance'])
  })
  it('base vie sans nourriture → [BV]', () => {
    expect(chartChips(['base_vie'])).toEqual(['base_vie'])
  })
  it('vide → []', () => {
    expect(chartChips([])).toEqual([])
  })
})

describe('allChips (vue fiche complète)', () => {
  it('conserve toutes les puces dans l’ordre canonique', () => {
    expect(allChips(['assistance', 'liquid', 'hot'])).toEqual(['liquid', 'hot', 'assistance'])
  })
})

describe('SUPPLY_META', () => {
  it('lettres conformes au tableau', () => {
    expect(SUPPLY_META.liquid.letter).toBe('L')
    expect(SUPPLY_META.solid.letter).toBe('S')
    expect(SUPPLY_META.hot.letter).toBe('C')
    expect(SUPPLY_META.base_vie.letter).toBe('BV')
    expect(SUPPLY_META.assistance.letter).toBe('A')
  })
  it('chaque catégorie a une couleur hex', () => {
    SUPPLY_ORDER.forEach((s) => expect(SUPPLY_META[s].color).toMatch(/^#[0-9A-Fa-f]{6}$/))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx jest __tests__/lib/plan/supply-chips.test.ts`
Expected: FAIL (`Cannot find module '@/lib/plan/supply-chips'`).

- [ ] **Step 3: Write minimal implementation**

`web/lib/plan/supply-chips.ts` :
```ts
import type { WaypointSupply } from '@/types/plan'
import { light } from '@/lib/design/colors'

// Ordre canonique d'affichage (identique au tableau de course).
export const SUPPLY_ORDER: readonly WaypointSupply[] = [
  'liquid', 'solid', 'hot', 'base_vie', 'assistance',
]

// Lettre + libellé + couleur de chaque catégorie. Couleurs = valeurs LIGHT de
// colors.ts (identiques aux puces du tableau, texte blanc lisible sur fond clair) ;
// violet en dur pour l'assistance, comme le tableau (WaypointsTable .chip.ass).
export const SUPPLY_META: Record<WaypointSupply, { letter: string; label: string; color: string }> = {
  liquid:     { letter: 'L',  label: 'Liquide',    color: light.seriesBlue },   // #1D8FC6
  solid:      { letter: 'S',  label: 'Solide',     color: light.seriesYellow }, // #CC9200
  hot:        { letter: 'C',  label: 'Chaud',      color: light.seriesRed },    // #D94F45
  base_vie:   { letter: 'BV', label: 'Base vie',   color: light.greenOk },      // #138A52
  assistance: { letter: 'A',  label: 'Assistance', color: '#7C5CFC' },
}

// Vue graphe : une seule puce « nourriture » (chaud ⊃ solide ⊃ liquide), puis
// base vie, puis assistance.
export function chartChips(supplies: WaypointSupply[]): WaypointSupply[] {
  const out: WaypointSupply[] = []
  if (supplies.includes('hot')) out.push('hot')
  else if (supplies.includes('solid')) out.push('solid')
  else if (supplies.includes('liquid')) out.push('liquid')
  if (supplies.includes('base_vie')) out.push('base_vie')
  if (supplies.includes('assistance')) out.push('assistance')
  return out
}

// Vue fiche : toutes les puces présentes, ordre canonique.
export function allChips(supplies: WaypointSupply[]): WaypointSupply[] {
  return SUPPLY_ORDER.filter((s) => supplies.includes(s))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx jest __tests__/lib/plan/supply-chips.test.ts`
Expected: PASS (tous les cas).

- [ ] **Step 5: Commit**

```bash
git add web/lib/plan/supply-chips.ts web/__tests__/lib/plan/supply-chips.test.ts
git commit -m "feat(profil): logique pure des puces ravito (chartChips/allChips/SUPPLY_META)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `lib/plan/passage-clock.ts` — heure de passage absolue

**Files:**
- Create: `web/lib/plan/passage-clock.ts`
- Test: `web/__tests__/lib/plan/passage-clock.test.ts`

**Interfaces:**
- Consumes: `estimatePassageTimes` + `PacingWaypoint` de `@/lib/plan/pacing` (`PacingWaypoint = { km: number; dPlus: number | null; targetOverrideSec: number | null }`).
- Produces:
  - `interface PassageClockOpts { startTime?: string | null; totalDurationSec: number | null; fade: number; startDateIso?: string | null }`
  - `passageClocks(waypoints: PacingWaypoint[], opts: PassageClockOpts): string[]` — un libellé par waypoint (`''` si indispo).

- [ ] **Step 1: Write the failing test**

`web/__tests__/lib/plan/passage-clock.test.ts` :
```ts
import { passageClocks } from '@/lib/plan/passage-clock'

const flat = (kms: number[]) =>
  kms.map((km) => ({ km, dPlus: 0, targetOverrideSec: null }))

describe('passageClocks', () => {
  it('objectif absent → tout vide', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: '08:00', totalDurationSec: null, fade: 0 }))
      .toEqual(['', '', ''])
  })
  it('heure de départ absente → tout vide', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: null, totalDurationSec: 7200, fade: 0 }))
      .toEqual(['', '', ''])
  })
  it('départ 08:00, cible 2h, 3 points réguliers → 08:00 / 09:00 / 10:00', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: '08:00', totalDurationSec: 7200, fade: 0 }))
      .toEqual(['08:00', '09:00', '10:00'])
  })
  it('passage minuit sans date → préfixe J+1', () => {
    const out = passageClocks(flat([0, 10]), { startTime: '22:00', totalDurationSec: 10800, fade: 0 })
    expect(out[0]).toBe('22:00')
    expect(out[1]).toBe('J+1 01:00')
  })
  it('passage minuit avec date connue → jour de semaine court', () => {
    // 2026-06-20 = samedi → +1 jour = dimanche.
    const out = passageClocks(flat([0, 10]), {
      startTime: '22:00', totalDurationSec: 10800, fade: 0, startDateIso: '2026-06-20',
    })
    expect(out[1]).toBe('dim. 01:00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx jest __tests__/lib/plan/passage-clock.test.ts`
Expected: FAIL (`Cannot find module '@/lib/plan/passage-clock'`).

- [ ] **Step 3: Write minimal implementation**

`web/lib/plan/passage-clock.ts` :
```ts
import { estimatePassageTimes, type PacingWaypoint } from '@/lib/plan/pacing'

export interface PassageClockOpts {
  startTime?: string | null       // 'HH:MM' heure locale de départ
  totalDurationSec: number | null // objectif total ; null = pas de calcul
  fade: number                    // coef fade pacing
  startDateIso?: string | null    // 'YYYY-MM-DD' pour le jour de semaine
}

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

function dayLabel(dayOffset: number, startDateIso: string | null): string {
  if (startDateIso) {
    const d = new Date(`${startDateIso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + dayOffset)
    return WEEKDAYS[d.getUTCDay()]
  }
  return dayOffset === 0 ? '' : `J+${dayOffset}`
}

function formatClock(totalSec: number, startDateIso: string | null): string {
  const dayOffset = Math.floor(totalSec / 86400)
  const sod = ((totalSec % 86400) + 86400) % 86400
  const hh = String(Math.floor(sod / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sod % 3600) / 60)).padStart(2, '0')
  const hm = `${hh}:${mm}`
  const prefix = dayLabel(dayOffset, startDateIso)
  return prefix ? `${prefix} ${hm}` : hm
}

// Heure absolue de passage à chaque waypoint. Vide si objectif ou heure de
// départ manquants (on n'invente rien).
export function passageClocks(waypoints: PacingWaypoint[], opts: PassageClockOpts): string[] {
  if (opts.totalDurationSec == null || !opts.startTime) return waypoints.map(() => '')
  const m = /^(\d{1,2}):(\d{2})/.exec(opts.startTime)
  if (!m) return waypoints.map(() => '')
  const startSec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  const elapsed = estimatePassageTimes(waypoints, {
    totalDurationSec: opts.totalDurationSec, fade: opts.fade,
  })
  return elapsed.map((e) => formatClock(startSec + e, opts.startDateIso ?? null))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx jest __tests__/lib/plan/passage-clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/plan/passage-clock.ts web/__tests__/lib/plan/passage-clock.test.ts
git commit -m "feat(profil): heure de passage absolue par waypoint (passage-clock)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `components/plan/WaypointDetailCard.tsx` — la fiche détail

**Files:**
- Create: `web/components/plan/WaypointDetailCard.tsx`
- Test: `web/__tests__/components/plan/WaypointDetailCard.test.tsx`

**Interfaces:**
- Consumes: `RaceWaypoint`, `WaypointSupply` de `@/types/plan` ; `SUPPLY_META`, `allChips` de `@/lib/plan/supply-chips` (Task 1) ; `colors` de `@/lib/design/colors`.
- Produces:
  ```ts
  export interface WaypointDetailCardProps {
    waypoint: RaceWaypoint
    previous: RaceWaypoint | null   // pour D+/D− du tronçon
    altitude: number | null         // interpolée sur la trace
    passageClock: string            // '' si indispo
    hasPrev: boolean
    hasNext: boolean
    onPrev: () => void
    onNext: () => void
  }
  export function WaypointDetailCard(props: WaypointDetailCardProps): JSX.Element
  ```
- Comportement clé : tronçon = `waypoint.dPlus - previous.dPlus` (et `dMoins`), ≥ 0 ; barrière = `waypoint.cutoffRaw ?? '—'` ; ravitaillement = libellés `allChips` joints par ` · `, ou `'—'` si vide.

- [ ] **Step 1: Write the failing test**

`web/__tests__/components/plan/WaypointDetailCard.test.tsx` :
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointDetailCard } from '@/components/plan/WaypointDetailCard'
import type { RaceWaypoint } from '@/types/plan'

const wp = (over: Partial<RaceWaypoint> = {}): RaceWaypoint => ({
  id: 'w', raceId: 'r', orderIndex: 0, name: 'Beaufort', km: 92.3, kmInter: null,
  dPlus: 4200, dMoins: 3100, altitude: null, cutoffRaw: '00:30', cutoffKind: 'clock_time',
  type: 'ravito', supplies: ['liquid', 'solid', 'hot', 'base_vie'], targetOverrideSec: null, ...over,
})

describe('WaypointDetailCard', () => {
  it('affiche nom, toutes les puces, tag base vie, et le passage estimé', () => {
    render(
      <WaypointDetailCard
        waypoint={wp()} previous={wp({ name: 'Roselend', dPlus: 3380, dMoins: 1890 })}
        altitude={1100} passageClock="mar. 21:30"
        hasPrev hasNext onPrev={() => {}} onNext={() => {}}
      />,
    )
    expect(screen.getByText('Beaufort')).toBeInTheDocument()
    expect(screen.getByText('Base vie')).toBeInTheDocument()
    expect(screen.getByText('mar. 21:30')).toBeInTheDocument()
    // D+/D− du tronçon depuis Roselend : 4200-3380=820, 3100-1890=1210
    expect(screen.getByText(/\+820/)).toBeInTheDocument()
    expect(screen.getByText(/1\s?210/)).toBeInTheDocument()
    // 4 puces (L S C BV)
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('BV')).toBeInTheDocument()
  })

  it('barrière et ravito absents → « — »', () => {
    render(
      <WaypointDetailCard
        waypoint={wp({ cutoffRaw: null, supplies: [] })} previous={null}
        altitude={null} passageClock=""
        hasPrev={false} hasNext onPrev={() => {}} onNext={() => {}}
      />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('boutons de navigation bornés', () => {
    const onPrev = jest.fn(); const onNext = jest.fn()
    render(
      <WaypointDetailCard
        waypoint={wp()} previous={null} altitude={1100} passageClock=""
        hasPrev={false} hasNext onPrev={onPrev} onNext={onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ravito précédent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ravito suivant' }))
    expect(onPrev).not.toHaveBeenCalled() // désactivé (hasPrev=false)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx jest __tests__/components/plan/WaypointDetailCard.test.tsx`
Expected: FAIL (`Cannot find module '@/components/plan/WaypointDetailCard'`).

- [ ] **Step 3: Write minimal implementation**

`web/components/plan/WaypointDetailCard.tsx` (textes français en dur, pas de `useI18n`) :
```tsx
'use client'

import type { RaceWaypoint } from '@/types/plan'
import { SUPPLY_META, allChips } from '@/lib/plan/supply-chips'
import { colors } from '@/lib/design/colors'

const ORANGE = colors.chargeOrange // #FF7900

function Chip({ supply }: { supply: RaceWaypoint['supplies'][number] }) {
  const m = SUPPLY_META[supply]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 14, height: 14, padding: '0 3px', borderRadius: 4,
      background: m.color, color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1,
    }}>{m.letter}</span>
  )
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('fr-FR')}`
}

export interface WaypointDetailCardProps {
  waypoint: RaceWaypoint
  previous: RaceWaypoint | null
  altitude: number | null
  passageClock: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

export function WaypointDetailCard({
  waypoint, previous, altitude, passageClock, hasPrev, hasNext, onPrev, onNext,
}: WaypointDetailCardProps) {
  const chips = allChips(waypoint.supplies)
  const isBase = waypoint.supplies.includes('base_vie')
  const dPlusSeg = previous ? Math.max(0, (waypoint.dPlus ?? 0) - (previous.dPlus ?? 0)) : null
  const dMoinsSeg = previous ? Math.max(0, (waypoint.dMoins ?? 0) - (previous.dMoins ?? 0)) : null
  const ravito = chips.length ? chips.map((c) => SUPPLY_META[c].label).join(' · ') : '—'

  return (
    <div className="mt-3 rounded-[13px] border p-3"
      style={{ borderColor: '#FCE3C4', background: 'linear-gradient(180deg,#FFF4E6,var(--trail-card))' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-[3px]">{chips.map((c) => <Chip key={c} supply={c} />)}</div>
        <span className="text-[15px] font-bold text-trail-text">{waypoint.name}</span>
        {isBase && (
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-white rounded px-[7px] py-[2px]"
            style={{ background: SUPPLY_META.base_vie.color }}>Base vie</span>
        )}
        <div className="ml-auto flex gap-[6px]">
          <button type="button" aria-label="Ravito précédent" disabled={!hasPrev}
            onClick={onPrev} className="w-[26px] h-[26px] rounded-[8px] border border-trail-border bg-trail-card text-trail-muted disabled:opacity-40">‹</button>
          <button type="button" aria-label="Ravito suivant" disabled={!hasNext}
            onClick={onNext} className="w-[26px] h-[26px] rounded-[8px] border border-trail-border bg-trail-card text-trail-muted disabled:opacity-40">›</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-[7px] gap-x-[14px]">
        <Cell k="Distance" v={`km ${waypoint.km.toFixed(1).replace('.', ',')}`} />
        <Cell k="Altitude" v={altitude != null ? `${Math.round(altitude).toLocaleString('fr-FR')} m` : '—'} />
        <Cell k={previous ? `Depuis ${previous.name}` : 'Depuis le départ'}
          v={dPlusSeg != null ? `${fmtSigned(dPlusSeg)} m · ${fmtSigned(-(dMoinsSeg ?? 0))} m` : '—'} />
        <Cell k="Passage estimé" v={passageClock || '—'} />
        <Cell k="Barrière horaire" v={waypoint.cutoffRaw ?? '—'} orange={!!waypoint.cutoffRaw} />
        <Cell k="Ravitaillement" v={ravito} />
      </div>
    </div>
  )
}

function Cell({ k, v, orange }: { k: string; v: string; orange?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-trail-muted">{k}</div>
      <div className="text-[13px] font-semibold mt-[1px]" style={orange ? { color: ORANGE } : undefined}>{v}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx jest __tests__/components/plan/WaypointDetailCard.test.tsx`
Expected: PASS. Si « 1 210 » casse à cause de l'espace insécable de `toLocaleString('fr-FR')`, le test l'absorbe déjà (`/1\s?210/`).

- [ ] **Step 5: Commit**

```bash
git add web/components/plan/WaypointDetailCard.tsx web/__tests__/components/plan/WaypointDetailCard.test.tsx
git commit -m "feat(profil): fiche détail d'un ravitaillement (WaypointDetailCard)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `ElevationProfileChart.tsx` — puces empilées + sélection (branche dense)

**Files:**
- Modify: `web/components/plan/ElevationProfileChart.tsx`
- Test: `web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx` (étendre)

**Interfaces:**
- Consumes: `chartChips`, `SUPPLY_META` de `@/lib/plan/supply-chips` (Task 1) ; `WaypointSupply` de `@/types/plan` ; `colors`.
- Produces (changements de surface) :
  - `ProfileWaypoint` gagne `supplies: WaypointSupply[]` et `cutoffRaw: string | null`.
  - `Props` gagne `selectedIndex?: number | null` et `onSelectIndex?: (i: number) => void`.
  - `buildMarkers(...)` gagne `supplies` dans `DenseMarker` et un champ `stackBase: number` (Y de base de la colonne de puces, décalé pour les ravitos proches).

- [ ] **Step 1: Write the failing test** (étendre le fichier dense existant)

Mettre à jour le helper `wp()` du fichier pour inclure les nouveaux champs requis, puis ajouter les cas. En tête du `describe('ElevationProfileChart — mode dense')`, le helper devient :
```ts
const wp = (over: Partial<{ km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null; supplies: import('@/types/plan').WaypointSupply[]; cutoffRaw: string | null }>) => ({
  km: 0, name: 'P', altitude: null, dPlus: 0, dMoins: 0, supplies: [] as import('@/types/plan').WaypointSupply[], cutoffRaw: null, ...over,
})
```
Ajouter ces tests :
```ts
import { ElevationProfileChart, interpolateAlt, buildMarkers, elevationDomain } from '@/components/plan/ElevationProfileChart'

describe('buildMarkers — puces + stackBase', () => {
  it('réduit les supplies pour le graphe et calcule un stackBase', () => {
    const markers = buildMarkers(
      [{ km: 0, name: 'A', supplies: ['liquid', 'solid', 'hot'] },
       { km: 5, name: 'B', supplies: ['liquid'] }],
      { d: [0, 10], e: [1000, 2000] },
    )
    expect(markers[0].chips).toEqual(['hot'])      // chartChips réduit
    expect(markers[1].chips).toEqual(['liquid'])
    expect(typeof markers[0].stackBase).toBe('number')
  })
  it('décale le stackBase quand deux ravitos sont à moins de 6 km', () => {
    const markers = buildMarkers(
      [{ km: 0, name: 'A', supplies: ['liquid'] }, { km: 4, name: 'B', supplies: ['liquid'] }],
      { d: [0, 10], e: [1000, 2000] },
    )
    expect(markers[0].stackBase).not.toBe(markers[1].stackBase)
  })
})

describe('ElevationProfileChart — sélection', () => {
  it('rend sans crash avec un index sélectionné', () => {
    render(
      <ElevationProfileChart
        waypoints={[wp({ km: 0, name: 'Départ' }), wp({ km: 5, name: 'Col', supplies: ['liquid', 'base_vie'] })]}
        denseProfile={{ d: [0, 2.5, 5], e: [1000, 1400, 1200] }}
        hoveredIndex={null} onHoverIndex={() => {}}
        selectedIndex={1} onSelectIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Profil indisponible')).not.toBeInTheDocument()
  })
})
```
> Note : `buildMarkers` change de signature (le 1er argument gagne `supplies`). Mettre à jour le test existant `buildMarkers — place chaque waypoint…` pour passer `supplies: []` à chaque waypoint d'entrée et accepter le nouveau champ `chips`/`stackBase` (comparer les champs pertinents plutôt que `toEqual` strict).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx jest __tests__/components/plan/ElevationProfileChart.dense.test.tsx`
Expected: FAIL (champ `chips`/`stackBase` inexistant, `supplies` non accepté).

- [ ] **Step 3: Write the implementation**

Dans `ElevationProfileChart.tsx` :

(a) Imports en tête :
```ts
import type { WaypointSupply } from '@/types/plan'
import { chartChips, SUPPLY_META } from '@/lib/plan/supply-chips'
```

(b) Étendre `ProfileWaypoint` :
```ts
export interface ProfileWaypoint {
  km: number
  name: string
  altitude: number | null
  dPlus: number | null
  dMoins: number | null
  supplies: WaypointSupply[]
  cutoffRaw: string | null
}
```

(c) `DenseMarker` + `buildMarkers` (remplacer l'existant) :
```ts
export interface DenseMarker {
  km: number; alt: number; wpIndex: number; name: string
  chips: WaypointSupply[]; stackBase: number
}
const STACK_BASE_LOW = 44   // px : bas de la colonne de puces (cas normal)
const STACK_BASE_HIGH = 30  // px : décalé vers le haut pour un ravito proche du précédent
const PROXIMITY_KM = 6

export function buildMarkers(
  waypoints: { km: number; name: string; supplies: WaypointSupply[] }[],
  profile: { d: number[]; e: number[] },
): DenseMarker[] {
  return waypoints.map((w, i) => {
    const close = i > 0 && w.km - waypoints[i - 1].km < PROXIMITY_KM
    return {
      km: w.km, alt: interpolateAlt(profile.d, profile.e, w.km) ?? 0, wpIndex: i, name: w.name,
      chips: chartChips(w.supplies),
      stackBase: close ? STACK_BASE_HIGH : STACK_BASE_LOW,
    }
  })
}
```

(d) Dans la branche dense (`if (denseProfile && denseProfile.d.length >= 2)`), construire les markers avec supplies et augmenter la place en haut (margin/hauteur) pour les puces. Remplacer la construction `markers` et le conteneur :
```ts
    const markers = buildMarkers(
      waypoints.map((w) => ({ km: w.km, name: w.name, supplies: w.supplies })), denseProfile,
    )
    const ORANGE = colors.chargeOrange
    const CHIP_W = 10, CHIP_H = 10, CHIP_GAP = 1.6
    // shape custom : connecteur + colonne de puces (nourriture en haut) + point.
    const renderMarker = (p: { cx?: number; cy?: number; payload?: DenseMarker }) => {
      if (p.cx == null || p.cy == null || !p.payload) return <g />
      const m = p.payload
      const active = m.wpIndex === selectedIndex
      const hovered = m.wpIndex === hoveredIndex
      const base = m.stackBase
      // colonne empilée (chartChips déjà ordonné food, BV, A) → on inverse pour
      // poser la nourriture EN HAUT et A près du point.
      const stack = [...m.chips].reverse()
      const chipsSvg = stack.map((c, i) => {
        const w = SUPPLY_META[c].letter.length > 1 ? 13 : CHIP_W
        const y = base - (i + 1) * CHIP_H - i * CHIP_GAP
        return (
          <g key={c}>
            <rect x={p.cx! - w / 2} y={y} width={w} height={CHIP_H} rx={2.4} fill={SUPPLY_META[c].color} />
            <text x={p.cx} y={y + 7.4} fontSize={6.6} fontWeight={700} fill="#fff" textAnchor="middle">{SUPPLY_META[c].letter}</text>
          </g>
        )
      })
      return (
        <g>
          <line x1={p.cx} y1={base} x2={p.cx} y2={p.cy}
            stroke={active ? ORANGE : colors.seriesBlue} strokeWidth={active ? 1.4 : 1}
            strokeDasharray={active ? '3 3' : undefined} opacity={active ? 0.8 : 0.4} />
          {chipsSvg}
          <circle cx={p.cx} cy={p.cy} r={active ? 6 : hovered ? 4.5 : 3}
            fill={active ? ORANGE : colors.seriesBlue} stroke="#fff" strokeWidth={active ? 2 : 1} />
        </g>
      )
    }
```
Augmenter la hauteur et la marge haute de la branche dense (réserver la place des puces). Remplacer `<div style={{ width: '100%', height: 180 }} …>` par `height: 230` et le `<ComposedChart … margin={{ top: 8, … }}>` par `margin={{ top: 50, right: 8, left: -8, bottom: 0 }}`. Ajouter le clic sur le Scatter :
```tsx
            <Scatter data={markers} dataKey="alt" shape={renderMarker}
              onClick={(d: any) => onSelectIndex?.(d?.wpIndex ?? d?.payload?.wpIndex)}
              onMouseEnter={(d: any) => onHoverIndex(d?.wpIndex ?? d?.payload?.wpIndex ?? null)}
              onMouseLeave={() => onHoverIndex(null)} />
```

(e) Mettre à jour la signature `Props` et la déstructuration :
```ts
type Props = {
  waypoints: ProfileWaypoint[]
  denseProfile?: { d: number[]; e: number[] }
  hoveredIndex: number | null
  onHoverIndex: (i: number | null) => void
  selectedIndex?: number | null
  onSelectIndex?: (i: number) => void
}
export function ElevationProfileChart({ waypoints, denseProfile, hoveredIndex, onHoverIndex, selectedIndex = null, onSelectIndex }: Props) {
```

> La branche escalier et `buildProfileData` ne lisent pas `supplies`/`cutoffRaw` : aucun changement de comportement hors dense.

- [ ] **Step 4: Run tests (dense + non-régression escalier)**

Run: `cd web && npx jest __tests__/components/plan/ElevationProfileChart.dense.test.tsx __tests__/components/plan/ElevationProfileChart.test.tsx`
Expected: PASS. Mettre à jour le `wp()` du test escalier (`ElevationProfileChart.test.tsx`) si TypeScript exige `supplies`/`cutoffRaw` (ajouter `supplies: [], cutoffRaw: null` à son constructeur de waypoint).

- [ ] **Step 5: Commit**

```bash
git add web/components/plan/ElevationProfileChart.tsx web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx web/__tests__/components/plan/ElevationProfileChart.test.tsx
git commit -m "feat(profil): puces ravito empilées + point sélectionné (graphe dense)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `WaypointsTable.tsx` — sélection au tap d'une ligne

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx`
- Test: `web/__tests__/components/plan/WaypointsTable.selection.test.tsx` (créer)

**Interfaces:**
- Produces : `Props` gagne `selectedIndex?: number | null` et `onSelectIndex?: (i: number) => void`. Tap sur le conteneur de ligne (celui qui porte déjà `onMouseEnter`/`onMouseLeave`) → `onSelectIndex?.(i)`. La `div.gA.row` reçoit la classe `sel` quand `selectedIndex === i`.

- [ ] **Step 1: Write the failing test**

`web/__tests__/components/plan/WaypointsTable.selection.test.tsx` :
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>
const rows: WP[] = [
  { orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, altitude: null, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
  { orderIndex: 1, name: 'Ravito 1', km: 10, kmInter: null, dPlus: 300, dMoins: 50, altitude: null, cutoffRaw: null, cutoffKind: null, type: 'ravito', supplies: ['liquid'], targetOverrideSec: null },
]

it('tap sur une ligne appelle onSelectIndex avec son index', () => {
  const onSelectIndex = jest.fn()
  render(<WaypointsTable waypoints={rows} onChange={() => {}} selectedIndex={null} onSelectIndex={onSelectIndex} />)
  fireEvent.click(screen.getByText('Ravito 1'))
  expect(onSelectIndex).toHaveBeenCalledWith(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx jest __tests__/components/plan/WaypointsTable.selection.test.tsx`
Expected: FAIL (`onSelectIndex` jamais appelé / prop inconnue).

- [ ] **Step 3: Write the implementation**

Dans l'interface `Props` de `WaypointsTable.tsx` (après `onHoverIndex`) :
```ts
  // Sélection unifiée avec le profil (optionnel).
  selectedIndex?: number | null
  onSelectIndex?: (i: number) => void
```
Dans la déstructuration des props du composant (à côté de `hoveredIndex, onHoverIndex,`) ajouter `selectedIndex, onSelectIndex,`.
Sur le conteneur de ligne qui porte déjà `onMouseEnter={() => onHoverIndex?.(i)}` / `onMouseLeave`, ajouter le tap :
```tsx
            onClick={() => onSelectIndex?.(i)}
```
Sur la `div className={`gA row${hoveredIndex === i ? ' hl' : ''}`}` ajouter l'état sélectionné :
```tsx
            <div className={`gA row${hoveredIndex === i ? ' hl' : ''}${selectedIndex === i ? ' sel' : ''}`}>
```
Dans le bloc `<style jsx>` du composant, à côté de `.wtbl .gA.row.hl{…}`, ajouter :
```css
        .wtbl .gA.row.sel{box-shadow:inset 3px 0 0 var(--orange);border-radius:6px;}
```
> Garde-fou : les `onClick` internes existants (édition ravito, suppression de ligne) appellent `e.stopPropagation()` n'est pas nécessaire — ils sont sur des éléments enfants ; vérifier au test que le tap sur le **nom** déclenche bien la sélection (cas couvert). Si un bouton enfant remontait par bouillonnement, ajouter `e.stopPropagation()` sur ce bouton.

- [ ] **Step 4: Run tests (sélection + non-régression table)**

Run: `cd web && npx jest __tests__/components/plan/WaypointsTable.selection.test.tsx __tests__/components/plan/WaypointsTable.altitude.test.tsx __tests__/components/plan/WaypointsTable.undo.test.tsx`
Expected: PASS (les suites existantes ne passent pas `selectedIndex`/`onSelectIndex` → props optionnelles, aucun impact).

- [ ] **Step 5: Commit**

```bash
git add web/components/plan/WaypointsTable.tsx web/__tests__/components/plan/WaypointsTable.selection.test.tsx
git commit -m "feat(profil): sélection d'une ligne du tableau (tap → onSelectIndex)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `CoursePageClient.tsx` — intégration (état, passages, câblage, fiche)

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

**Interfaces:**
- Consumes: `passageClocks` (Task 2), `WaypointDetailCard` (Task 3), les nouvelles props de `ElevationProfileChart` (Task 4) et `WaypointsTable` (Task 5).
- Pas de nouvelle interface produite ; tâche d'intégration. Vérification = `tsc` + build + tests des suites touchées + revue visuelle.

- [ ] **Step 1: Ajouter les imports + l'état**

En tête de fichier, ajouter :
```ts
import { useMemo } from 'react'
import { WaypointDetailCard } from '@/components/plan/WaypointDetailCard'
import { passageClocks } from '@/lib/plan/passage-clock'
import { interpolateAlt } from '@/components/plan/ElevationProfileChart'
```
(`useMemo` s'ajoute à l'import `react` existant.)
Après `const [hoveredWaypointIndex, …]`, ajouter :
```ts
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number>(0)
```

- [ ] **Step 2: Initialiser la sélection au 1er ravito quand les waypoints chargent**

Après le `useEffect(() => { void reload() }, [reload])` existant, ajouter :
```ts
  // Sélection par défaut = 1er ravito (sinon 1er point après le départ, sinon 0).
  useEffect(() => {
    if (waypoints.length === 0) return
    const firstRavito = waypoints.findIndex((w) => w.type === 'ravito')
    setSelectedWaypointIndex(firstRavito >= 0 ? firstRavito : Math.min(1, waypoints.length - 1))
  }, [waypoints.length])
```

- [ ] **Step 3: Calculer les heures de passage (mémoïsé)**

Avant le `return (`, ajouter :
```ts
  const passages = useMemo(() => passageClocks(
    waypoints.map(({ km, dPlus, targetOverrideSec }) => ({ km, dPlus, targetOverrideSec })),
    {
      startTime: race?.startTime ?? null,
      totalDurationSec: race?.targetDurationMin != null ? race.targetDurationMin * 60 : null,
      fade: race?.pacingFade ?? 0,
      startDateIso: meta?.editionDate ?? race?.date ?? null,
    },
  ), [waypoints, race?.startTime, race?.targetDurationMin, race?.pacingFade, meta?.editionDate, race?.date])
```

- [ ] **Step 4: Câbler le tableau (sélection unifiée)**

Sur `<WaypointsTable …>` ajouter :
```tsx
              selectedIndex={selectedWaypointIndex}
              onSelectIndex={setSelectedWaypointIndex}
```

- [ ] **Step 5: Câbler le graphe + rendre la fiche (mode dense)**

Remplacer le bloc `<ElevationProfileChart … />` (rendu quand `waypoints.length > 0`) par :
```tsx
          <>
            <ElevationProfileChart
              waypoints={waypoints.map(({ km, name, altitude, dPlus, dMoins, supplies, cutoffRaw }) =>
                ({ km, name, altitude, dPlus, dMoins, supplies, cutoffRaw }))}
              denseProfile={track?.profile}
              hoveredIndex={hoveredWaypointIndex}
              onHoverIndex={setHoveredWaypointIndex}
              selectedIndex={selectedWaypointIndex}
              onSelectIndex={setSelectedWaypointIndex}
            />
            {track && waypoints[selectedWaypointIndex] && (
              <WaypointDetailCard
                waypoint={waypoints[selectedWaypointIndex]}
                previous={selectedWaypointIndex > 0 ? waypoints[selectedWaypointIndex - 1] : null}
                altitude={interpolateAlt(track.profile.d, track.profile.e, waypoints[selectedWaypointIndex].km)}
                passageClock={passages[selectedWaypointIndex] ?? ''}
                hasPrev={selectedWaypointIndex > 0}
                hasNext={selectedWaypointIndex < waypoints.length - 1}
                onPrev={() => setSelectedWaypointIndex((i) => Math.max(0, i - 1))}
                onNext={() => setSelectedWaypointIndex((i) => Math.min(waypoints.length - 1, i + 1))}
              />
            )}
          </>
```
> La fiche n'apparaît qu'en mode dense (`track` présent), conforme au périmètre.

- [ ] **Step 6: Vérifier types + non-régression**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (aucune erreur). Puis :
Run: `cd web && npx jest __tests__/components/plan/ElevationProfileChart.dense.test.tsx __tests__/components/plan/WaypointsTable.selection.test.tsx __tests__/lib/plan/supply-chips.test.ts __tests__/lib/plan/passage-clock.test.ts __tests__/components/plan/WaypointDetailCard.test.tsx`
Expected: toutes PASS.

- [ ] **Step 7: Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(profil): câblage fiche détail + sélection unifiée (mode dense)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes de fin

- **Revue visuelle** (Franck, après implémentation) : ré-importer une course UTMB (trace dense) → puces réduites empilées, fiche sous le graphe, tap point/ligne synchronise la sélection, ‹ › navigue, passage estimé + barrière corrects. Vérifier qu'une course LiveTrail sans trace (escalier) est **inchangée**.
- **Densité** : `STACK_BASE_HIGH`/`PROXIMITY_KM` gèrent les paires proches ; ajuster si un cas réel reste gênant.
- **Mettre à jour la spec** : ajouter le bandeau `> **Status: Implémenté** · 2026-06-22 · Code: web/components/plan/…` en tête de `2026-06-22-profil-course-fiche-detail-design.md` une fois livré.
