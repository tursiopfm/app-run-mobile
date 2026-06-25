# Export « Profil de course » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet « Profil » au hub d'export `/plan/courses/[id]/print` qui sort le profil altimétrique (PDF / Image / Partage, tailles iPhone/A5/A4) avec 4 couches d'info activables, dans la charte du tableau de course.

**Architecture:** Une carte de présentation pure `ProfilePrintCard` (header charte tableau + profil SVG déterministe + frise des tronçons à bandeaux colorés par ravito) montée dans la page `/print` derrière une bascule « Tableau | Profil ». Réutilisation maximale des libs existantes ; seules briques neuves : détection des montées (`main-climbs.ts`), config des couches (`print-profile-info.ts`), échelles d'impression profil (`PRINT_SIZE_DEFS_PROFILE`), dialogue `ProfileInfoDialog`, helpers de géométrie SVG (`profile-print-geometry.ts`).

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Jest + @testing-library/react, SVG inline (pas Recharts pour l'export), localStorage.

## Global Constraints

- **Travailler sur une branche** `feat/profil-course-export` (on est sur `master`, qui est la branche par défaut → ne jamais committer directement dessus).
- **Répertoire de travail des commandes : `web/`** (le cwd Bash n'est pas fiable → utiliser un `cd` absolu vers `c:\Users\Franc\app-run-mobile\web`).
- **Lancer uniquement les suites de test concernées** : ~50 tests jest échouent en pré-existant (`useI18n` hors provider) — ce n'est pas une régression de ce plan.
- **Onglet « Tableau » strictement inchangé** : aucune modification de la logique/CSS existante du tableau ; on ajoute à côté.
- **Charte d'impression** (identique à la carte tableau, valeurs hex en dur dans le `<style>` de la carte) : brand orange `#FF7900`, encre `#0E1513`, encre douce `#55615E`, ligne forte `#2A332F`, courbe bleue `#2E90D0`. Puces : liquide `#2E90D0` (L), solide `#B45309` (S), chaud `#DC2626` (C), base vie `#16A34A` (BV), assistance `#7C5CFC` (A).
- **Messages de commit** : conventionnels en français (`feat(...)`, `test(...)`), terminés par le trailer :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Vérif TS/lint** au lieu d'un `next build` local (un `next dev` peut tourner et bloquer `.next`) : `npx tsc --noEmit` + `npx eslint <fichiers>`.

---

### Task 0: Créer la branche de travail

**Files:** aucun (git).

- [ ] **Step 1: Créer et basculer sur la branche**

```bash
cd /c/Users/Franc/app-run-mobile
git checkout -b feat/profil-course-export
```

- [ ] **Step 2: Vérifier**

Run: `git branch --show-current`
Expected: `feat/profil-course-export`

---

### Task 1: Détection des montées principales (`main-climbs.ts`)

**Files:**
- Create: `web/lib/plan/main-climbs.ts`
- Test: `web/__tests__/lib/plan/main-climbs.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export interface MainClimb { startKm: number; endKm: number; dPlus: number; distKm: number; gradientPct: number; midKm: number }
  export function detectMainClimbs(profile: { d: number[]; e: number[] }, opts?: { minDplus?: number; descentNoise?: number; max?: number }): MainClimb[]
  ```

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/lib/plan/main-climbs.test.ts`:

```ts
import { detectMainClimbs } from '@/lib/plan/main-climbs'

describe('detectMainClimbs', () => {
  it('détecte une montée simple et calcule pente / distance', () => {
    const climbs = detectMainClimbs({ d: [0, 1, 2, 3, 4], e: [100, 300, 500, 700, 900] })
    expect(climbs).toHaveLength(1)
    expect(climbs[0].dPlus).toBe(800)
    expect(climbs[0].distKm).toBe(4)
    expect(climbs[0].gradientPct).toBeCloseTo(20, 3)
    expect(climbs[0].midKm).toBe(2)
  })

  it('ignore les faux-plats sous le seuil minDplus', () => {
    const climbs = detectMainClimbs({ d: [0, 1, 2, 3, 4], e: [100, 110, 90, 115, 95] })
    expect(climbs).toEqual([])
  })

  it('plafonne au nombre demandé et garde les plus grosses, triées par km', () => {
    // Montée A km0→1 (+500), descente, Montée B km2→5 (+700)
    const climbs = detectMainClimbs(
      { d: [0, 1, 2, 3, 4, 5, 6], e: [100, 600, 200, 200, 300, 900, 900] },
      { max: 1 },
    )
    expect(climbs).toHaveLength(1)
    expect(climbs[0].dPlus).toBe(700)
    expect(climbs[0].startKm).toBe(2)
  })

  it('renvoie [] pour une trace vide ou trop courte', () => {
    expect(detectMainClimbs({ d: [], e: [] })).toEqual([])
    expect(detectMainClimbs({ d: [0], e: [100] })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/main-climbs.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/main-climbs'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/plan/main-climbs.ts`:

```ts
// Détection des « montées principales » depuis une trace dense (km, altitude),
// pour les badges ▲ du profil exporté. Gain net creux→sommet, avec hystérésis
// sur les descentes (le bruit < descentNoise ne coupe pas une montée).

export interface MainClimb {
  startKm: number
  endKm: number
  dPlus: number        // gain net creux → sommet, en mètres
  distKm: number
  gradientPct: number  // dPlus / (distKm * 1000) * 100
  midKm: number        // milieu de la montée — position du badge
}

function makeClimb(d: number[], e: number[], i0: number, i1: number): MainClimb {
  const startKm = d[i0]
  const endKm = d[i1]
  const dPlus = Math.round(e[i1] - e[i0])
  const distKm = Math.max(0, endKm - startKm)
  const gradientPct = distKm > 0 ? (dPlus / (distKm * 1000)) * 100 : 0
  return { startKm, endKm, dPlus, distKm, gradientPct, midKm: (startKm + endKm) / 2 }
}

export function detectMainClimbs(
  profile: { d: number[]; e: number[] },
  opts: { minDplus?: number; descentNoise?: number; max?: number } = {},
): MainClimb[] {
  const { d, e } = profile
  const minDplus = opts.minDplus ?? 200
  const descentNoise = opts.descentNoise ?? 25
  const max = opts.max ?? 3
  if (!d || d.length < 2 || e.length !== d.length) return []

  const climbs: MainClimb[] = []
  let troughIdx = 0
  let peakIdx = 0
  for (let i = 1; i < e.length; i++) {
    if (e[i] > e[peakIdx]) peakIdx = i
    if (e[peakIdx] - e[i] > descentNoise) {
      // Descente franche depuis le sommet courant → on clôt la montée trough→peak.
      if (peakIdx > troughIdx && e[peakIdx] - e[troughIdx] >= minDplus) {
        climbs.push(makeClimb(d, e, troughIdx, peakIdx))
      }
      troughIdx = i
      peakIdx = i
    } else if (e[i] < e[troughIdx]) {
      // Toujours en train de descendre, avant toute montée → on abaisse le creux.
      troughIdx = i
      peakIdx = i
    }
  }
  // Montée finale éventuelle (la trace se termine en montant).
  if (peakIdx > troughIdx && e[peakIdx] - e[troughIdx] >= minDplus) {
    climbs.push(makeClimb(d, e, troughIdx, peakIdx))
  }

  return climbs
    .sort((a, b) => b.dPlus - a.dPlus)
    .slice(0, max)
    .sort((a, b) => a.startKm - b.startKm)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/main-climbs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/lib/plan/main-climbs.ts web/__tests__/lib/plan/main-climbs.test.ts
git commit -m "$(cat <<'EOF'
feat(profil-export): détection des montées principales (lib pure testée)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Config des couches d'info (`print-profile-info.ts`)

**Files:**
- Create: `web/lib/plan/print-profile-info.ts`
- Test: `web/__tests__/lib/plan/print-profile-info.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export interface ProfileInfoConfig { objectif: boolean; climbs: boolean; barriers: boolean; supplies: boolean; altitudes: boolean }
  export const DEFAULT_PROFILE_INFO: ProfileInfoConfig
  export function loadProfileInfo(): ProfileInfoConfig
  export function saveProfileInfo(cfg: ProfileInfoConfig): void
  ```

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/lib/plan/print-profile-info.test.ts`:

```ts
import { loadProfileInfo, saveProfileInfo, DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'

describe('print-profile-info', () => {
  beforeEach(() => window.localStorage.clear())

  it('renvoie le défaut (tout activé) si rien en stockage', () => {
    expect(loadProfileInfo()).toEqual(DEFAULT_PROFILE_INFO)
    expect(DEFAULT_PROFILE_INFO).toEqual({ objectif: true, climbs: true, barriers: true, supplies: true, altitudes: true })
  })

  it('round-trip save → load', () => {
    saveProfileInfo({ objectif: false, climbs: true, barriers: false, supplies: true, altitudes: false })
    expect(loadProfileInfo()).toEqual({ objectif: false, climbs: true, barriers: false, supplies: true, altitudes: false })
  })

  it('retombe sur le défaut si le JSON stocké est corrompu', () => {
    window.localStorage.setItem('tc:plan:print-profile-info:v1', '{not json')
    expect(loadProfileInfo()).toEqual(DEFAULT_PROFILE_INFO)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-profile-info.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/plan/print-profile-info.ts`:

```ts
// Couches d'information affichables sur le profil exporté (cf. ProfileInfoDialog).
// Mémorisé en localStorage. Calqué sur print-size.ts / print-columns.ts.

export interface ProfileInfoConfig {
  objectif: boolean   // ligne objectif horaire dans la frise
  climbs: boolean     // badges ▲ des montées principales sur le profil
  barriers: boolean   // boîte rouge barrière dans la frise
  supplies: boolean   // puces ravito + couleur des bandeaux
  altitudes: boolean  // pastilles d'altitude sur la courbe + alt dans la frise
}

export const DEFAULT_PROFILE_INFO: ProfileInfoConfig = {
  objectif: true, climbs: true, barriers: true, supplies: true, altitudes: true,
}

const LS_KEY = 'tc:plan:print-profile-info:v1'

function sanitize(raw: Partial<ProfileInfoConfig>): ProfileInfoConfig {
  return {
    objectif:  typeof raw.objectif  === 'boolean' ? raw.objectif  : DEFAULT_PROFILE_INFO.objectif,
    climbs:    typeof raw.climbs    === 'boolean' ? raw.climbs    : DEFAULT_PROFILE_INFO.climbs,
    barriers:  typeof raw.barriers  === 'boolean' ? raw.barriers  : DEFAULT_PROFILE_INFO.barriers,
    supplies:  typeof raw.supplies  === 'boolean' ? raw.supplies  : DEFAULT_PROFILE_INFO.supplies,
    altitudes: typeof raw.altitudes === 'boolean' ? raw.altitudes : DEFAULT_PROFILE_INFO.altitudes,
  }
}

export function loadProfileInfo(): ProfileInfoConfig {
  if (typeof window === 'undefined') return DEFAULT_PROFILE_INFO
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_PROFILE_INFO
    return sanitize(JSON.parse(raw) as Partial<ProfileInfoConfig>)
  } catch {
    return DEFAULT_PROFILE_INFO
  }
}

export function saveProfileInfo(cfg: ProfileInfoConfig): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch { /* quota / privé */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-profile-info.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/lib/plan/print-profile-info.ts web/__tests__/lib/plan/print-profile-info.test.ts
git commit -m "$(cat <<'EOF'
feat(profil-export): config localStorage des couches d'info du profil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Échelles d'impression du profil (`PRINT_SIZE_DEFS_PROFILE`)

**Files:**
- Modify: `web/lib/plan/print-size.ts` (ajout en fin de fichier)
- Test: `web/__tests__/lib/plan/print-size-profile.test.ts`

**Interfaces:**
- Consumes: `PrintSizeDef`, `PrintSize` (déjà exportés par `print-size.ts`).
- Produces: `export const PRINT_SIZE_DEFS_PROFILE: Record<PrintSize, PrintSizeDef>`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/lib/plan/print-size-profile.test.ts`:

```ts
import { PRINT_SIZE_DEFS_PROFILE } from '@/lib/plan/print-size'

describe('PRINT_SIZE_DEFS_PROFILE', () => {
  it('couvre iphone / a5 / a4 avec une règle @page et une échelle > 0', () => {
    for (const key of ['iphone', 'a5', 'a4'] as const) {
      const def = PRINT_SIZE_DEFS_PROFILE[key]
      expect(def.pageRule).toContain('size:')
      expect(def.scale).toBeGreaterThan(0)
    }
  })

  it('A4 paysage est la plus grande échelle', () => {
    expect(PRINT_SIZE_DEFS_PROFILE.a4.scale).toBeGreaterThan(PRINT_SIZE_DEFS_PROFILE.a5.scale)
    expect(PRINT_SIZE_DEFS_PROFILE.a5.scale).toBeGreaterThan(PRINT_SIZE_DEFS_PROFILE.iphone.scale)
    expect(PRINT_SIZE_DEFS_PROFILE.a4.pageRule).toContain('landscape')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-size-profile.test.ts`
Expected: FAIL — `PRINT_SIZE_DEFS_PROFILE` indéfini.

- [ ] **Step 3: Write minimal implementation**

Append to `web/lib/plan/print-size.ts` (après `PRINT_SIZE_DEFS`) :

```ts
// Échelles pour la carte PROFIL (paysage-natif, largeur de design ~180 mm), à la
// différence de la carte tableau (120 mm, tournée). Échelle ≈ largeur imprimable
// ÷ 180 mm (marges 8 mm). Valeurs indicatives — à affiner à l'aperçu Ctrl+P.
//   A5  : A4 portrait, (210 − 16) / 180 = 1.078
//   A4  : A4 paysage,  (297 − 16) / 180 = 1.561
//   iPhone : carte de poche réduite, ~120 / 180 = 0.667
export const PRINT_SIZE_DEFS_PROFILE: Record<PrintSize, PrintSizeDef> = {
  iphone: {
    key: 'iphone', label: 'Format iPhone',
    hint: 'Petit profil à découper, à glisser dans la poche.',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 0.667,
  },
  a5: {
    key: 'a5', label: 'Format A5',
    hint: 'Profil agrandi, en haut d\'une feuille A4 portrait.',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 1.078,
  },
  a4: {
    key: 'a4', label: 'Format A4',
    hint: 'Le profil remplit une feuille A4 en paysage.',
    pageRule: 'size:A4 landscape;margin:8mm;', scale: 1.561,
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-size-profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/lib/plan/print-size.ts web/__tests__/lib/plan/print-size-profile.test.ts
git commit -m "$(cat <<'EOF'
feat(profil-export): échelles d'impression dédiées au profil (base 180 mm)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Helpers de géométrie SVG (`profile-print-geometry.ts`)

**Files:**
- Create: `web/lib/plan/profile-print-geometry.ts`
- Test: `web/__tests__/lib/plan/profile-print-geometry.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export interface ProfileGeom { W: number; H: number; padL: number; padR: number; plotTop: number; plotH: number; yMin: number; yMax: number; maxKm: number }
  export function xOf(g: ProfileGeom, km: number): number
  export function yOf(g: ProfileGeom, alt: number): number
  export function buildLinePath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string
  export function buildAreaPath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string
  ```

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/lib/plan/profile-print-geometry.test.ts`:

```ts
import { xOf, yOf, buildLinePath, buildAreaPath, type ProfileGeom } from '@/lib/plan/profile-print-geometry'

const G: ProfileGeom = { W: 900, H: 300, padL: 50, padR: 10, plotTop: 20, plotH: 200, yMin: 1000, yMax: 2000, maxKm: 100 }

describe('profile-print-geometry', () => {
  it('xOf cale 0 km à gauche et maxKm à droite', () => {
    expect(xOf(G, 0)).toBeCloseTo(50, 3)
    expect(xOf(G, 100)).toBeCloseTo(890, 3) // W - padR
    expect(xOf(G, 50)).toBeCloseTo(470, 3)
  })

  it('yOf cale yMin au bas du plot et yMax en haut', () => {
    expect(yOf(G, 1000)).toBeCloseTo(220, 3) // plotTop + plotH
    expect(yOf(G, 2000)).toBeCloseTo(20, 3)  // plotTop
  })

  it('buildLinePath commence par M et buildAreaPath se ferme par Z', () => {
    const profile = { d: [0, 50, 100], e: [1000, 1500, 2000] }
    expect(buildLinePath(G, profile).startsWith('M')).toBe(true)
    const area = buildAreaPath(G, profile)
    expect(area.startsWith('M')).toBe(true)
    expect(area.trimEnd().endsWith('Z')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/profile-print-geometry.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/plan/profile-print-geometry.ts`:

```ts
// Géométrie pure du profil exporté : mapping km/altitude → coordonnées SVG, et
// construction des paths (ligne + aire). Sans dépendance React → testable.

export interface ProfileGeom {
  W: number; H: number
  padL: number; padR: number
  plotTop: number; plotH: number
  yMin: number; yMax: number
  maxKm: number
}

export function xOf(g: ProfileGeom, km: number): number {
  const plotW = g.W - g.padL - g.padR
  return g.padL + (g.maxKm > 0 ? (km / g.maxKm) * plotW : 0)
}

export function yOf(g: ProfileGeom, alt: number): number {
  const span = g.yMax - g.yMin || 1
  return g.plotTop + (1 - (alt - g.yMin) / span) * g.plotH
}

export function buildLinePath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string {
  let p = ''
  for (let i = 0; i < profile.d.length; i++) {
    p += `${i ? 'L' : 'M'}${xOf(g, profile.d[i]).toFixed(1)} ${yOf(g, profile.e[i]).toFixed(1)} `
  }
  return p.trimEnd()
}

export function buildAreaPath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string {
  const n = profile.d.length
  if (n === 0) return ''
  const baseY = g.plotTop + g.plotH
  let p = `M${xOf(g, profile.d[0]).toFixed(1)} ${baseY.toFixed(1)} `
  for (let i = 0; i < n; i++) {
    p += `L${xOf(g, profile.d[i]).toFixed(1)} ${yOf(g, profile.e[i]).toFixed(1)} `
  }
  p += `L${xOf(g, profile.d[n - 1]).toFixed(1)} ${baseY.toFixed(1)} Z`
  return p
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/profile-print-geometry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/lib/plan/profile-print-geometry.ts web/__tests__/lib/plan/profile-print-geometry.test.ts
git commit -m "$(cat <<'EOF'
feat(profil-export): helpers purs de géométrie SVG du profil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dialogue « Infos » (`ProfileInfoDialog.tsx`)

**Files:**
- Create: `web/components/plan/ProfileInfoDialog.tsx`
- Test: `web/__tests__/components/plan/ProfileInfoDialog.test.tsx`

**Interfaces:**
- Consumes: `ProfileInfoConfig` (Task 2).
- Produces:
  ```tsx
  export function ProfileInfoDialog(props: { open: boolean; config: ProfileInfoConfig; onChange: (next: ProfileInfoConfig) => void; onClose: () => void }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/components/plan/ProfileInfoDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileInfoDialog } from '@/components/plan/ProfileInfoDialog'
import { DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'

describe('ProfileInfoDialog', () => {
  it('ne rend rien quand fermé', () => {
    const { container } = render(
      <ProfileInfoDialog open={false} config={DEFAULT_PROFILE_INFO} onChange={() => {}} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('bascule une couche via onChange', () => {
    const onChange = jest.fn()
    render(<ProfileInfoDialog open config={DEFAULT_PROFILE_INFO} onChange={onChange} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('Objectif horaire'))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PROFILE_INFO, objectif: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ProfileInfoDialog.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

Create `web/components/plan/ProfileInfoDialog.tsx` (habillage calqué sur `PrintSizeDialog.tsx`) :

```tsx
'use client'

// Choix des couches d'info affichées sur le profil exporté. Persistance gérée
// par le parent. Même habillage que PrintSizeDialog (bottom-sheet portalisé).
import { createPortal } from 'react-dom'
import type { ProfileInfoConfig } from '@/lib/plan/print-profile-info'

type Props = {
  open: boolean
  config: ProfileInfoConfig
  onChange: (next: ProfileInfoConfig) => void
  onClose: () => void
}

const ROWS: { key: keyof ProfileInfoConfig; label: string; hint: string }[] = [
  { key: 'objectif',  label: 'Objectif horaire',    hint: "Heure de passage visée à chaque point." },
  { key: 'climbs',    label: 'Montées principales',  hint: 'Badges ▲ (D+ · pente) sur les grosses bosses.' },
  { key: 'barriers',  label: 'Barrières',            hint: 'Heures limites (boîte rouge) aux points concernés.' },
  { key: 'supplies',  label: 'Ravitos',              hint: 'Puces L/S/C/BV/A + couleur des bandeaux.' },
  { key: 'altitudes', label: 'Altitudes',            hint: 'Altitude sur la courbe et dans la frise.' },
]

export function ProfileInfoDialog({ open, config, onChange, onClose }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choisir les informations du profil"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Informations du profil</h2>
        <p className="text-caption text-trail-muted mb-4">{"Active ou coupe chaque couche. Nom, km et tronçon (D+/D−) restent toujours affichés."}</p>

        <div className="space-y-2">
          {ROWS.map((r) => {
            const active = config[r.key]
            return (
              <label
                key={r.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-[10px] border cursor-pointer select-none ${active ? 'border-trail-primary' : 'border-trail-border'} bg-trail-surface`}
              >
                <input
                  type="checkbox"
                  aria-label={r.label}
                  checked={active}
                  onChange={() => onChange({ ...config, [r.key]: !active })}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-body font-semibold text-trail-text">{r.label}</span>
                  <span className="block text-caption text-trail-muted">{r.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ProfileInfoDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/components/plan/ProfileInfoDialog.tsx web/__tests__/components/plan/ProfileInfoDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(profil-export): dialogue « Infos » de choix des couches

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Carte de présentation (`ProfilePrintCard.tsx`)

**Files:**
- Create: `web/components/plan/ProfilePrintCard.tsx`
- Test: `web/__tests__/components/plan/ProfilePrintCard.test.tsx`

**Interfaces:**
- Consumes: `detectMainClimbs`/`MainClimb` (Task 1), `ProfileInfoConfig` (Task 2), géométrie (Task 4), `buildProfileData`/`interpolateAlt`/`elevationDomain` (de `ElevationProfileChart`), `resolveAltitudes`/`deriveSegment`/`formatElapsedToClock`/`formatBarrierClock` (de `waypoint-view`), `resolveElapsed` (de `barrier-lock`), `SUPPLY_ORDER`/`chartChips` (de `supply-chips`), types `Race`/`RaceWaypoint`/`WaypointSupply`.
- Produces:
  ```tsx
  export function ProfilePrintCard(props: { race: Race; waypoints: RaceWaypoint[]; denseProfile?: { d: number[]; e: number[] }; info: ProfileInfoConfig }): JSX.Element
  ```
  Le `<div>` racine porte la classe `pcard` (PAS `card` — pour ne pas hériter de la rotation/positionnement de la carte tableau).

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/components/plan/ProfilePrintCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ProfilePrintCard } from '@/components/plan/ProfilePrintCard'
import { DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'
import type { Race, RaceWaypoint } from '@/types/plan'

const race = {
  id: 'r1', name: 'Course Test', date: '2026-09-01', distance: 20, elevation: 1200,
  type: 'trail', startTime: '06:00', targetDurationMin: 180,
} as unknown as Race

const wps = [
  { id: 'w0', raceId: 'r1', km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'start', targetOverrideSec: null },
  { id: 'w1', raceId: 'r1', km: 10, name: 'Refuge', altitude: 1800, dPlus: 800, dMoins: 0, supplies: ['liquid', 'solid'], cutoffRaw: '02:30', cutoffKind: 'clock', type: 'ravito', targetOverrideSec: null },
  { id: 'w2', raceId: 'r1', km: 20, name: 'Arrivée', altitude: 1000, dPlus: 0, dMoins: 800, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'end', targetOverrideSec: null },
] as unknown as RaceWaypoint[]

const dense = { d: [0, 5, 10, 15, 20], e: [1000, 1400, 1800, 1400, 1000] }

describe('ProfilePrintCard', () => {
  it('affiche le nom de course et les waypoints', () => {
    render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getByText('Course Test')).toBeInTheDocument()
    expect(screen.getByText('Refuge')).toBeInTheDocument()
  })

  it('affiche la ligne objectif quand info.objectif est vrai, et la masque sinon', () => {
    const { rerender } = render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getAllByTestId('obj').length).toBeGreaterThan(0)
    rerender(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={{ ...DEFAULT_PROFILE_INFO, objectif: false }} />)
    expect(screen.queryAllByTestId('obj')).toHaveLength(0)
  })

  it('masque les barrières quand info.barriers est faux', () => {
    const { rerender } = render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getAllByTestId('barrier').length).toBeGreaterThan(0)
    rerender(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={{ ...DEFAULT_PROFILE_INFO, barriers: false }} />)
    expect(screen.queryAllByTestId('barrier')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ProfilePrintCard.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

Create `web/components/plan/ProfilePrintCard.tsx`. Réutilise les libs ; rend un SVG (courbe + grille + points + pastilles + badges montées) surmonté du header charte tableau, et une frise HTML en grille sous le SVG. Tous les styles dans un `<style>` local scopé `.pcard`.

```tsx
'use client'

// Carte « Profil de course » pour l'export (PDF / image / partage). Présentation
// PURE et déterministe (SVG, pas Recharts). Charte identique à la carte tableau.
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Race, RaceWaypoint, WaypointSupply } from '@/types/plan'
import type { ProfileInfoConfig } from '@/lib/plan/print-profile-info'
import { detectMainClimbs } from '@/lib/plan/main-climbs'
import { buildProfileData, elevationDomain } from '@/components/plan/ElevationProfileChart'
import { deriveSegment, formatElapsedToClock, formatBarrierClock } from '@/lib/plan/waypoint-view'
import { resolveElapsed } from '@/lib/plan/barrier-lock'
import { SUPPLY_ORDER } from '@/lib/plan/supply-chips'
import { xOf, yOf, buildLinePath, buildAreaPath, type ProfileGeom } from '@/lib/plan/profile-print-geometry'

const SUP: Record<WaypointSupply, { letter: string; cls: string }> = {
  liquid: { letter: 'L', cls: 'liq' }, solid: { letter: 'S', cls: 'sol' },
  hot: { letter: 'C', cls: 'hot' }, base_vie: { letter: 'BV', cls: 'base' },
  assistance: { letter: 'A', cls: 'ass' },
}
const SUP_COLOR: Record<string, string> = {
  liq: '#2E90D0', sol: '#B45309', hot: '#DC2626', base: '#16A34A', ass: '#7C5CFC',
}
const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
const pad = (n: number) => String(n).padStart(2, '0')
const noDay = (s: string | null | undefined) => (s ? s.replace(/^J\d+\s+/, '') : null)

// Couleur d'accent (bandeau + point) selon le ravito dominant.
function accentOf(w: RaceWaypoint, isEnd: boolean): string {
  if (isEnd) return '#FF7900'
  if (w.supplies.includes('base_vie')) return SUP_COLOR.base
  if (w.supplies.includes('hot') || w.supplies.includes('solid')) return SUP_COLOR.sol
  if (w.supplies.includes('liquid')) return SUP_COLOR.liq
  return '#8A938F'
}

export function ProfilePrintCard({ race, waypoints, denseProfile, info }: {
  race: Race; waypoints: RaceWaypoint[]; denseProfile?: { d: number[]; e: number[] }; info: ProfileInfoConfig
}) {
  // Trace : dense GPX si ≥ 2 points, sinon escalier reconstruit des waypoints.
  const profile = useMemo(() => {
    if (denseProfile && denseProfile.d.length >= 2) return denseProfile
    const { points } = buildProfileData(
      waypoints.map((w) => ({ km: w.km, name: w.name, altitude: w.altitude, dPlus: w.dPlus, dMoins: w.dMoins, supplies: w.supplies, cutoffRaw: w.cutoffRaw })),
    )
    const d: number[] = [], e: number[] = []
    for (const p of points) if (p.alt != null) { d.push(p.km); e.push(p.alt) }
    return { d, e }
  }, [denseProfile, waypoints])

  const elapsed = useMemo(() => resolveElapsed(
    waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec, cutoffRaw: w.cutoffRaw, cutoffKind: w.cutoffKind })),
    race.startTime, race.targetDurationMin ?? null, race.pacingFade ?? 0,
  ).elapsed, [waypoints, race.startTime, race.targetDurationMin, race.pacingFade])

  const climbs = useMemo(
    () => (info.climbs && profile.d.length >= 2 ? detectMainClimbs(profile) : []),
    [info.climbs, profile],
  )

  // Géométrie fixe (design ~180 mm de large → 948×250 px pour le plot).
  const [yMin, yMax] = profile.e.length ? elevationDomain(profile.e) : [0, 100]
  const maxKm = Math.max(profile.d[profile.d.length - 1] ?? 0, ...waypoints.map((w) => w.km), 1)
  const g: ProfileGeom = { W: 948, H: 230, padL: 46, padR: 14, plotTop: 14, plotH: 176, yMin, yMax, maxKm }
  const baseY = g.plotTop + g.plotH
  const pct = (x: number) => (x / g.W) * 100

  const interp = (km: number): number => {
    const { d, e } = profile
    if (d.length === 0) return yMin
    if (km <= d[0]) return e[0]
    if (km >= d[d.length - 1]) return e[e.length - 1]
    for (let i = 1; i < d.length; i++) if (d[i] >= km) {
      const t = (km - d[i - 1]) / ((d[i] - d[i - 1]) || 1)
      return e[i - 1] + (e[i] - e[i - 1]) * t
    }
    return e[e.length - 1]
  }

  const goal = race.targetDurationMin != null
    ? `${Math.floor(race.targetDurationMin / 60)} h ${pad(race.targetDurationMin % 60)}` : null
  const startClock = race.startTime ? noDay(formatElapsedToClock(race.startTime, 0)?.label) : null
  const arrClock = race.startTime && race.targetDurationMin != null
    ? noDay(formatElapsedToClock(race.startTime, race.targetDurationMin * 60)?.label) : null

  const gridAlts: number[] = []
  for (let a = Math.ceil(yMin / 200) * 200; a <= yMax; a += 200) gridAlts.push(a)
  const gridKms: number[] = []
  for (let k = 0; k <= maxKm; k += Math.max(5, Math.round(maxKm / 10 / 5) * 5)) gridKms.push(k)

  return (
    <div className="pcard">
      <style>{`
        .pcard{--ink:#0E1513;--ink-soft:#55615E;--ink-faint:#8A938F;--line:#C9D1CE;--line-strong:#2A332F;--brand:#FF7900;--blue:#2E90D0;--d:'Space Grotesk',var(--font-display,system-ui),sans-serif;background:#fff;color:var(--ink);width:200mm;max-width:100%;border-radius:2.5mm;padding:10px 12px 9px;box-shadow:0 18px 40px -16px rgba(0,0,0,.5);font-family:system-ui,sans-serif;}
        .pcard .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.6px solid var(--line-strong);padding-bottom:5px;gap:10px;}
        .pcard .race{font-family:var(--d);font-size:15px;font-weight:700;letter-spacing:-.3px;line-height:1.05;}
        .pcard .stats{font-family:var(--d);font-size:9.5px;color:var(--ink-soft);font-weight:600;margin-top:2px;}
        .pcard .stats b{color:var(--ink);}
        .pcard .brand{font-family:var(--d);font-weight:800;font-size:12px;letter-spacing:.5px;align-self:center;white-space:nowrap;}
        .pcard .brand .b1{color:var(--brand);}.pcard .brand .b2{color:var(--ink-soft);}.pcard .brand .b3{color:var(--brand);}
        .pcard .goal{font-family:var(--d);text-align:right;white-space:nowrap;}
        .pcard .goal .lbl{display:block;color:var(--ink-faint);font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
        .pcard .goal .val{color:var(--brand);font-size:14px;font-weight:700;}
        .pcard .plot{position:relative;width:100%;margin-top:5px;}
        .pcard .plot svg{display:block;width:100%;height:auto;}
        .pcard .pin{position:absolute;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;}
        .pcard .pin .chips{display:flex;gap:2px;}
        .pcard .pin .alt{font-family:var(--d);font-weight:700;font-size:9px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:4px;padding:0 3px;}
        .pcard .chip{font-family:var(--d);font-weight:700;font-size:8.5px;min-width:12px;height:12px;padding:0 2.5px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;color:#fff;line-height:1;}
        .pcard .chip.liq{background:#2E90D0;}.pcard .chip.sol{background:#B45309;}.pcard .chip.hot{background:#DC2626;}.pcard .chip.base{background:#16A34A;}.pcard .chip.ass{background:#7C5CFC;}
        .pcard .climb{position:absolute;transform:translate(-50%,-50%);background:#fff;border:1px solid var(--brand);color:var(--brand);font-family:var(--d);font-weight:700;font-size:9px;padding:1.5px 5px;border-radius:20px;white-space:nowrap;}
        .pcard .rail{display:grid;margin-top:6px;}
        .pcard .rail .col{padding:0 4px 4px;border-left:1px dashed var(--line);text-align:center;background:#FBFCFC;}
        .pcard .rail .col:first-child{border-left:0;}
        .pcard .rail .acc{height:3.5px;border-radius:0 0 3px 3px;margin:0 6px 5px;}
        .pcard .rail .nm{font-family:var(--d);font-weight:700;font-size:9.5px;color:var(--ink);line-height:1.05;min-height:21px;display:flex;align-items:center;justify-content:center;}
        .pcard .rail .col.is-key .nm{color:var(--brand);}
        .pcard .rail .ka{font-family:var(--d);font-size:8.5px;color:var(--ink-soft);font-weight:600;margin:1px 0 3px;}
        .pcard .rail .seg{font-family:var(--d);font-size:9px;font-weight:700;color:var(--ink);}
        .pcard .rail .seg .up{color:var(--brand);}.pcard .rail .seg .dn{color:var(--ink-soft);}
        .pcard .rail .obj{font-family:var(--d);font-size:11px;font-weight:700;color:var(--brand);margin-top:2px;}
        .pcard .rail .bar{font-family:var(--d);font-size:8.5px;font-weight:700;color:#fff;background:#DC2626;border-radius:3px;padding:1px 4px;margin-top:2px;display:inline-block;}
        .pcard .rail .railchips{display:inline-flex;gap:2px;margin-top:2px;}
        .pcard .legend{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:5px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:8.5px;color:var(--ink-soft);font-weight:600;}
        .pcard .legend .k{display:inline-flex;align-items:center;gap:3px;}
      `}</style>

      <div className="hd">
        <div>
          <div className="race">{race.name}</div>
          <div className="stats">
            <b>{race.distance} km</b> · <b>{race.elevation} D+</b> · {waypoints.length} pts
            {startClock ? <> · Dép. <b>{startClock}</b></> : null}
            {arrClock ? <> · Arr. visée <b>{arrClock}</b></> : null}
          </div>
        </div>
        <div className="brand"><span className="b1">TRAIL</span> <span className="b2">COCKPIT</span><span className="b3">.RUN</span></div>
        {goal ? <div className="goal"><span className="lbl">Objectif</span><span className="val">{goal}</span></div> : null}
      </div>

      <div className="plot" style={{ height: g.H }}>
        <svg viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as CSSProperties}>
          <defs>
            <linearGradient id="pfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E90D0" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#2E90D0" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {gridAlts.map((a) => (
            <g key={`ga${a}`}>
              <line x1={g.padL} y1={yOf(g, a)} x2={g.W - g.padR} y2={yOf(g, a)} stroke="#C9D1CE" strokeDasharray="2 3" strokeWidth={1} />
              {info.altitudes && <text x={g.padL - 4} y={yOf(g, a) + 3} textAnchor="end" fontSize={9} fill="#8A938F" fontFamily="Space Grotesk,sans-serif">{a} m</text>}
            </g>
          ))}
          {gridKms.map((k) => (
            <text key={`gk${k}`} x={xOf(g, k)} y={baseY + 13} textAnchor="middle" fontSize={9} fill="#8A938F" fontFamily="Space Grotesk,sans-serif">km {k}</text>
          ))}
          {profile.d.length >= 2 && <path d={buildAreaPath(g, profile)} fill="url(#pfill)" />}
          {profile.d.length >= 2 && <path d={buildLinePath(g, profile)} fill="none" stroke="#2E90D0" strokeWidth={2.2} />}
          {waypoints.map((w, i) => {
            const isEnd = i === waypoints.length - 1, isStart = i === 0
            const acc = accentOf(w, isEnd || isStart)
            const y = interp(w.km)
            return (
              <g key={w.id ?? i}>
                <line x1={xOf(g, w.km)} y1={y} x2={xOf(g, w.km)} y2={baseY} stroke={acc} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.55} />
                <circle cx={xOf(g, w.km)} cy={y} r={4.5} fill={acc} stroke="#fff" strokeWidth={1.6} />
              </g>
            )
          })}
        </svg>

        {/* pastilles altitude + puces ravito sur la courbe */}
        {waypoints.map((w, i) => {
          const isEnd = i === waypoints.length - 1, isStart = i === 0
          const acc = accentOf(w, isEnd || isStart)
          const chips = info.supplies ? SUPPLY_ORDER.filter((s) => w.supplies.includes(s)) : []
          const y = interp(w.km)
          if (chips.length === 0 && !info.altitudes) return null
          return (
            <div key={`pin${w.id ?? i}`} className="pin" style={{ left: `${pct(xOf(g, w.km))}%`, top: Math.max(2, y - 34) }}>
              {chips.length > 0 && <div className="chips">{chips.map((s) => <span key={s} className={`chip ${SUP[s].cls}`}>{SUP[s].letter}</span>)}</div>}
              {info.altitudes && <div className="alt" style={{ borderColor: acc }}>{Math.round(interp(w.km))} m</div>}
            </div>
          )
        })}

        {/* badges montées principales */}
        {climbs.map((c, i) => (
          <div key={`cl${i}`} className="climb" style={{ left: `${pct(xOf(g, c.midKm))}%`, top: yOf(g, interp(c.midKm)) - 12 }} data-testid="climb">
            ▲ +{c.dPlus} D+ · {Math.round(c.gradientPct)}%
          </div>
        ))}
      </div>

      <div className="rail" style={{ gridTemplateColumns: waypoints.map(() => '1fr').join(' ') }}>
        {waypoints.map((w, i) => {
          const isEnd = i === waypoints.length - 1, isStart = i === 0
          const acc = accentOf(w, isEnd || isStart)
          const seg = deriveSegment(waypoints.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
          const objClock = elapsed ? noDay(formatElapsedToClock(race.startTime, elapsed[i])?.label) : null
          const bhRaw = formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0)
          const bh = bhRaw ? bhRaw.replace(/^J\d+\s+/, '') : null
          const chips = info.supplies ? SUPPLY_ORDER.filter((s) => w.supplies.includes(s)) : []
          return (
            <div key={`col${w.id ?? i}`} className={`col${w.supplies.length || isStart || isEnd ? ' is-key' : ''}`}>
              <div className="acc" style={{ background: acc }} />
              <div className="nm">{w.name}</div>
              <div className="ka">km {fmtKm(w.km)}{info.altitudes ? ` · ${Math.round(interp(w.km))} m` : ''}</div>
              <div className="seg">{i === 0
                ? <span className="dn">départ</span>
                : <>{seg.interKm != null ? `${fmtKm(seg.interKm)} km · ` : ''}<span className="up">▲{seg.dPlusSeg ?? 0}</span> <span className="dn">▼{seg.dMoinsSeg ?? 0}</span></>}</div>
              {info.objectif && objClock && <div className="obj" data-testid="obj">{objClock}</div>}
              {info.barriers && bh && <span className="bar" data-testid="barrier">⛔ {bh}</span>}
              {chips.length > 0 && <span className="railchips">{chips.map((s) => <span key={s} className={`chip ${SUP[s].cls}`}>{SUP[s].letter}</span>)}</span>}
            </div>
          )
        })}
      </div>

      <div className="legend">
        {info.supplies && <>
          <span className="k"><span className="chip liq">L</span>liquide</span>
          <span className="k"><span className="chip sol">S</span>solide</span>
          <span className="k"><span className="chip hot">C</span>chaud</span>
          <span className="k"><span className="chip base">BV</span>base vie</span>
          <span className="k"><span className="chip ass">A</span>assistance</span>
        </>}
        {info.climbs && <span className="k"><span style={{ color: 'var(--brand)', fontWeight: 700 }}>▲</span> montée principale</span>}
        <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>Obj = heure visée · Barrière = limite</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ProfilePrintCard.test.tsx`
Expected: PASS (3 tests). Si un helper importé a une signature différente de celle supposée, ajuste l'appel (vérifier `web/lib/plan/waypoint-view.ts` et `web/lib/plan/barrier-lock.ts`) — ne pas changer leur implémentation.

- [ ] **Step 5: Vérif TS**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: pas d'erreur dans les fichiers créés.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/components/plan/ProfilePrintCard.tsx web/__tests__/components/plan/ProfilePrintCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(profil-export): carte de présentation Profil (SVG + frise tronçons)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Onglet « Tableau | Profil » dans la page `/print` (intégration)

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/print/page.tsx`

**Interfaces:**
- Consumes: `ProfilePrintCard` (Task 6), `ProfileInfoDialog` (Task 5), `loadProfileInfo`/`saveProfileInfo`/`DEFAULT_PROFILE_INFO` (Task 2), `PRINT_SIZE_DEFS_PROFILE` (Task 3).
- Produces: rien (feuille terminale).

> **Note :** tâche d'intégration (glue + CSS d'impression). Pas de test unitaire automatisé (comme la page tableau existante) ; vérification au build TS/lint + aperçu Ctrl+P. **Ne modifie aucune logique de l'onglet Tableau.**

- [ ] **Step 1: Ajouter les imports**

Dans `web/app/(main)/plan/courses/[id]/print/page.tsx`, après l'import de `PrintSizeDialog` (l.19), ajouter :

```tsx
import { PRINT_SIZE_DEFS_PROFILE } from '@/lib/plan/print-size'
import { ProfilePrintCard } from '@/components/plan/ProfilePrintCard'
import { ProfileInfoDialog } from '@/components/plan/ProfileInfoDialog'
import { loadProfileInfo, saveProfileInfo, DEFAULT_PROFILE_INFO, type ProfileInfoConfig } from '@/lib/plan/print-profile-info'
import { Map as MapIcon } from 'lucide-react'
```

- [ ] **Step 2: Ajouter l'état (onglet, trace, infos)**

Après `const [sizeDialogOpen, setSizeDialogOpen] = useState(false)` (l.44), ajouter :

```tsx
  const [tab, setTab] = useState<'tableau' | 'profil'>('tableau')
  const [track, setTrack] = useState<{ profile: { d: number[]; e: number[] } } | null>(null)
  const [infoCfg, setInfoCfg] = useState<ProfileInfoConfig>(DEFAULT_PROFILE_INFO)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
```

Après `useEffect(() => { setSize(loadPrintSize()) }, [])` (l.47), ajouter :

```tsx
  useEffect(() => { setInfoCfg(loadProfileInfo()) }, [])
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'profil') setTab('profil')
  }, [])
```

- [ ] **Step 3: Charger la trace dans le fetch existant**

Remplacer le bloc de chargement (l.49-57) :

```tsx
  useEffect(() => {
    void (async () => {
      const races = await getRaces()
      setRace(races.find((r) => r.id === params.id) ?? null)
      const res = await fetch(`/api/races/${params.id}/waypoints`)
      if (res.ok) setWps((await res.json()).waypoints ?? [])
      setReady(true)
    })()
  }, [params.id])
```

par :

```tsx
  useEffect(() => {
    void (async () => {
      const races = await getRaces()
      setRace(races.find((r) => r.id === params.id) ?? null)
      const res = await fetch(`/api/races/${params.id}/waypoints`)
      if (res.ok) {
        const body = await res.json()
        setWps(body.waypoints ?? [])
        setTrack(body.track ?? null)
      }
      setReady(true)
    })()
  }, [params.id])
```

- [ ] **Step 4: Ajouter le setter d'infos**

Après `const updateSize = (next: PrintSize) => { setSize(next); savePrintSize(next) }` (l.63), ajouter :

```tsx
  const updateInfo = (next: ProfileInfoConfig) => { setInfoCfg(next); saveProfileInfo(next) }
```

- [ ] **Step 5: Bascule d'onglet + réglages conditionnels dans la toolbar**

Remplacer le bloc `<div className="toolbar"> … </div>` et le `<p className="caption">…</p>` (l.344-356) par :

```tsx
      <div className="toolbar">
        <div className="tabs">
          <button className={`tab ${tab === 'tableau' ? 'on' : ''}`} onClick={() => setTab('tableau')}>Tableau</button>
          <button className={`tab ${tab === 'profil' ? 'on' : ''}`} onClick={() => setTab('profil')}>Profil</button>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => window.print()}><FileText size={16} /> PDF</button>
          <button className="btn" ref={jpegBtnRef} onClick={() => void exportJpeg()} disabled={busy}><ImageIcon size={16} /> Image</button>
          <button className="btn" ref={shareBtnRef} onClick={() => void shareJpeg()} disabled={busy}><Share2 size={16} /> Partager</button>
        </div>
        <div className="actions2">
          {tab === 'tableau'
            ? <button className="btn ghost" onClick={() => setDialogOpen(true)}><Settings2 size={16} /> Colonnes</button>
            : <button className="btn ghost" onClick={() => setInfoDialogOpen(true)}><MapIcon size={16} /> Infos</button>}
          <button className="btn ghost" onClick={() => setSizeDialogOpen(true)}><Ruler size={16} /> Taille</button>
        </div>
      </div>
      <p className="caption">{tab === 'tableau'
        ? "Les colonnes choisies s'appliquent aux trois formats (PDF, image, partage) ; la taille ne change que le PDF. Pince à deux doigts pour zoomer l'aperçu. À l'impression : carte à l'horizontale, calée en haut de la feuille. Découpe, plastifie."
        : "Choisis les infos à afficher (bouton Infos) ; la taille ne change que le PDF. À l'impression : profil paysage calé en haut de la feuille."}</p>
```

- [ ] **Step 6: Rendre conditionnellement la carte active**

Remplacer le bloc `<div className="previewscroll" …> … </div>` (l.358-423, qui contient `.cut` / `.zoomview` / `.cardwrap` / `.card`) en l'enveloppant d'une condition. Garder **intact** le contenu existant pour `tab === 'tableau'` ; ajouter la branche profil. Structure cible :

```tsx
      {tab === 'tableau' ? (
        <div className="previewscroll" ref={previewRef}>
          {/* …CONTENU EXISTANT DU TABLEAU INCHANGÉ… (cut / zoomview / cardwrap / card ref={cardRef}) */}
        </div>
      ) : (
        <div className="previewscroll">
          <div className="cut">
            <span className="scis">✂ — — — — — — — — découper — — — — — — — —</span>
            <div className="pcardwrap" ref={cardRef as React.RefObject<HTMLDivElement>}>
              <ProfilePrintCard race={race} waypoints={wps} denseProfile={track?.profile} info={infoCfg} />
            </div>
          </div>
        </div>
      )}
```

> `cardRef` sert pour PDF/Image/Partage : sur l'onglet profil il pointe sur `.pcardwrap` (qui contient `.pcard`). `renderJpeg` clone l'élément ciblé — il fonctionne tel quel.

- [ ] **Step 7: CSS d'impression du profil (dans le `<style>` de la page)**

Avant la règle `@page{${PRINT_SIZE_DEFS[size].pageRule}}` (l.321), insérer les styles écran de la bascule + wrapper profil :

```tsx
        .pdfroot .tabs{display:flex;gap:6px;}
        .pdfroot .tab{flex:1;font-family:var(--d);font-weight:700;font-size:13px;padding:8px;border-radius:10px;border:1.5px solid var(--trail-border);background:transparent;color:var(--trail-muted);cursor:pointer;}
        .pdfroot .tab.on{border-color:var(--trail-primary);color:var(--trail-primary);background:color-mix(in srgb, var(--trail-primary) 10%, transparent);}
        .pdfroot .pcardwrap{width:100%;display:flex;justify-content:center;}
```

Puis remplacer la ligne `@page{${PRINT_SIZE_DEFS[size].pageRule}}` par un `@page` dépendant de l'onglet :

```tsx
        @page{${(tab === 'profil' ? PRINT_SIZE_DEFS_PROFILE : PRINT_SIZE_DEFS)[size].pageRule}}
```

Enfin, dans le bloc `@media print{…}`, après la règle existante sur `.pdfroot .card{…transform:scale(${PRINT_SIZE_DEFS[size].scale})…}` (l.337), ajouter les règles profil :

```tsx
          .pdfroot .pcardwrap{display:block !important;}
          .pdfroot .pcard{transform:scale(${PRINT_SIZE_DEFS_PROFILE[size].scale}) !important;transform-origin:top center !important;margin:0 auto;box-shadow:none;border:.5px solid var(--line);}
```

- [ ] **Step 8: Monter le dialogue Infos**

À côté de `<PrintSizeDialog … />` (l.426), ajouter :

```tsx
      <ProfileInfoDialog open={infoDialogOpen} config={infoCfg} onChange={updateInfo} onClose={() => setInfoDialogOpen(false)} />
```

- [ ] **Step 9: Vérif TS + lint**

Run:
```bash
cd /c/Users/Franc/app-run-mobile/web
npx tsc --noEmit
npx eslint "app/(main)/plan/courses/[id]/print/page.tsx" components/plan/ProfilePrintCard.tsx components/plan/ProfileInfoDialog.tsx lib/plan/main-climbs.ts lib/plan/print-profile-info.ts lib/plan/profile-print-geometry.ts
```
Expected: aucune erreur sur les fichiers du périmètre.

- [ ] **Step 10: Vérification manuelle (Ctrl+P)**

1. `npm run dev` (depuis `web/`), ouvrir une course ayant un tableau + une trace, menu ⋮ → Exporter → onglet **Profil**.
2. Vérifier : profil + frise alignée, bandeaux colorés par ravito, objectif/barrières/montées/altitudes présents.
3. Bouton **Infos** : couper chaque couche → disparaît ; persiste après rechargement.
4. Bouton **Taille** iPhone/A5/A4 + aperçu Ctrl+P : profil paysage au bon format, calé en haut. **Affiner les `scale` de `PRINT_SIZE_DEFS_PROFILE` si débordement** (point de calibration prévu).
5. **Image** / **Partager** : raster fidèle du profil.
6. **Non-régression** : onglet **Tableau** identique à avant (PDF/Image/Partage/Colonnes/Taille).

- [ ] **Step 11: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/app/"(main)"/plan/courses/"[id]"/print/page.tsx
git commit -m "$(cat <<'EOF'
feat(profil-export): onglet « Tableau | Profil » dans le hub d'export /print

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Finalisation — spec + maquette

**Files:**
- Modify: `web/docs/superpowers/specs/2026-06-25-profil-course-export-design.md`

- [ ] **Step 1: Bandeau « Implémenté » sur la spec**

Remplacer `> Status: Spec · 2026-06-25` par :

```markdown
> **Status: Implémenté** · 2026-06-25 · Code: web/components/plan/ProfilePrintCard.tsx, web/app/(main)/plan/courses/[id]/print/page.tsx
```

Si le rendu final diverge de la spec (ex. échelles recalibrées), ajouter une section `## Drift notes` en fin de fichier décrivant l'écart.

- [ ] **Step 2: Commit**

```bash
cd /c/Users/Franc/app-run-mobile
git add web/docs/superpowers/specs/2026-06-25-profil-course-export-design.md Prompts/profil-course-export-mockups.html
git commit -m "$(cat <<'EOF'
docs(profil-export): bandeau Implémenté + maquette de référence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Rappels post-implémentation

- **Pas de migration Supabase** : la trace dense (`track.profile`) est déjà servie par `/api/races/[id]/waypoints`. Aucun schéma à modifier.
- **Déploiement** : `git push` de la branche puis merge → Vercel auto-déploie (ne pas lancer `vercel --prod`).
- **Service Worker** : non concerné (pas de modif `sw.template.js`).
- **Calibration** : seul point ouvert = les `scale` de `PRINT_SIZE_DEFS_PROFILE`, à valider par Franck au Ctrl+P.

## Self-review (vérifié à la rédaction)

- **Couverture spec** : onglet Tableau|Profil (T7) · exports communs PDF/Image/Partage (T7, réutilise l'existant) · carte profil header+SVG+frise bandeaux ravito (T6) · 4 couches activables (T2+T5+T6) · tailles iPhone/A5/A4 profil (T3+T7) · montées principales (T1) · pas de migration (rappels). ✔
- **Placeholders** : aucun « TBD/TODO » ; tout le code est fourni.
- **Cohérence des types** : `ProfileInfoConfig`/`detectMainClimbs`/`MainClimb`/`ProfileGeom`/`PRINT_SIZE_DEFS_PROFILE` et les `data-testid` (`obj`/`barrier`/`climb`) sont nommés identiquement entre tâches et tests.
- **Risque résiduel** : signatures exactes de `deriveSegment`/`formatBarrierClock`/`resolveElapsed`/`formatElapsedToClock` supposées identiques à leur usage dans `print/page.tsx` (vérifiées dans ce fichier) — T6 Step 4 rappelle d'ajuster l'appel sans toucher leur implémentation si écart.
