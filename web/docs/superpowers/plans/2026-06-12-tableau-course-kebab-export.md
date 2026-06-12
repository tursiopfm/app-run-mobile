# Tableau de course — kebab, export JPEG/Partage, undo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le bouton « Modifier les lignes » du Tableau de course par un menu kebab (Modifier la course / Modifier les lignes / Ré-importer / Exporter PDF·JPEG·Partager), déplacer la légende en bas, et permettre d'annuler une suppression de ligne.

**Architecture:** Le menu kebab vit dans `CoursePageClient` (3 actions sur 4 y vivent déjà) ; `WaypointsTable` devient **contrôlé** pour `editLines` et gère un snackbar d'undo local. L'export JPEG/Partage réutilise la « carte » de la page `/print` (hub d'export) rasterisée à plat via `html-to-image`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, `lucide-react`, `html-to-image`, Jest + @testing-library/react.

**Spec:** `web/docs/superpowers/specs/2026-06-12-tableau-course-kebab-export-design.md`

**Conventions projet :** lancer les commandes depuis `web/` (cd absolu). `git -C` depuis la racine. Build local bloqué si `next dev` tourne → vérifier via `tsc` + `eslint` (build autoritatif sur Vercel). ~50 tests jest échouent en pré-existant (useI18n hors provider) — lancer seulement les suites concernées.

---

## File Structure

- `web/package.json` — ajout dépendance `html-to-image`.
- `web/components/plan/WaypointsTable.tsx` — props `editLines`/`onEditLinesChange` (contrôlé), retrait de la barre interne (sauf « Terminé » en édition), légende déplacée en bas, snackbar undo.
- `web/components/plan/TableActionsMenu.tsx` — **nouveau** composant menu kebab + sous-menu export (UI + état d'ouverture local).
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — état `editLines`, montage du `TableActionsMenu`, handler d'export (ouverture `/print`), retrait des liens du bas.
- `web/app/(main)/plan/courses/[id]/print/page.tsx` — boutons JPEG/Partager, classe `.exporting` (capture à plat), lecture de `?export=`, génération via `html-to-image`.
- `web/__tests__/components/plan/WaypointsTable.undo.test.tsx` — **nouveau** test undo.
- `web/__tests__/components/plan/TableActionsMenu.test.tsx` — **nouveau** test menu.

---

## Task 1 : Ajouter la dépendance `html-to-image`

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Installer la dépendance**

Run (depuis `web/`) :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npm install html-to-image@^1.11.13
```
Expected: `package.json` contient `"html-to-image": "^1.11.13"` dans `dependencies`, `package-lock.json` mis à jour, aucune erreur.

- [ ] **Step 2: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add web/package.json web/package-lock.json
git -C "c:/Users/Franc/app-run-mobile" commit -m "chore(plan): ajout html-to-image pour export JPEG du tableau de course"
```

---

## Task 2 : `WaypointsTable` contrôlé + légende en bas

But : retirer l'état interne `editLines`, l'exposer en prop contrôlée, ne garder qu'un bouton « ✓ Terminé » visible **en mode édition**, et déplacer la légende sous le tableau.

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx`

- [ ] **Step 1: Étendre le type `Props`**

Dans le bloc `type Props = { … }`, ajouter les deux props (juste après `readOnly?: boolean`) :
```tsx
  readOnly?: boolean
  // Mode « Modifier les lignes » contrôlé par le parent (menu kebab).
  editLines?: boolean
  onEditLinesChange?: (v: boolean) => void
```

- [ ] **Step 2: Destructurer les nouvelles props**

Modifier la signature de la fonction :
```tsx
export function WaypointsTable({
  waypoints, onChange, readOnly, editLines = false, onEditLinesChange,
  startTime, targetDurationMin, pacingFade, onStartTimeChange,
}: Props) {
```

- [ ] **Step 3: Supprimer l'état interne `editLines`**

Supprimer la ligne :
```tsx
  const [editLines, setEditLines] = useState(false)
```
(Garder `const [editRow, setEditRow] = useState<number | null>(null)` au-dessus.)

- [ ] **Step 4: Remplacer la barre interne par un bouton « Terminé » (édition seulement)**

Remplacer ce bloc :
```tsx
      {!readOnly && (
        <div className="wtbl-bar">
          <button type="button" className="btn-lines" onClick={() => setEditLines((v) => !v)}>
            {editLines ? '✓ Terminé' : '✎ Modifier les lignes'}
          </button>
        </div>
      )}
```
par :
```tsx
      {!readOnly && editLines && (
        <div className="wtbl-bar">
          <button type="button" className="btn-lines" onClick={() => onEditLinesChange?.(false)}>
            ✓ Terminé
          </button>
        </div>
      )}
```

- [ ] **Step 5: Déplacer la légende en bas**

Couper ce bloc (actuellement juste après la barre, avant l'en-tête `row-wrap`) :
```tsx
      <div className="legend-mini">
        <b>+x</b> sous Dist · D+ · D− = l&apos;intermédiaire (depuis le point précédent) · <span className="bhk">BH</span> = barrière
        <br />ravitos : <span className="lg"><span className="chip liq">L</span>liquide</span><span className="lg"><span className="chip sol">S</span>solide</span><span className="lg"><span className="chip hot">C</span>chaud</span><span className="lg"><span className="chip base">BV</span>base vie</span><span className="lg"><span className="chip ass">A</span>assistance</span>
      </div>
```
et le recoller **juste après** le bouton « + Ajouter une ligne » (le bloc `{editLines && !readOnly && (<button className="add-row" …>)}`), donc à la toute fin avant la fermeture `</div>` de `.wtbl`.

- [ ] **Step 6: Vérifier types + lint**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit
```
Expected: PASS (aucune erreur). Note : `CoursePageClient` ne passe pas encore les nouvelles props — `editLines` a une valeur par défaut `false` donc pas d'erreur TS ; l'intégration se fait en Task 5.

```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx eslint components/plan/WaypointsTable.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add web/components/plan/WaypointsTable.tsx
git -C "c:/Users/Franc/app-run-mobile" commit -m "refactor(plan): WaypointsTable editLines contrôlé + légende en bas"
```

---

## Task 3 : Undo suppression de ligne (snackbar) dans `WaypointsTable`

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx`
- Test: `web/__tests__/components/plan/WaypointsTable.undo.test.tsx`

- [ ] **Step 1: Écrire le test (qui échoue)**

Créer `web/__tests__/components/plan/WaypointsTable.undo.test.tsx` :
```tsx
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

const mk = (name: string, km: number, type: Draft['type']): Draft => ({
  orderIndex: 0, name, km, kmInter: null, dPlus: null, dMoins: null,
  cutoffRaw: null, cutoffKind: null, type, supplies: [], targetOverrideSec: null,
})

function Harness() {
  const [wps, setWps] = useState<Draft[]>([
    mk('Départ', 0, 'depart'),
    mk('Ravito B', 10, 'ravito'),
    mk('Arrivée', 20, 'arrivee'),
  ])
  const [edit, setEdit] = useState(true)
  return (
    <WaypointsTable waypoints={wps} onChange={setWps} editLines={edit} onEditLinesChange={setEdit} />
  )
}

it('supprime une ligne puis Annuler la restaure', () => {
  render(<Harness />)
  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()

  const delButtons = screen.getAllByLabelText('Supprimer la ligne')
  fireEvent.click(delButtons[1]) // ligne du milieu

  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()
  expect(screen.getByText('Ligne supprimée')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  expect(screen.queryByText('Ligne supprimée')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/components/plan/WaypointsTable.undo.test.tsx
```
Expected: FAIL (« Ligne supprimée » introuvable — le snackbar n'existe pas encore).

- [ ] **Step 3: Importer `useEffect` et `useRef`**

Modifier l'import React en tête de fichier :
```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 4: Ajouter l'état undo + nettoyage**

Juste après `const [editRow, setEditRow] = useState<number | null>(null)`, ajouter :
```tsx
  const [lastDeleted, setLastDeleted] = useState<{ row: Draft; index: number } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])
  // Sortir du mode édition efface le snackbar en attente.
  useEffect(() => { if (!editLines) setLastDeleted(null) }, [editLines])
```

- [ ] **Step 5: Mémoriser la ligne supprimée + ajouter `undoDelete`**

Remplacer la fonction `removeRow` :
```tsx
  // Supprime une ligne ; reindex réassigne départ (1er km) / arrivée (dernier km).
  const removeRow = (i: number) => {
    onChange(reindex(waypoints.filter((_, idx) => idx !== i)))
  }
```
par :
```tsx
  // Supprime une ligne (mémorisée pour undo) ; reindex réassigne départ/arrivée.
  const removeRow = (i: number) => {
    setLastDeleted({ row: waypoints[i], index: i })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setLastDeleted(null), 6000)
    onChange(reindex(waypoints.filter((_, idx) => idx !== i)))
  }

  // Réinsère la dernière ligne supprimée à sa position d'origine (km → tri stable).
  const undoDelete = () => {
    if (!lastDeleted) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    const next = [...waypoints]
    next.splice(lastDeleted.index, 0, lastDeleted.row)
    setLastDeleted(null)
    onChange(reindex(next))
  }
```

- [ ] **Step 6: Ajouter le snackbar (JSX) en bas du tableau**

Juste **avant** la fermeture `</div>` finale de `<div className="wtbl">` (après la légende déplacée en Task 2), ajouter :
```tsx
      {lastDeleted && (
        <div className="wtbl-snack" role="status">
          <span>Ligne supprimée</span>
          <button type="button" className="snack-undo" onClick={undoDelete}>Annuler</button>
        </div>
      )}
```

- [ ] **Step 7: Ajouter les styles du snackbar**

Dans le bloc `<style>{`…`}</style>`, après la règle `.wtbl .add-row{…}`, ajouter :
```css
        .wtbl .wtbl-snack{position:sticky;bottom:8px;margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--trail-surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-family:var(--d);font-size:12px;font-weight:600;color:var(--text);box-shadow:0 6px 18px rgba(0,0,0,.18);}
        .wtbl .snack-undo{background:none;border:0;color:var(--orange);font-family:var(--d);font-size:12px;font-weight:700;cursor:pointer;padding:2px 4px;}
```
(`--trail-surface` est une CSS var d'app valide dans ce contexte, comme dans `.rav-pop`.)

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/components/plan/WaypointsTable.undo.test.tsx
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add web/components/plan/WaypointsTable.tsx web/__tests__/components/plan/WaypointsTable.undo.test.tsx
git -C "c:/Users/Franc/app-run-mobile" commit -m "feat(plan): undo suppression de ligne (snackbar) dans le tableau de course"
```

---

## Task 4 : Composant `TableActionsMenu` (kebab + sous-menu export)

**Files:**
- Create: `web/components/plan/TableActionsMenu.tsx`
- Test: `web/__tests__/components/plan/TableActionsMenu.test.tsx`

- [ ] **Step 1: Écrire le test (qui échoue)**

Créer `web/__tests__/components/plan/TableActionsMenu.test.tsx` :
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TableActionsMenu } from '@/components/plan/TableActionsMenu'

it('ouvre le menu, déclenche le sous-menu export et les actions', () => {
  const onEditRace = jest.fn()
  const onExport = jest.fn()
  render(
    <TableActionsMenu
      onEditRace={onEditRace}
      onEditLines={() => {}}
      onReimport={() => {}}
      onExport={onExport}
    />,
  )

  // fermé au départ
  expect(screen.queryByText('Modifier la course')).not.toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('Actions du tableau'))
  expect(screen.getByText('Modifier la course')).toBeInTheDocument()

  // sous-menu export
  fireEvent.click(screen.getByText('Exporter'))
  fireEvent.click(screen.getByText('JPEG'))
  expect(onExport).toHaveBeenCalledWith('jpeg')

  // un item ferme le menu : on rouvre puis on déclenche Modifier la course
  fireEvent.click(screen.getByLabelText('Actions du tableau'))
  fireEvent.click(screen.getByText('Modifier la course'))
  expect(onEditRace).toHaveBeenCalled()
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/components/plan/TableActionsMenu.test.tsx
```
Expected: FAIL (module `TableActionsMenu` introuvable).

- [ ] **Step 3: Créer le composant**

Créer `web/components/plan/TableActionsMenu.tsx` :
```tsx
'use client'

// Menu d'actions (⋮) du Tableau de course : Modifier la course / Modifier les
// lignes / Ré-importer / Exporter (sous-menu PDF·JPEG·Partager). Sans état métier :
// le parent (CoursePageClient) fournit les callbacks.
import { useState } from 'react'
import {
  MoreVertical, Pencil, Rows3, Download, Share, ChevronRight,
  FileText, Image as ImageIcon, Share2,
} from 'lucide-react'

type ExportKind = 'pdf' | 'jpeg' | 'share'

type Props = {
  onEditRace: () => void
  onEditLines: () => void
  onReimport: () => void
  onExport: (kind: ExportKind) => void
}

export function TableActionsMenu({ onEditRace, onEditLines, onReimport, onExport }: Props) {
  const [open, setOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const close = () => { setOpen(false); setExportOpen(false) }
  const run = (fn: () => void) => { fn(); close() }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Actions du tableau"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mr-1.5 rounded-md p-1.5 text-trail-muted hover:text-trail-text"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[210px] rounded-[10px] border border-trail-border bg-trail-surface p-1 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          >
            <MenuItem icon={<Pencil size={15} />} label="Modifier la course" onClick={() => run(onEditRace)} />
            <MenuItem icon={<Rows3 size={15} />} label="Modifier les lignes" onClick={() => run(onEditLines)} />
            <MenuItem icon={<Download size={15} />} label="Ré-importer" onClick={() => run(onReimport)} />
            <MenuItem
              icon={<Share size={15} />}
              label="Exporter"
              trailing={<ChevronRight size={15} className={`transition-transform ${exportOpen ? 'rotate-90' : ''}`} />}
              onClick={() => setExportOpen((v) => !v)}
            />
            {exportOpen && (
              <div className="my-0.5 ml-3 border-l border-trail-border pl-3">
                <MenuItem icon={<FileText size={15} />} label="PDF" onClick={() => run(() => onExport('pdf'))} />
                <MenuItem icon={<ImageIcon size={15} />} label="JPEG" onClick={() => run(() => onExport('jpeg'))} />
                <MenuItem icon={<Share2 size={15} />} label="Partager" onClick={() => run(() => onExport('share'))} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, trailing, onClick }: {
  icon: React.ReactNode
  label: string
  trailing?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-body-sm font-medium text-trail-text hover:bg-trail-border/30"
    >
      <span className="text-trail-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/components/plan/TableActionsMenu.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Lint**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx eslint components/plan/TableActionsMenu.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add web/components/plan/TableActionsMenu.tsx web/__tests__/components/plan/TableActionsMenu.test.tsx
git -C "c:/Users/Franc/app-run-mobile" commit -m "feat(plan): composant TableActionsMenu (kebab + sous-menu export)"
```

---

## Task 5 : Câbler le kebab dans `CoursePageClient` + retirer les liens du bas

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

- [ ] **Step 1: Importer le menu**

Après `import { WaypointsTable } from '@/components/plan/WaypointsTable'`, ajouter :
```tsx
import { TableActionsMenu } from '@/components/plan/TableActionsMenu'
```

- [ ] **Step 2: Ajouter l'état `editLines`**

Après `const [diffBusy, setDiffBusy] = useState(false)`, ajouter :
```tsx
  const [editLines, setEditLines] = useState(false)
```

- [ ] **Step 3: Ajouter le handler d'export**

Après `const reload = useCallback(…)` (ou n'importe où parmi les callbacks du composant, avant le `return`), ajouter :
```tsx
  // Export du tableau : ouvre la page /print (hub d'export). jpeg/share y sont
  // déclenchés au chargement / au tap (cf. print/page.tsx).
  const handleExport = useCallback((kind: 'pdf' | 'jpeg' | 'share') => {
    const base = `/plan/courses/${raceId}/print`
    const url = kind === 'pdf' ? base : `${base}?export=${kind}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [raceId])
```

- [ ] **Step 4: Monter le kebab au-dessus du tableau**

Juste **avant** `<WaypointsTable` (et après le bloc `{race.targetDurationMin != null && (<PacingStrategyCard … />)}`), insérer :
```tsx
            <div className="flex justify-end">
              <TableActionsMenu
                onEditRace={() => setEditorOpen(true)}
                onEditLines={() => setEditLines((v) => !v)}
                onReimport={() => setImportOpen(true)}
                onExport={handleExport}
              />
            </div>
```

- [ ] **Step 5: Passer les props contrôlées à `WaypointsTable`**

Ajouter `editLines` et `onEditLinesChange` aux props existantes :
```tsx
            <WaypointsTable
              waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
              onChange={handleWaypointsChange}
              startTime={race.startTime}
              targetDurationMin={race.targetDurationMin}
              pacingFade={race.pacingFade}
              onStartTimeChange={handleStartTimeChange}
              editLines={editLines}
              onEditLinesChange={setEditLines}
            />
```

- [ ] **Step 6: Retirer les liens du bas (Exporter en PDF / Ré-importer)**

Supprimer entièrement ce bloc :
```tsx
            <div className="mt-2 flex items-center gap-4">
              <a href={`/plan/courses/${raceId}/print`} target="_blank" rel="noopener noreferrer"
                className="text-caption text-trail-primary underline">
                Exporter en PDF
              </a>
              <button type="button" onClick={() => setImportOpen(true)}
                className="text-caption text-trail-muted underline">
                Ré-importer
              </button>
            </div>
```

- [ ] **Step 7: Vérifier types + lint**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit
```
Expected: PASS.
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx eslint "app/(main)/plan/courses/[id]/CoursePageClient.tsx"
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git -C "c:/Users/Franc/app-run-mobile" commit -m "feat(plan): menu kebab du tableau de course (modifier/ré-importer/exporter)"
```

---

## Task 6 : Export JPEG + Partage sur la page `/print`

But : ajouter les boutons **JPEG** et **Partager** à la toolbar, rasteriser la carte **à plat** via `html-to-image`, et auto-déclencher selon `?export=jpeg|share`.

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/print/page.tsx`

- [ ] **Step 1: Imports**

Modifier l'import React :
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
```
Et ajouter, après les imports existants :
```tsx
import { toJpeg } from 'html-to-image'
```

- [ ] **Step 2: Helpers de module**

Après la ligne `const pad = (n: number) => String(n).padStart(2, '0')`, ajouter :
```tsx
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tableau'

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
```

- [ ] **Step 3: Refs + état export + handlers (hooks AVANT les early returns)**

Juste après `const updateCfg = (next: PrintColConfig) => { setCfg(next); savePrintColConfig(next) }` et **avant** `if (!ready) return …`, ajouter :
```tsx
  const cardRef = useRef<HTMLDivElement>(null)
  const shareBtnRef = useRef<HTMLButtonElement>(null)
  const [flat, setFlat] = useState(false)
  const [busy, setBusy] = useState(false)

  // Rend la carte « à plat » (non tournée, comme à l'impression) puis la rasterise.
  const renderJpeg = useCallback(async () => {
    const el = cardRef.current
    if (!el) return null
    await document.fonts?.ready
    setFlat(true)
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    try {
      const dataUrl = await toJpeg(el, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 0.95, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      return { dataUrl, blob }
    } finally {
      setFlat(false)
    }
  }, [])

  const exportJpeg = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await renderJpeg()
      if (r && race) triggerDownload(r.dataUrl, `${slug(race.name)}.jpg`)
    } finally {
      setBusy(false)
    }
  }, [busy, renderJpeg, race])

  const shareJpeg = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await renderJpeg()
      if (!r || !race) return
      const file = new File([r.blob], `${slug(race.name)}.jpg`, { type: 'image/jpeg' })
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: race.name })
      } else {
        triggerDownload(r.dataUrl, `${slug(race.name)}.jpg`)
      }
    } catch {
      // partage annulé par l'utilisateur ou indisponible — silencieux
    } finally {
      setBusy(false)
    }
  }, [busy, renderJpeg, race])

  // Auto-déclenchement selon ?export= : jpeg télécharge directement ; share exige
  // un geste utilisateur → on met juste le focus sur le bouton « Partager ».
  useEffect(() => {
    if (!ready || !race) return
    const action = new URLSearchParams(window.location.search).get('export')
    if (action === 'jpeg') void exportJpeg()
    else if (action === 'share') shareBtnRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, race])
```

- [ ] **Step 4: Classe `.exporting` sur la racine**

Remplacer `<div className="pdfroot">` par :
```tsx
    <div className={flat ? 'pdfroot exporting' : 'pdfroot'}>
```

- [ ] **Step 5: Styles capture à plat**

Dans le `<style>`, juste **avant** le bloc `@page{…}`, ajouter :
```css
        /* Capture image (html-to-image) : carte à plat (non tournée), comme @media print. */
        .pdfroot.exporting .cardwrap{position:static;width:auto;height:auto;}
        .pdfroot.exporting .card{position:static;transform:none;top:auto;left:auto;margin:0 auto;box-shadow:none;}
        .pdfroot .btn:disabled{opacity:.5;cursor:default;}
```

- [ ] **Step 6: Brancher la ref sur la carte**

Remplacer `<div className="card">` par :
```tsx
        <div className="card" ref={cardRef}>
```

- [ ] **Step 7: Ajouter les boutons JPEG + Partager à la toolbar**

Remplacer la toolbar :
```tsx
      <div className="toolbar">
        <span className="ttl">Carte de course</span>
        <button className="btn ghost" onClick={() => setDialogOpen(true)}>Personnaliser les colonnes</button>
        <button className="btn" onClick={() => window.print()}>Imprimer / PDF</button>
      </div>
```
par :
```tsx
      <div className="toolbar">
        <span className="ttl">Carte de course</span>
        <button className="btn ghost" onClick={() => setDialogOpen(true)}>Personnaliser les colonnes</button>
        <button className="btn ghost" onClick={() => void exportJpeg()} disabled={busy}>JPEG</button>
        <button className="btn ghost" ref={shareBtnRef} onClick={() => void shareJpeg()} disabled={busy}>Partager</button>
        <button className="btn" onClick={() => window.print()}>Imprimer / PDF</button>
      </div>
```

- [ ] **Step 8: Vérifier types + lint**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit
```
Expected: PASS.
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx eslint "app/(main)/plan/courses/[id]/print/page.tsx"
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git -C "c:/Users/Franc/app-run-mobile" add "web/app/(main)/plan/courses/[id]/print/page.tsx"
git -C "c:/Users/Franc/app-run-mobile" commit -m "feat(plan): export JPEG + partage de la carte de course (html-to-image)"
```

---

## Task 7 : Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1: Types + lint global du périmètre**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit
```
Expected: PASS.
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx eslint components/plan/WaypointsTable.tsx components/plan/TableActionsMenu.tsx "app/(main)/plan/courses/[id]/CoursePageClient.tsx" "app/(main)/plan/courses/[id]/print/page.tsx"
```
Expected: PASS.

- [ ] **Step 2: Tests des deux suites ajoutées**

Run :
```bash
cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/components/plan/WaypointsTable.undo.test.tsx __tests__/components/plan/TableActionsMenu.test.tsx
```
Expected: PASS (2 suites).

- [ ] **Step 3: Vérification visuelle manuelle (`npm run dev`)**

Sur une course avec tableau importé (`/plan/courses/<id>`), vérifier :
1. La **légende** est désormais **en bas** du tableau.
2. Le **kebab (⋮)** est en haut-droite du tableau ; il ouvre 4 actions avec icônes.
3. **Modifier la course** → ouvre la modale d'édition de course.
4. **Modifier les lignes** → passe le tableau en mode édition (× + Ajouter + « ✓ Terminé »).
5. **Ré-importer** → ouvre la feuille d'import.
6. **Exporter** → déplie PDF / JPEG / Partager.
   - **PDF** → ouvre `/print`, « Imprimer / PDF » fonctionne.
   - **JPEG** → ouvre `/print?export=jpeg`, télécharge une image **à plat, fond blanc, lisible** (`<nom-course>.jpg`).
   - **Partager** → ouvre `/print?export=share` ; le tap sur « Partager » ouvre la feuille native (mobile) ou télécharge le JPEG (desktop, fallback).
7. En mode édition, **supprimer une ligne** → snackbar « Ligne supprimée — Annuler » ; **Annuler** restaure la ligne à sa place. Sans clic, le snackbar disparaît après ~6 s.

- [ ] **Step 4: Rappel déploiement / migration**

- Pas de migration Supabase (aucun changement de schéma).
- Déploiement = `git push` (Vercel auto-deploy). Ne pas `vercel --prod`.

---

## Notes de risque

- **Web Share fichiers** indisponible hors mobile/HTTPS → fallback téléchargement (géré).
- **Polices dans la capture** : `await document.fonts.ready` avant rasterisation ; si « Space Grotesk » manque sur l'image, augmenter le délai (2 rAF déjà prévus) ou pré-charger la police.
- **Reflow visible** : la carte se « déplie » brièvement pendant la capture (état `flat`). Acceptable ; sinon, capture hors-écran (non retenu — surcoût).
