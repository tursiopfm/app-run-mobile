# Proposer la recherche du tableau à la fin de la création — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À la fin de la création d'une course, proposer de chercher automatiquement le tableau (onglet Auto), avec recherche lancée directement ; garder l'onglet Auto dispo à tout moment.

**Architecture:** Câblage UI sur 3 fichiers existants : `RaceImportSheet` gagne une prop `autoSearch` qui lance `findRace()` à l'ouverture ; `CoursePageClient` lit `?import=auto` (via `window.location.search`) pour ouvrir la feuille sur l'onglet Auto + activer `autoSearch` ; `RaceEditorModal` affiche un écran « Course créée — chercher le tableau ? » après une création et navigue vers `/plan/courses/{id}?import=auto`. Aucune logique pure nouvelle, aucune migration DB.

**Tech Stack:** Next.js 14 (App Router, `next/navigation` router), React, TypeScript.

Spec : `docs/superpowers/specs/2026-06-11-propose-find-table-on-create-design.md`.

---

## Structure des fichiers

- **Modifier** `web/components/plan/RaceImportSheet.tsx` — prop `autoSearch?` + effet qui lance `findRace()` à l'ouverture.
- **Modifier** `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — lit `?import=auto` → ouvre la feuille + `autoSearch`, nettoie l'URL, reset à la fermeture.
- **Modifier** `web/components/plan/RaceEditorModal.tsx` — écran de proposition après création + navigation.

**Conventions :** typecheck `cd web && npx tsc --noEmit` ; lint `cd web && npx eslint <fichier>`. Working tree : modifs non liées (config/deps) présentes — ne stager QUE les fichiers de chaque tâche. Pas de tests unitaires (câblage UI ; la logique de recherche est déjà testée — cf. find-race) → vérification tsc/eslint + rendu headless en fin.

---

## Task 1 : `RaceImportSheet` — prop `autoSearch` + lancement auto

**Files:**
- Modify: `web/components/plan/RaceImportSheet.tsx`

- [ ] **Step 1 : ajouter la prop `autoSearch`**

Dans le type `Props`, ajouter le champ optionnel :
```ts
type Props = {
  raceId: string
  race: { name: string; date: string; distance: number; elevation: number }
  autoSearch?: boolean
  open: boolean
  onClose: () => void
  onSaved: (waypoints: RaceWaypoint[]) => void
}
```
Et la signature : `export function RaceImportSheet({ raceId, race, autoSearch, open, onClose, onSaved }: Props) {`

- [ ] **Step 2 : effet qui lance la recherche à l'ouverture**

Juste APRÈS la définition de la fonction `findRace()` (dans le composant), ajouter cet effet :
```ts
  // Ouverture en mode « auto » (depuis la création de course) : on lance la
  // recherche directement. L'effet de reset (défini plus haut, sur `open`) a déjà
  // remis l'onglet sur 'auto' et vidé les candidats.
  useEffect(() => {
    if (open && autoSearch) void findRace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoSearch])
```
(`useEffect` est déjà importé dans ce fichier.)

- [ ] **Step 3 : typecheck + lint**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx eslint "components/plan/RaceImportSheet.tsx"` (expect exit 0).

- [ ] **Step 4 : commit**

```bash
git add web/components/plan/RaceImportSheet.tsx
git commit -m "feat(plan): RaceImportSheet prop autoSearch (lance la recherche a l'ouverture)"
```

---

## Task 2 : `CoursePageClient` — ouvrir l'import en mode auto via l'URL

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

Contexte : `useRouter` est déjà importé et `const router = useRouter()` existe (~ligne 25). États existants : `importOpen` (~ligne 35). Le `<RaceImportSheet>` est rendu vers la ligne 217 avec `raceId`/`race`/`open`/`onClose`/`onSaved`.

- [ ] **Step 1 : état `autoSearch` + effet de montage lisant `?import=auto`**

Après la déclaration `const [importOpen, setImportOpen] = useState(false)`, ajouter :
```ts
  const [autoSearch, setAutoSearch] = useState(false)

  // Arrivée depuis « Oui, chercher » à la création (RaceEditorModal) :
  // ?import=auto → on ouvre la feuille sur l'onglet Auto et on lance la recherche.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('import') === 'auto') {
      setImportOpen(true)
      setAutoSearch(true)
      router.replace(`/plan/courses/${raceId}`) // retire le param (pas de ré-ouverture au refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```
(`useEffect` et `useState` sont déjà importés ; `router` et `raceId` sont en scope.)

- [ ] **Step 2 : passer `autoSearch` au sheet + reset à la fermeture**

Modifier le `<RaceImportSheet ...>` (~ligne 217) pour ajouter `autoSearch` et resetter à la fermeture :
```tsx
      <RaceImportSheet
        raceId={race.id}
        race={{ name: race.name, date: race.date, distance: race.distance, elevation: race.elevation }}
        autoSearch={autoSearch}
        open={importOpen}
        onClose={() => { setImportOpen(false); setAutoSearch(false) }}
        onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
      />
```

- [ ] **Step 3 : typecheck + lint**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx eslint "app/(main)/plan/courses/[id]/CoursePageClient.tsx"` (expect exit 0 ; il peut rester des warnings pré-existants — pas d'erreur nouvelle).

- [ ] **Step 4 : commit**

```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): ouvrir l'import en mode auto via ?import=auto (apres creation)"
```

---

## Task 3 : `RaceEditorModal` — écran « proposer » après création

**Files:**
- Modify: `web/components/plan/RaceEditorModal.tsx`

Contexte : `handleSave()` (~ligne 85) fait `await saveRace(toSave); onSaved(); onClose()`. `isEdit = race !== null` (ligne 40). L'effet de reset à l'ouverture est ~ligne 57-64. Le rendu principal commence par `return createPortal(` (~ligne 127). Pas de `useRouter` aujourd'hui.

- [ ] **Step 1 : import router + état createdId + reset**

a) Ajouter l'import (sous les imports existants en tête, ex. après `import { createPortal } from 'react-dom'`) :
```ts
import { useRouter } from 'next/navigation'
```
b) Dans le composant, après `const [saving, setSaving] = useState(false)` (~ligne 42), ajouter :
```ts
  const router = useRouter()
  const [createdId, setCreatedId] = useState<string | null>(null)
```
c) Dans l'effet de reset à l'ouverture (`if (open) { ... }`, ~ligne 57-64), ajouter en première ligne du bloc :
```ts
      setCreatedId(null)
```

- [ ] **Step 2 : brancher la création sur l'écran de proposition**

Dans `handleSave()`, remplacer la fin :
```ts
      await saveRace(toSave)
      onSaved()
      onClose()
```
par :
```ts
      await saveRace(toSave)
      onSaved()
      if (isEdit) {
        onClose()
      } else {
        setCreatedId(toSave.id)   // création → on propose de chercher le tableau
      }
```
(Le `finally { setSaving(false) }` reste inchangé.)

- [ ] **Step 3 : rendre l'écran de proposition (early return)**

Juste AVANT le `return createPortal(` principal (~ligne 127), ajouter ce bloc :
```tsx
  if (createdId) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-lg p-6 pb-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[40px] leading-none mb-2" aria-hidden>✓</div>
          <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Course créée</h2>
          <p className="text-body-sm text-trail-muted mb-5">
            Chercher le tableau de course automatiquement (ravitos, barrières, objectif) ?
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { router.push(`/plan/courses/${createdId}?import=auto`); onClose() }}
              className="w-full py-2 rounded-[10px] bg-trail-primary text-white text-body-sm font-semibold"
            >
              Oui, chercher
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-[10px] border border-trail-border text-trail-text text-body-sm"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }
```
(Cet `if` est placé après les early-returns existants `if (!open) return null` / `if (typeof document === 'undefined') return null`, donc l'écran ne s'affiche que quand la modale est ouverte ET qu'on vient de créer.)

- [ ] **Step 4 : typecheck + lint**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx eslint "components/plan/RaceEditorModal.tsx"` (expect exit 0).

- [ ] **Step 5 : vérification visuelle headless de l'écran « proposer »**

Construire un mock `$TEMP/_created.html` reprenant la carte modale (fond `bg-trail-card` ~#16201d, bordure ~#2A332F, primaire ~#FF6B35) avec : ✓, « Course créée », le texte de proposition, bouton plein « Oui, chercher », bouton outline « Plus tard ». Rendre :
```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"; [ -f "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless --disable-gpu --hide-scrollbars --screenshot="$TEMP/_created.png" --window-size=420,360 --force-device-scale-factor=2 "file:///C:/Users/Franc/AppData/Local/Temp/_created.html"
```
Lire `$TEMP/_created.png` : écran lisible, 2 boutons distincts. Mock jetable (`$TEMP`, pas le repo).

- [ ] **Step 6 : commit**

```bash
git add web/components/plan/RaceEditorModal.tsx
git commit -m "feat(plan): proposer la recherche du tableau a la fin de la creation de course"
```

---

## Vérification de fin

- [ ] `cd web && npx tsc --noEmit` → exit 0.
- [ ] `cd web && npx eslint "components/plan/RaceImportSheet.tsx" "components/plan/RaceEditorModal.tsx" "app/(main)/plan/courses/[id]/CoursePageClient.tsx"` → pas d'erreur nouvelle.
- [ ] Vérif manuelle (après déploiement) : créer une course → écran « Course créée — chercher le tableau ? » → **[Oui, chercher]** → arrive sur la page course, feuille d'import ouverte sur l'onglet Auto, recherche déjà lancée. **[Plus tard]** → ferme, course créée, pas de navigation. Édition d'une course existante → pas d'écran de proposition.

## Notes de drift / hors-périmètre

- Pas de changement en mode édition.
- L'onglet Auto reste dispo à tout moment dans l'import (inchangé).
- `window.location.search` (pas `useSearchParams`) → évite l'exigence de Suspense de Next 14 et reste client-only (effet de montage).
