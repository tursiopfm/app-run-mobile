# Cockpit Mission — redesign A « Glass Cockpit » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Appliquer le design A validé (maquette `Prompts/cockpit-mission-blocs-v2-mockups.html`) à l'écran Cockpit Mission : cadran de forme avec `TsbBadge` cliquable → `FreshnessHelpSheet`, bouton « Objectif » (saisie partagée avec le `GoalsBlock` Expert), bloc Objectif 3 barres (semaine + année verte avec projection), Sessions de la semaine (activités réalisées), Cumul via `CockpitCumulChart` avec bascule Mois ⇄ Année. Spec : section « Écran Cockpit » de `web/docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md`.

**Architecture:** On réutilise au maximum l'Expert : `TsbBadge` (`components/ui/TsbBadge.tsx`), `FreshnessHelpSheet` (`components/ui/FreshnessHelpSheet.tsx`), `kpiStatusFreshness` (`lib/analytics/charge-kpi-status.ts`), `CockpitCumulChart` (`components/charts/CockpitCumulChart.tsx`, props `{months: MonthSeries[], height?, mode?: 'month'|'year'}`), stockage objectifs = localStorage `cockpit_goals_targets` (shape `Partial<Record<SportKey, Partial<{weekKm,weekDPlus,yearKm}>>>`, cf. `GoalsBlock.tsx:18-28,53-59`). Nouvelle logique pure dans `lib/mission/goals.ts`. Branche : `feat/mode-mission-v2`.

**Conventions:** identiques au plan Mission v2 (cd absolu vers web/ pour npx, `--verbose` jamais `-v`, git -C racine, pas de push, pas de next build, suites ciblées uniquement). Titres de blocs = police brand : `font-display text-[15px] font-semibold text-trail-muted`.

---

### Task 1: Objectifs & projection (`lib/mission/goals.ts`)

**Files:** Create `web/lib/mission/goals.ts` · Test `web/__tests__/lib/mission/goals.test.ts`

- [ ] **Step 1: test qui échoue**

```ts
// web/__tests__/lib/mission/goals.test.ts
import { readMissionGoals, saveMissionGoals, yearElapsedFraction, projectYearKm, GOALS_TARGETS_KEY } from '@/lib/mission/goals'

beforeEach(() => window.localStorage.clear())

describe('read/saveMissionGoals', () => {
  it('round-trip en préservant les autres sports et champs', () => {
    window.localStorage.setItem(GOALS_TARGETS_KEY, JSON.stringify({ ride: { weekKm: 120 }, run: { yearKm: 1500 } }))
    saveMissionGoals('run', { weekKm: 50, weekDPlus: 2000 })
    expect(readMissionGoals('run')).toEqual({ weekKm: 50, weekDPlus: 2000, yearKm: 1500 })
    expect(JSON.parse(window.localStorage.getItem(GOALS_TARGETS_KEY)!).ride).toEqual({ weekKm: 120 })
  })
  it('vide → {}', () => { expect(readMissionGoals('run')).toEqual({}) })
})

describe('yearElapsedFraction', () => {
  it('1er janvier ≈ 1/365, 2 juillet 2026 = 183/365', () => {
    expect(yearElapsedFraction('2026-01-01')).toBeCloseTo(1 / 365, 5)
    expect(yearElapsedFraction('2026-07-02')).toBeCloseTo(183 / 365, 5)
  })
})

describe('projectYearKm', () => {
  it('extrapole le YTD sur l’année (arrondi à 10 km)', () => {
    // 12 juin 2026 = jour 163 → 996 / (163/365) ≈ 2230
    expect(projectYearKm(996, '2026-06-12')).toBe(2230)
  })
  it('0 km ou tout début d’année → null (pas de projection délirante)', () => {
    expect(projectYearKm(0, '2026-06-12')).toBeNull()
    expect(projectYearKm(50, '2026-01-05')).toBeNull() // moins de 14 jours écoulés
  })
})
```

- [ ] **Step 2: FAIL** — `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/goals.test.ts --verbose`

- [ ] **Step 3: implémenter**

```ts
// web/lib/mission/goals.ts
// Objectifs hebdo/année du Mode Mission — MÊME stockage que le GoalsBlock Expert
// (localStorage cockpit_goals_targets) : un objectif saisi en Mission est visible
// en Expert et inversement.

import type { SportKey } from '@/lib/design/sports'

export const GOALS_TARGETS_KEY = 'cockpit_goals_targets'

export type MissionGoals = { weekKm?: number; weekDPlus?: number; yearKm?: number }

type Store = Partial<Record<SportKey, MissionGoals>>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(GOALS_TARGETS_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch { return {} }
}

export function readMissionGoals(sport: SportKey): MissionGoals {
  return readStore()[sport] ?? {}
}

export function saveMissionGoals(sport: SportKey, goals: MissionGoals): void {
  const store = readStore()
  store[sport] = { ...store[sport], ...goals }
  window.localStorage.setItem(GOALS_TARGETS_KEY, JSON.stringify(store))
}

const MS_DAY = 86_400_000

// Fraction de l'année écoulée (jour courant inclus), années bissextiles gérées.
export function yearElapsedFraction(todayISO: string): number {
  const d = new Date(`${todayISO}T00:00:00Z`)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  const end = Date.UTC(d.getUTCFullYear() + 1, 0, 1)
  const day = Math.floor((d.getTime() - start) / MS_DAY) + 1
  return day / Math.round((end - start) / MS_DAY)
}

// Projection fin d'année sur le rythme actuel, arrondie à 10 km.
// null si données trop maigres (< 14 jours écoulés ou ytd nul).
export function projectYearKm(ytdKm: number, todayISO: string): number | null {
  const frac = yearElapsedFraction(todayISO)
  if (ytdKm <= 0 || frac < 14 / 365) return null
  return Math.round(ytdKm / frac / 10) * 10
}
```

- [ ] **Step 4: PASS** puis commit `feat(mission): objectifs partagés Expert + projection annuelle`

---

### Task 2: État de forme v2 (cadran + TsbBadge → FreshnessHelpSheet)

**Files:** Modify `web/components/mission/FormeCard.tsx` (réécriture), `web/components/mission/cards.tsx` (style titre brand), Test `web/__tests__/components/mission/FormeCard.test.tsx` (create)

- [ ] **Step 1: `cards.tsx`** — `MissionCardLabel` passe au style brand Expert :

```tsx
export function MissionCardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] font-semibold text-trail-muted font-display leading-none">
      {children}
    </p>
  )
}
```
(Plus d'uppercase/tracking — tous les écrans Mission héritent du titre brand.)

- [ ] **Step 2: réécrire FormeCard**

```tsx
// web/components/mission/FormeCard.tsx
'use client'

// État de forme (design A) : cadran à aiguille + TsbBadge cliquable qui ouvre
// la fenêtre Expert « Fraîcheur — que faire ? » (FreshnessHelpSheet).

import { useState } from 'react'
import { MissionCard, MissionCardLabel } from './cards'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'
import { cursorPctFromTsb, formeVerdict } from '@/lib/mission/forme-verdict'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'

// Aiguille du cadran : pct 0..100 → angle 180..0° (demi-cercle gauche → droite).
function needleTip(pct: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = Math.PI * (1 - pct / 100)
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

export function FormeCard({ payload }: { payload: ChargeSportPayload }) {
  const t = useT()
  const M = t.mission
  const C = t.charge
  const [showHelp, setShowHelp] = useState(false)
  const f = computeFreshness(payload.dailyMetrics)
  const verdict = formeVerdict(f.zone)
  const { id } = kpiStatusFreshness(Math.round(f.tsb))
  const tip = needleTip(cursorPctFromTsb(f.tsb), 70, 78, 48)

  const delta = Math.round(f.deltaVsWeekAgo)
  const qualifier = delta > 1 ? C.freshnessDeltaFresher : delta < -1 ? C.freshnessDeltaTired : C.freshnessDeltaStable

  return (
    <MissionCard>
      <div className="flex items-center justify-between">
        <MissionCardLabel>{M.formeTitle}</MissionCardLabel>
        <TsbBadge tsb={f.tsb} onClick={() => setShowHelp(true)} />
      </div>
      <div className="flex items-center gap-3.5 mt-2">
        <svg viewBox="0 0 140 86" width="146" aria-hidden>
          <path d="M14,76 A60 60 0 0 1 33.5,32" fill="none" stroke="var(--status-danger)" strokeWidth="7" strokeLinecap="round" opacity=".8" />
          <path d="M38,28 A60 60 0 0 1 70,16" fill="none" stroke="var(--status-warning)" strokeWidth="7" strokeLinecap="round" opacity=".85" />
          <path d="M76,16 A60 60 0 0 1 104,27" fill="none" stroke="var(--status-success)" strokeWidth="7" strokeLinecap="round" opacity=".9" />
          <path d="M109,31 A60 60 0 0 1 122,46" fill="none" stroke="var(--status-info)" strokeWidth="7" strokeLinecap="round" />
          <path d="M124.5,51 A60 60 0 0 1 126,76" fill="none" stroke="#7DD3FC" strokeWidth="7" strokeLinecap="round" />
          <line x1="70" y1="78" x2={tip.x} y2={tip.y} stroke="var(--trail-text)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="70" cy="78" r="5" fill="var(--ink-500)" stroke="var(--trail-text)" strokeWidth="1.5" />
        </svg>
        <div className="flex-1">
          <p className="font-display font-bold text-[34px] leading-none tabular-nums text-trail-text">{Math.round(f.tsb)}</p>
          <p className="text-[11px] mt-1.5 text-trail-muted">
            <b style={{ color: delta > 1 ? 'var(--status-success)' : delta < -1 ? 'var(--status-danger)' : 'var(--trail-muted)' }}>
              {delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '→ '}{delta !== 0 ? delta : ''}
            </b>{' '}{M.formeDeltaSuffix} · {qualifier}
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed mt-2 text-trail-muted">
        <span className="font-bold" style={{ color: verdict.tone === 'adapt' ? 'var(--status-warning)' : 'var(--status-success)' }}>
          {M.formeVerdict[f.zone]}
        </span>
      </p>
      {showHelp && <FreshnessHelpSheet currentId={id} onClose={() => setShowHelp(false)} />}
    </MissionCard>
  )
}
```

i18n : ajouter `formeDeltaSuffix: 'vs il y a 7 j'` (fr) / `'vs 7 days ago'` (en) dans la section `mission` (type + 2 dicts) ; vérifier que `freshnessDeltaFresher/Tired/Stable` existent dans `charge` (utilisés par `FreshnessCard.tsx:32-34`). Supprimer de `mission` les clés devenues mortes (`formeScale`, `formeBadge`) **dans cette task** (type + fr + en) — `formeVerdict` reste.

- [ ] **Step 3: test FormeCard** (mock léger) :

```tsx
// web/__tests__/components/mission/FormeCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FormeCard } from '@/components/mission/FormeCard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

// dailyMetrics minimal : dernier point tsb -12, 8 points pour le delta
const metrics = Array.from({ length: 8 }, (_, i) => ({ date: `2026-06-0${i + 1}`, atl: 60, ctl: 48, tsb: i === 7 ? -12 : -15 }))
const payload = { dailyMetrics: metrics } as unknown as ChargeSportPayload

it('badge cliquable → ouvre la fenêtre « Fraîcheur — que faire ? »', () => {
  render(<I18nProvider initialLang="fr"><FormeCard payload={payload} /></I18nProvider>)
  expect(screen.getByText('−12')).toBeInTheDocument()           // NB: vérifier le rendu réel (- vs −) et adapter
  fireEvent.click(screen.getByText('Légère fatigue'))
  expect(screen.getByText('Fraîcheur — que faire ?')).toBeInTheDocument()
})
```
(Adapter : `Math.round(-12)` rend `-12` avec tiret ASCII — corriger l'assertion selon le DOM réel. Si `DailyMetrics` exige d'autres champs, compléter le factory. Si `KpiHelpSheet` utilise un portal, utiliser `screen.getByText` quand même — RTL voit les portals.)

- [ ] **Step 4: PASS + tsc + suites mission existantes** (MissionCockpit/MissionPlan/MissionActivities doivent rester vertes — le changement de `MissionCardLabel` ne casse que du style). Commit `feat(mission): état de forme v2 — cadran + badge TsbBadge → fenêtre Fraîcheur`.

---

### Task 3: Bouton « Objectif » + bloc Objectif (3 barres + projection)

**Files:** Create `web/components/mission/GoalsModal.tsx`, `web/components/mission/ObjectifCard.tsx` · Modify `web/components/mission/MissionCockpit.tsx` · Test `web/__tests__/lib/mission/goals.test.ts` (déjà fait) + `web/__tests__/components/mission/ObjectifCard.test.tsx` (create)

- [ ] **Step 1: GoalsModal** — modal de saisie, pattern visuel des modals existants (s'inspirer de `SportSettingsModal` pour l'overlay) :

```tsx
// web/components/mission/GoalsModal.tsx
'use client'

import { useState } from 'react'
import { readMissionGoals, saveMissionGoals, type MissionGoals } from '@/lib/mission/goals'
import type { SportKey } from '@/lib/design/sports'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = { sport: SportKey; defaults: { weekKm?: number; weekDPlus?: number }; onClose: () => void; onSaved: () => void }

export function GoalsModal({ sport, defaults, onClose, onSaved }: Props) {
  const M = useT().mission
  const current = readMissionGoals(sport)
  const [weekKm, setWeekKm] = useState(String(current.weekKm ?? defaults.weekKm ?? ''))
  const [weekDPlus, setWeekDPlus] = useState(String(current.weekDPlus ?? defaults.weekDPlus ?? ''))
  const [yearKm, setYearKm] = useState(String(current.yearKm ?? ''))

  function save() {
    const goals: MissionGoals = {}
    if (weekKm.trim() !== '' && Number(weekKm) > 0) goals.weekKm = Number(weekKm)
    if (weekDPlus.trim() !== '' && Number(weekDPlus) > 0) goals.weekDPlus = Number(weekDPlus)
    goals.yearKm = yearKm.trim() !== '' && Number(yearKm) > 0 ? Number(yearKm) : undefined
    saveMissionGoals(sport, goals)
    onSaved(); onClose()
  }

  const row = 'flex items-center justify-between gap-3 rounded-[10px] border border-trail-border bg-trail-bg px-3 py-2.5 text-[13px]'
  const input = 'w-24 bg-transparent text-right font-display font-bold tabular-nums text-trail-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[16px] bg-trail-card border border-trail-border p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold text-trail-muted font-display">{M.goalsModalTitle}</p>
          <button onClick={onClose} className="text-trail-muted text-[16px]" aria-label="Fermer">✕</button>
        </div>
        <div className="space-y-2">
          <label className={row}><span className="text-trail-muted">{M.goalsWeekKm}</span>
            <span><input className={input} inputMode="numeric" value={weekKm} onChange={e => setWeekKm(e.target.value)} /> <span className="text-trail-muted">km</span></span></label>
          <label className={row}><span className="text-trail-muted">{M.goalsWeekDPlus}</span>
            <span><input className={input} inputMode="numeric" value={weekDPlus} onChange={e => setWeekDPlus(e.target.value)} /> <span className="text-trail-muted">m</span></span></label>
          <label className={row}><span className="text-trail-muted">{M.goalsYearKm}</span>
            <span><input className={input} inputMode="numeric" value={yearKm} onChange={e => setYearKm(e.target.value)} placeholder="—" /> <span className="text-trail-muted">km</span></span></label>
        </div>
        <p className="text-[10px] mt-2.5 leading-relaxed text-trail-muted">{M.goalsYearEmptyHint}</p>
        <div className="flex justify-end gap-3 mt-3.5 text-[12px] font-bold">
          <button onClick={onClose} className="text-trail-muted px-2 py-1.5">{M.goalsCancel}</button>
          <button onClick={save} className="rounded-full px-4 py-1.5" style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}>{M.goalsSave}</button>
        </div>
      </div>
    </div>
  )
}
```

NB : `saveMissionGoals` merge avec spread — pour pouvoir EFFACER `yearKm`, modifier `saveMissionGoals` (Task 1, petite retouche + test) : une valeur `undefined` explicite supprime la clé (`if (v === undefined) delete merged[k]`). Ajuster le test round-trip en conséquence.

- [ ] **Step 2: ObjectifCard**

```tsx
// web/components/mission/ObjectifCard.tsx
'use client'

// Bloc « Objectif » (design A) : 3 barres avec repère « attendu aujourd'hui ».
// Semaine = override user sinon cible du plan ; année = objectif saisi sinon projection.

import { MissionCard, MissionCardLabel, CapGauge } from './cards'
import { yearElapsedFraction, projectYearKm, type MissionGoals } from '@/lib/mission/goals'
import { expectedWeekFraction, type MissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  goals: MissionGoals
  planTarget: MissionWeeklyTarget | null
  weekKm: number; weekDPlus: number; ytdKm: number
  todayISO: string
}

function Row({ label, value, target, color, markerPct, projected = false }: {
  label: string; value: string; target: string; color: string; markerPct: number; projected?: boolean
}) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="text-trail-muted">{label}</span>
        <span className="font-display font-bold tabular-nums text-trail-text">
          <span style={{ color }}>{value}</span> <span className="text-trail-muted">{target}</span>
        </span>
      </div>
      {/* projection : barre semi-transparente, pas de repère */}
      <div style={projected ? { opacity: .75 } : undefined}>
        <CapGauge pct={0} markerPct={markerPct} color={color} />
      </div>
    </div>
  )
}
```

⚠️ Le squelette ci-dessus est volontairement incomplet sur le rendu des barres : implémenter ainsi —
- réutiliser `CapGauge` tel quel pour les 3 barres **en lui passant le vrai `pct`** (le `Row` ci-dessus doit prendre `pct: number` et le transmettre ; corriger la signature en conséquence) ;
- barre 1 : `label=M.goalsWeekKmLabel`, pct = weekKm/cible*100, couleur `var(--primary)`, marker = `expectedWeekFraction(todayISO)*100` ;
- barre 2 : D+ semaine, couleur `var(--status-info)`, même marker ;
- barre 3 : année — si `goals.yearKm` : pct = ytdKm/yearKm*100, couleur `var(--status-success)`, marker = `yearElapsedFraction(todayISO)*100`, valeur `« 996 / 2 000 km »` ; sinon projection : `projectYearKm(ytdKm, todayISO)` → texte `« 996 km → ~2 230 fin d'année »`, barre verte remplie à `yearElapsedFraction*100` SANS marker + note micro `M.goalsProjectionNote` avec lien `M.goalsDefine` (ouvre la modal via prop `onEditGoals?: () => void`) ; si projection null → ne pas afficher la barre année.
- cibles semaine : `goals.weekKm ?? planTarget?.km`, `goals.weekDPlus ?? planTarget?.dPlus` ; si l'une des deux n'a pas de cible, masquer sa barre ; si AUCUNE barre n'a de cible, le composant rend `null` (le parent gère).
- hint sous les barres : `M.capMarkerHint` (réutilisée, reformulée « Repère ┃ = attendu aujourd'hui. ») + `M.capOnTrack`/`M.capBehind` selon barre 1 (logique reprise de l'ancien Cap : `volPct >= frac*100 - 15`).

- [ ] **Step 3: MissionCockpit** — header « Ma semaine » : bouton `Objectif` (style `pill` : `text-[11px] font-bold rounded-full px-2.5 py-[3px] border`, `borderColor/color var(--primary)`) ouvrant `GoalsModal` (state local + `goalsVersion` incrémenté dans `onSaved` pour re-render). Remplacer le bloc `{target && <MissionCard>…Cap…}` par `<ObjectifCard …/>` alimenté par `readMissionGoals(sport)` (relu à chaque `goalsVersion`), `target` (plan), `o.weekKm/weekDPlus/ytdKm`, `todayISO()`. `defaults` de la modal = `planTarget`.

- [ ] **Step 4: test ObjectifCard**

```tsx
// web/__tests__/components/mission/ObjectifCard.test.tsx
import { render, screen } from '@testing-library/react'
import { ObjectifCard } from '@/components/mission/ObjectifCard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const base = { weekKm: 28, weekDPlus: 1240, ytdKm: 996, todayISO: '2026-06-12', planTarget: null }

it('objectif annuel défini → barre année avec cible', () => {
  render(<I18nProvider initialLang="fr"><ObjectifCard {...base} goals={{ weekKm: 50, weekDPlus: 2000, yearKm: 2000 }} /></I18nProvider>)
  expect(screen.getByText(/2 000 km/)).toBeInTheDocument()
})

it('sans objectif annuel → projection ~2 230', () => {
  render(<I18nProvider initialLang="fr"><ObjectifCard {...base} goals={{ weekKm: 50 }} /></I18nProvider>)
  expect(screen.getByText(/2 230/)).toBeInTheDocument()
})

it('aucune cible → rend null', () => {
  const { container } = render(<I18nProvider initialLang="fr"><ObjectifCard {...base} ytdKm={0} goals={{}} /></I18nProvider>)
  expect(container.firstChild).toBeNull()
})
```
(Adapter les regex aux libellés i18n réellement ajoutés ; espaces insécables de `toLocaleString('fr-FR')` : utiliser `screen.getByText((t) => t.replace(/ | /g, ' ').includes('2 230'))` si besoin.)

- [ ] **Step 5: i18n** — ajouter à `mission` (type fr.ts + fr + en) : `goalsButton: 'Objectif'/'Goal'`, `goalsModalTitle: 'Mes objectifs'/'My goals'`, `goalsWeekKm: 'Semaine · volume'`, `goalsWeekDPlus: 'Semaine · dénivelé'`, `goalsYearKm: 'Année · volume'`, `goalsYearEmptyHint: 'Année vide ? Le bloc affichera la projection fin d\'année calculée sur ton rythme actuel.'`, `goalsCancel: 'Annuler'`, `goalsSave: 'Enregistrer'`, `objectifTitle: 'Objectif'/'Goal'`, `goalsYearLabel: 'Année · volume'`, `goalsProjLabel: 'Année · projection'`, `goalsProjectionNote`, `goalsDefine: 'Définir →'`. Reformuler `capMarkerHint` → `'Repère ┃ = attendu aujourd\'hui.'` (en : `'Marker ┃ = expected today.'`). Renommer l'usage du titre : le bloc utilise `objectifTitle` (supprimer `capTitle`/`capPhasePrefix`/`capVolume`/`capDplus` SI plus utilisés après refonte — vérifier par grep, sinon les garder).

- [ ] **Step 6: PASS (goals + ObjectifCard + MissionCockpit) + tsc**. Commit `feat(mission): bloc Objectif 3 barres + saisie partagée avec l'Expert`.

---

### Task 4: Sessions de la semaine + Cumul Mois⇄Année + assemblage final

**Files:** Create `web/components/mission/SessionsSemaineCard.tsx`, `web/components/mission/CumulCard.tsx` · Modify `web/components/mission/MissionCockpit.tsx`, `web/app/(main)/dashboard/page.tsx` (prop `weekActivities`) · Test: étendre `web/__tests__/components/mission/MissionCockpit.test.tsx`

- [ ] **Step 1: SessionsSemaineCard**

```tsx
// web/components/mission/SessionsSemaineCard.tsx
'use client'

// Sessions réalisées de la semaine (liste éditoriale, reprise de la maquette B).

import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { useT } from '@/lib/i18n/I18nProvider'

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function dist(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function elev(a: ActivityRow): number { return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0) }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }
function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export function SessionsSemaineCard({ activities }: { activities: ActivityRow[] }) {
  const M = useT().mission
  if (activities.length === 0) return null
  // start_time = heure locale étiquetée UTC → getters UTC.
  const rows = [...activities].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const totKm = rows.reduce((s, a) => s + dist(a), 0)
  const totDp = rows.reduce((s, a) => s + elev(a), 0)
  const totSec = rows.reduce((s, a) => s + durSec(a), 0)
  return (
    <MissionCard>
      <div className="mb-1.5"><MissionCardLabel>{M.sessionsTitle}</MissionCardLabel></div>
      <div className="text-[13px]">
        {rows.map((a, i) => (
          <Link key={a.id} href={`/activities/${a.id}`}
                className={`flex items-center justify-between py-[7px] ${i < rows.length - 1 ? 'border-b border-trail-border' : ''}`}>
            <span className="w-9 text-trail-muted">{DAYS[new Date(a.start_time).getUTCDay()]}</span>
            <span className="flex-1 truncate pr-2 text-trail-text">{a.name}</span>
            <span className="font-semibold tabular-nums text-trail-text">
              {dist(a).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · <span style={{ color: 'var(--status-info)' }}>{elev(a)} m</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="flex justify-around mt-1.5 pt-2 border-t border-trail-border">
        <span className="font-display font-bold text-[13px] tabular-nums" style={{ color: 'var(--primary)' }}>
          {Math.round(totKm)} <span className="text-[9px] font-normal text-trail-muted">km</span></span>
        <span className="font-display font-bold text-[13px] tabular-nums" style={{ color: 'var(--status-info)' }}>
          {totDp.toLocaleString('fr-FR')} <span className="text-[9px] font-normal text-trail-muted">m D+</span></span>
        <span className="font-display font-bold text-[13px] tabular-nums text-trail-text">{fmtDur(totSec)}</span>
      </div>
    </MissionCard>
  )
}
```

- [ ] **Step 2: CumulCard**

```tsx
// web/components/mission/CumulCard.tsx
'use client'

// Cumul km par mois (3 derniers + courant) avec bascule Année ⇄ Mois.
// Réutilise le chart Expert (valeurs de fin de courbe + infobulle incluses).

import { useState } from 'react'
import { MissionCard, MissionCardLabel } from './cards'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import type { SportOverview } from '@/lib/data/dashboard'
import { useT } from '@/lib/i18n/I18nProvider'

export function CumulCard({ overview }: { overview: SportOverview }) {
  const M = useT().mission
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const months = period === 'month' ? overview.cumulMonths : overview.cumulYears
  if (!months || months.length === 0) return null
  return (
    <MissionCard>
      <div className="flex items-center justify-between mb-2">
        <MissionCardLabel>{period === 'month' ? M.cumulTitleMonth : M.cumulTitleYear}</MissionCardLabel>
        <button
          type="button"
          onClick={() => setPeriod(p => (p === 'month' ? 'year' : 'month'))}
          className="text-[11px] font-bold rounded-full px-2.5 py-[3px] border"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary-text)' }}
        >
          {period === 'month' ? M.cumulToYear : M.cumulToMonth}
        </button>
      </div>
      <CockpitCumulChart months={months} mode={period} height={200} />
    </MissionCard>
  )
}
```
Vérifier les props réelles de `CockpitCumulChart` (`web/components/charts/CockpitCumulChart.tsx:63` : `{ months, height = 220, mode = 'month' }`) et comment l'Expert limite aux derniers mois (regarder comment `CumulBlock` passe `cumulMonths` — si le slice des 4 derniers mois est déjà fait dans `dashboard.ts`, ne rien faire ; sinon répliquer le slice de l'Expert).

- [ ] **Step 3: assemblage MissionCockpit** — ordre : Briefing → FormeCard → Ma semaine (+ bouton Objectif) → ObjectifCard → SessionsSemaineCard → CumulCard. SUPPRIMER : le bloc Altitude (et `weekly`/`maxKm`/`trend` si plus utilisés), l'ancien bloc Cap inline. Props : ajouter `weekActivities: ActivityRow[]` ; `web/app/(main)/dashboard/page.tsx` la passe (`weekActivities` est déjà construit ligne ~90).

- [ ] **Step 4: i18n** — `sessionsTitle: 'Sessions de la semaine'/'This week's sessions'`, `cumulTitleMonth: 'Cumul km · mois'/'Cumulative km · month'`, `cumulTitleYear: 'Cumul km · année'/'Cumulative km · year'`, `cumulToYear: 'Année'/'Year'`, `cumulToMonth: 'Mois'/'Month'`. Supprimer les clés mortes `altitudeTitle/altitudeUp/altitudeDown/altitudeStable` (type + fr + en) après grep de non-usage.

- [ ] **Step 5: tests MissionCockpit** — mocker `@/components/charts/CockpitCumulChart` (`jest.mock(..., () => ({ CockpitCumulChart: () => <div data-testid="cumul-chart" /> }))` — Recharts est lourd en jsdom). Fixture : ajouter `weekActivities` (2 activités) et `cumulMonths` non vide. Asserts : bouton `Objectif` présent ; `Sessions de la semaine` + un nom d'activité ; `cumul-chart` présent ; plus d'`Altitude`.

- [ ] **Step 6: vérif complète** — `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx jest __tests__/lib/mission __tests__/components/mission --verbose` → tout PASS. `npx next lint` → 0 erreur. Commit `feat(mission): cockpit design A — sessions semaine + cumul Mois/Année + assemblage`.

---

### Task 5: Docs + vérif visuelle

- [ ] Spec : la section « Écran Cockpit » est déjà à jour ; vérifier que les Drift notes ne contredisent rien (sinon ajuster).
- [ ] `npm run dev` en Mode Mission → comparer l'écran à la maquette A (cadran, badge cliquable → fenêtre, modal Objectif, 3 barres dont année verte/projection, liste sessions, cumul + bascule). Stopper le dev server.
- [ ] Commit final docs éventuels. Pas de push (décision Franck).
