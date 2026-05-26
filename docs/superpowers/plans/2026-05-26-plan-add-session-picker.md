# Plan d'implémentation — Picker d'ajout de séance (Plan tab)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercaler un bottom-sheet picker entre le `+` d'une journée (vues semaine et mois) et l'éditeur `SessionEditorModal`, pour proposer soit la création vierge soit la sélection d'un template de la bibliothèque (pré-remplissage de l'éditeur).

**Architecture:** Nouveau composant `SessionAddSheet.tsx` (portal modale). Extraction de `TemplateCard` et `FilterBar` depuis `BibliothequeSeancesBlock` vers `web/components/plan/library/` pour partage. Ajout d'une prop `prefillTemplate` à `SessionEditorModal`. Pas de migration SQL, pas de changement data-model.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, `@dnd-kit/core`, Jest + React Testing Library. i18n via `useT()` (clés dans `web/lib/i18n/dictionaries/{fr,en}.ts`).

**Spec source:** [docs/superpowers/specs/2026-05-26-plan-add-session-picker-design.md](../specs/2026-05-26-plan-add-session-picker-design.md)
**Mockup visuel:** [Prompts/plan-add-session-sheet-mockup.html](../../../Prompts/plan-add-session-sheet-mockup.html)

---

## File structure

**Créés :**
- `web/components/plan/library/TemplateCard.tsx` — carte template avec prop `mode: 'drag' | 'pick'`
- `web/components/plan/library/FilterBar.tsx` — barre de pills + search avec prop `variant: 'full' | 'compact'`
- `web/components/plan/SessionAddSheet.tsx` — bottom-sheet picker
- `web/__tests__/components/plan/library/TemplateCard.test.tsx`
- `web/__tests__/components/plan/library/FilterBar.test.tsx`
- `web/__tests__/components/plan/SessionAddSheet.test.tsx`
- `web/__tests__/components/plan/SessionEditorModal.test.tsx` (n'existait pas)

**Modifiés :**
- `web/components/plan/BibliothequeSeancesBlock.tsx` — consomme `library/TemplateCard` + `library/FilterBar`
- `web/components/plan/SessionEditorModal.tsx` — ajout prop `prefillTemplate?: SessionTemplate | null` + bandeau pré-remplissage + classe CSS `prefilled`
- `web/components/plan/VueSemaineBlock.tsx` — `openCreate(dateISO)` ouvre `SessionAddSheet` au lieu de `SessionEditorModal`
- `web/components/plan/DayDetailPanel.tsx` — idem
- `web/lib/i18n/dictionaries/fr.ts` + interface `Dict` — clés `plan.add*`
- `web/lib/i18n/dictionaries/en.ts` — clés `plan.add*`

---

## Task 1 : Extraire `TemplateCard` vers `library/`

**Files:**
- Create: `web/components/plan/library/TemplateCard.tsx`
- Test: `web/__tests__/components/plan/library/TemplateCard.test.tsx`

But : déplacer la fonction `TemplateCard` actuellement définie inline dans [BibliothequeSeancesBlock.tsx:453-516](../../../web/components/plan/BibliothequeSeancesBlock.tsx#L453-L516), avec une nouvelle prop `mode: 'drag' | 'pick'` :
- `drag` (défaut) : comportement actuel (useDraggable + bouton ✕)
- `pick` : pas de DnD, pas de bouton ✕, clic = `onSelect(template)`

- [ ] **Step 1.1 : Écrire les tests du nouveau composant**

```tsx
// web/__tests__/components/plan/library/TemplateCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import type { SessionTemplate } from '@/types/plan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const TPL: SessionTemplate = {
  id: 'tpl-1', title: 'VMA 10×400m', type: 'fractionne',
  defaultDuration: 45, defaultDistance: 8,
  defaultIntensity: 5, description: 'Séance VMA classique', tags: ['vma'],
}

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider initialLocale="fr">
      <DndContext>{ui}</DndContext>
    </I18nProvider>
  )
}

describe('<TemplateCard>', () => {
  it('renders title, type label, duration and distance', () => {
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="drag" onClick={() => {}} onDelete={() => {}} />))
    expect(screen.getByText('VMA 10×400m')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('8 km')).toBeInTheDocument()
  })

  it('mode=drag shows delete button and triggers onDelete', () => {
    const onDelete = jest.fn()
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="drag" onClick={() => {}} onDelete={onDelete} />))
    const btn = screen.getByLabelText(/supprimer/i)
    fireEvent.click(btn)
    expect(onDelete).toHaveBeenCalled()
  })

  it('mode=pick hides delete button and clicking calls onClick (no DnD attachment)', () => {
    const onClick = jest.fn()
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="pick" onClick={onClick} onDelete={() => {}} />))
    expect(screen.queryByLabelText(/supprimer/i)).toBeNull()
    fireEvent.click(screen.getByText('VMA 10×400m'))
    expect(onClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.2 : Lancer les tests, vérifier qu'ils échouent (module introuvable)**

Run (depuis `web/`) :
```bash
npx jest __tests__/components/plan/library/TemplateCard.test.tsx
```
Expected: FAIL avec `Cannot find module '@/components/plan/library/TemplateCard'`.

- [ ] **Step 1.3 : Créer le nouveau composant en copiant la version inline**

Crée `web/components/plan/library/TemplateCard.tsx`. Copie le contenu de la fonction `TemplateCard` et de ses dépendances (`pickTextColor` n'est PAS utilisé par TemplateCard — il reste dans FilterPill ; `IntensityBar` est utilisé seulement par TemplateCard, on le déplace avec). Ajoute la prop `mode` :

```tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import type { SessionTemplate } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Mode = 'drag' | 'pick'

export function TemplateCard({
  template, types, isCustom, mode, onClick, onDelete,
}: {
  template: SessionTemplate
  types: ActivityType[]
  isCustom: boolean
  mode: Mode
  onClick: () => void
  onDelete: () => void
}) {
  const L = useT().plan
  const meta = resolveSessionMeta(template.type, types)
  // useDraggable est toujours instancié pour respecter les règles des hooks,
  // mais en mode 'pick' on n'attache pas les listeners.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'session-template', template },
    disabled: mode === 'pick',
  })

  const dragProps = mode === 'drag' ? { ...attributes, ...listeners } : {}

  return (
    <div
      ref={mode === 'drag' ? setNodeRef : undefined}
      {...dragProps}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'pan-y' }}
      className={`relative rounded-[8px] border bg-trail-surface p-2 cursor-pointer transition-colors ${
        isCustom ? 'border-trail-primary/30 hover:border-trail-primary' : 'border-trail-border hover:border-trail-primary/40'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={L.libTemplateCardAria(L.sessionTemplates[template.id]?.title ?? template.title)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {mode === 'drag' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={L.libTemplateDeleteAria(L.sessionTemplates[template.id]?.title ?? template.title)}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-danger hover:border-trail-danger text-[11px] leading-none z-10"
        >
          ✕
        </button>
      )}
      <p className="text-[10px] font-semibold text-trail-muted uppercase tracking-wider pr-6">
        {meta.label}
      </p>
      <h4
        className="mt-1 text-[14px] text-trail-text leading-tight"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
      >
        {L.sessionTemplates[template.id]?.title ?? template.title}
      </h4>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] text-trail-muted">
        {template.defaultDuration > 0 && <span>{template.defaultDuration} min</span>}
        {template.defaultDistance != null && <span>{template.defaultDistance} km</span>}
        {template.defaultElevation != null && <span>{template.defaultElevation} m D+</span>}
      </div>
      <IntensityBar level={template.defaultIntensity} L={L} />
    </div>
  )
}

function IntensityBar({ level, L }: { level: 1 | 2 | 3 | 4 | 5; L: Dict['plan'] }) {
  const color = INTENSITY_LEVEL_COLORS[level]
  return (
    <div className="mt-2 flex gap-[2px]" aria-label={L.libIntensityBarAria(level)}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-[2px]"
          style={{ backgroundColor: i <= level ? color : 'var(--trail-border)' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 1.4 : Lancer les tests, vérifier qu'ils passent**

Run :
```bash
npx jest __tests__/components/plan/library/TemplateCard.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 1.5 : Commit**

```bash
git add web/components/plan/library/TemplateCard.tsx web/__tests__/components/plan/library/TemplateCard.test.tsx
git commit -m "feat(plan): extract TemplateCard to library/ with mode prop"
```

---

## Task 2 : Extraire `FilterBar` vers `library/`

**Files:**
- Create: `web/components/plan/library/FilterBar.tsx`
- Test: `web/__tests__/components/plan/library/FilterBar.test.tsx`

But : déplacer `FilterBar`, `FilterPill`, `ExpandToggle` et `pickTextColor` de [BibliothequeSeancesBlock.tsx:280-451](../../../web/components/plan/BibliothequeSeancesBlock.tsx#L280-L451) vers le nouveau fichier. Ajouter la prop `variant: 'full' | 'compact'` :
- `full` (défaut) : comportement actuel (Tous + peek + ExpandToggle + ⚙ Personnalisé + collapse animé)
- `compact` : Tous + tous les `visibleTypes` dans une seule rangée scrollable horizontale, pas d'expand, pas de bouton préfs

- [ ] **Step 2.1 : Écrire les tests**

```tsx
// web/__tests__/components/plan/library/FilterBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/plan/library/FilterBar'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ActivityType } from '@/types/activity-types'

const TYPES: ActivityType[] = [
  { id: 't1', slug: 'fractionne', label: 'Fractionné', defaultIntensity: 5, category: 'run', isSystem: true },
  { id: 't2', slug: 'seuil_tempo', label: 'Seuil', defaultIntensity: 4, category: 'run', isSystem: true },
]
const VISIBLE = TYPES.map(t => ({ slug: t.slug, label: t.label }))

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLocale="fr">{ui}</I18nProvider>
}

describe('<FilterBar>', () => {
  it('variant=compact renders all visibleTypes in a single row, no expand toggle, no prefs button', () => {
    render(wrap(
      <FilterBar
        variant="compact"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        onSelectType={() => {}}
      />
    ))
    expect(screen.getByRole('tab', { name: /Toutes/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Fractionné/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Seuil/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /personnalisé/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Afficher/i })).toBeNull()
  })

  it('variant=full renders expand toggle and prefs button', () => {
    render(wrap(
      <FilterBar
        variant="full"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        filtersExpanded={false}
        onSelectType={() => {}}
        onToggleExpand={() => {}}
        onOpenPrefs={() => {}}
      />
    ))
    expect(screen.getByLabelText(/personnalisé/i)).toBeInTheDocument()
  })

  it('selecting a type pill calls onSelectType with the slug', () => {
    const onSelectType = jest.fn()
    render(wrap(
      <FilterBar
        variant="compact"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        onSelectType={onSelectType}
      />
    ))
    fireEvent.click(screen.getByRole('tab', { name: /Fractionné/i }))
    expect(onSelectType).toHaveBeenCalledWith('fractionne')
  })
})
```

- [ ] **Step 2.2 : Lancer les tests, vérifier qu'ils échouent**

Run : `npx jest __tests__/components/plan/library/FilterBar.test.tsx`
Expected: FAIL avec `Cannot find module`.

- [ ] **Step 2.3 : Créer le fichier `library/FilterBar.tsx`**

Copie intégralement les fonctions `FilterBar`, `FilterPill`, `ExpandToggle`, `pickTextColor` depuis `BibliothequeSeancesBlock.tsx`. Modifie la signature et le rendu pour supporter les deux variants :

```tsx
'use client'

import type { ActivityType } from '@/types/activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type BaseProps = {
  visibleTypes: { slug: string; label: string }[]
  types: ActivityType[]
  selectedType: string | 'all'
  onSelectType: (slug: string | 'all') => void
}

type FullProps = BaseProps & {
  variant: 'full'
  filtersExpanded: boolean
  onToggleExpand: () => void
  onOpenPrefs: () => void
}

type CompactProps = BaseProps & {
  variant: 'compact'
}

export type FilterBarProps = FullProps | CompactProps

export function FilterBar(props: FilterBarProps) {
  const L = useT().plan
  const activityLabels = useT().activities.sessionTypeLabels as Record<string, string>
  const typeLabel = (slug: string, fallback: string) => activityLabels[slug] ?? fallback

  if (props.variant === 'compact') {
    return (
      <div role="tablist" aria-label={L.libFilterByTypeAria}>
        <div
          className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          <FilterPill
            active={props.selectedType === 'all'}
            onClick={() => props.onSelectType('all')}
            label={L.libFilterAll}
          />
          {props.visibleTypes.map(t => (
            <FilterPill
              key={t.slug}
              active={props.selectedType === t.slug}
              onClick={() => props.onSelectType(t.slug)}
              label={typeLabel(t.slug, t.label)}
              color={resolveSessionMeta(t.slug, props.types).color}
            />
          ))}
        </div>
      </div>
    )
  }

  // variant='full' — code existant tel quel (collapse + peek + ExpandToggle + ⚙)
  const { filtersExpanded, onToggleExpand, onOpenPrefs } = props
  const hasActiveFilter = props.selectedType !== 'all'
  const activeType = hasActiveFilter
    ? props.visibleTypes.find(t => t.slug === props.selectedType)
    : null
  const peekActiveOnly = !filtersExpanded && activeType

  return (
    <div role="tablist" aria-label={L.libFilterByTypeAria}>
      <div
        className="flex items-center gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <FilterPill
          active={props.selectedType === 'all'}
          onClick={() => props.onSelectType('all')}
          label={L.libFilterAll}
        />
        {peekActiveOnly && activeType && (
          <FilterPill
            key={`peek-${activeType.slug}`}
            active
            onClick={() => props.onSelectType(activeType.slug)}
            label={typeLabel(activeType.slug, activeType.label)}
            color={resolveSessionMeta(activeType.slug, props.types).color}
          />
        )}
        <ExpandToggle
          expanded={filtersExpanded}
          count={props.visibleTypes.length}
          onClick={onToggleExpand}
          L={L}
        />
        <FilterPill onClick={onOpenPrefs} label={L.libFilterCustom} isCustom />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: filtersExpanded ? '1fr' : '0fr' }}
        aria-hidden={!filtersExpanded}
      >
        <div className="overflow-hidden">
          <div className="filter-bar-scroll mt-2 flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {props.visibleTypes.map(t => (
              <FilterPill
                key={t.slug}
                active={props.selectedType === t.slug}
                onClick={() => props.onSelectType(t.slug)}
                label={typeLabel(t.slug, t.label)}
                color={resolveSessionMeta(t.slug, props.types).color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers internes (copiés tels quels depuis BibliothequeSeancesBlock) ───
function pickTextColor(hex?: string): string {
  if (!hex) return '#fff'
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#fff'
  const v = parseInt(m[1], 16)
  const r = (v >> 16) & 0xff
  const g = (v >> 8) & 0xff
  const b = v & 0xff
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 150 ? '#000' : '#fff'
}

function FilterPill({
  active, onClick, label, isCustom, color,
}: { active?: boolean; onClick: () => void; label: string; isCustom?: boolean; color?: string }) {
  let cls = 'flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors'
  let inlineStyle: React.CSSProperties = { scrollSnapAlign: 'start' }
  if (isCustom) {
    cls += ' border border-trail-border bg-transparent text-trail-muted hover:text-trail-text hover:border-trail-primary'
  } else if (active && color) {
    cls += ' border'
    inlineStyle = { ...inlineStyle, backgroundColor: color, borderColor: color, color: pickTextColor(color) }
  } else if (active) {
    cls += ' bg-trail-primary text-white border border-trail-primary'
  } else {
    cls += ' bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text'
  }
  return (
    <button type="button" role="tab" aria-selected={!!active} onClick={onClick} style={inlineStyle} className={cls}>
      {label}
    </button>
  )
}

function ExpandToggle({
  expanded, count, onClick, L,
}: { expanded: boolean; count: number; onClick: () => void; L: Dict['plan'] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? L.libFilterCollapseAria : L.libFilterExpandAria(count)}
      className="group flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border border-trail-primary/40 bg-trail-primary/5 text-trail-primary text-[12px] font-semibold hover:bg-trail-primary/15 hover:border-trail-primary/70 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        className="transition-transform duration-300"
        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        aria-hidden
      >
        <polyline points="9 6 15 12 9 18" />
      </svg>
      {!expanded && <span className="text-[10px] opacity-80 tabular-nums">{count}</span>}
    </button>
  )
}
```

- [ ] **Step 2.4 : Lancer les tests, vérifier qu'ils passent**

Run : `npx jest __tests__/components/plan/library/FilterBar.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 2.5 : Commit**

```bash
git add web/components/plan/library/FilterBar.tsx web/__tests__/components/plan/library/FilterBar.test.tsx
git commit -m "feat(plan): extract FilterBar to library/ with variant prop"
```

---

## Task 3 : Refactorer `BibliothequeSeancesBlock` pour consommer les extractions

**Files:**
- Modify: `web/components/plan/BibliothequeSeancesBlock.tsx`

Aucun test dédié au bloc → on s'appuie sur le type-check + un smoke manuel dans `npm run dev`.

- [ ] **Step 3.1 : Supprimer les fonctions `TemplateCard`, `FilterBar`, `FilterPill`, `ExpandToggle`, `IntensityBar`, `pickTextColor` du fichier**

Dans `web/components/plan/BibliothequeSeancesBlock.tsx`, supprime tout ce qui se trouve entre [le commentaire `// ─── Sous-composants` et la fin du fichier](../../../web/components/plan/BibliothequeSeancesBlock.tsx#L278) (lignes 278 à 536). Ne touche pas au composant principal `BibliothequeSeancesBlock`.

- [ ] **Step 3.2 : Mettre à jour les imports en tête du fichier**

Remplace les imports devenus inutiles (`useDraggable`, `INTENSITY_LEVEL_COLORS`) si tu vois qu'ils ne sont plus utilisés par le composant principal. Ajoute :

```tsx
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import { FilterBar } from '@/components/plan/library/FilterBar'
```

Vérifie aussi : `resolveSessionMeta` est-il encore utilisé dans le composant principal ? Si non, retire-le aussi.

- [ ] **Step 3.3 : Mettre à jour les sites d'utilisation (le composant principal `BibliothequeSeancesBlock`)**

Dans le JSX de `BibliothequeSeancesBlock`, l'appel à `<FilterBar>` (lignes ~184-193) doit gagner la prop `variant="full"`. Les appels à `<TemplateCard>` (ligne ~213) doivent gagner `mode="drag"`. Concrètement :

```tsx
{/* avant */}
<FilterBar
  visibleTypes={visibleTypes}
  types={types}
  selectedType={selectedType}
  filtersExpanded={filtersExpanded}
  onSelectType={setSelectedType}
  onToggleExpand={() => setFiltersExpanded(e => !e)}
  onOpenPrefs={() => setPrefsModalOpen(true)}
  L={L}
/>

{/* après */}
<FilterBar
  variant="full"
  visibleTypes={visibleTypes}
  types={types}
  selectedType={selectedType}
  filtersExpanded={filtersExpanded}
  onSelectType={setSelectedType}
  onToggleExpand={() => setFiltersExpanded(e => !e)}
  onOpenPrefs={() => setPrefsModalOpen(true)}
/>
```

Et pour `TemplateCard` :

```tsx
{/* avant */}
<TemplateCard
  key={t.id}
  template={t}
  types={types}
  isCustom={customIds.has(t.id)}
  onClick={() => openEdit(t)}
  onDelete={() => requestDelete(t)}
  L={L}
/>

{/* après */}
<TemplateCard
  key={t.id}
  template={t}
  types={types}
  isCustom={customIds.has(t.id)}
  mode="drag"
  onClick={() => openEdit(t)}
  onDelete={() => requestDelete(t)}
/>
```

Note : la prop `L` disparaît (les composants extraits utilisent `useT()` directement).

- [ ] **Step 3.4 : Lancer le type-check**

Run :
```bash
npx tsc --noEmit -p .
```
Expected: aucune erreur.

- [ ] **Step 3.5 : Lancer la suite de tests complète**

Run :
```bash
npm test -- --ci
```
Expected: tous les tests PASS, dont les 6 nouveaux des tâches 1 et 2.

- [ ] **Step 3.6 : Smoke test manuel**

Lance `npm run dev`, va sur `/plan`, vérifie que la bibliothèque s'affiche identiquement à avant : pills, search, expand/collapse, drag d'un template vers un jour de la semaine, suppression d'un template custom.

- [ ] **Step 3.7 : Commit**

```bash
git add web/components/plan/BibliothequeSeancesBlock.tsx
git commit -m "refactor(plan): BibliothequeSeancesBlock consomme library/{TemplateCard,FilterBar}"
```

---

## Task 4 : Ajouter les clés i18n `plan.add*`

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts`
- Modify: `web/lib/i18n/dictionaries/en.ts`

- [ ] **Step 4.1 : Ajouter le bloc `add*` dans l'interface `Dict.plan` (`fr.ts`)**

Cherche dans `web/lib/i18n/dictionaries/fr.ts` la section `plan: { ... }` de l'interface `Dict` (vers ligne 540). Juste après la fin du bloc `lib*` (avant la déclaration `session*`), insère :

```ts
    // SessionAddSheet (picker d'ajout)
    addTitle: string
    addCreateBtn: string
    addOrLibrary: string
    addSearchPh: string
    addNoMatch: string
    addReset: string
    addEmpty: string
    addPrefillBanner: (templateTitle: string) => string
    addCloseAria: string
    addPickAria: (templateTitle: string) => string
```

- [ ] **Step 4.2 : Ajouter les valeurs françaises**

Cherche la ligne `libManageTypes:      'Gérer les types',` (vers ligne 2330). Juste après le bloc `lib*` (avant `sessionEditTitle`), insère :

```ts
    // SessionAddSheet
    addTitle:            'Ajouter une séance',
    addCreateBtn:        '+ Créer une nouvelle séance',
    addOrLibrary:        'Ou choisir dans la bibliothèque',
    addSearchPh:         'Rechercher une séance…',
    addNoMatch:          'Aucune séance ne correspond',
    addReset:            'Réinitialiser les filtres',
    addEmpty:            'Aucune séance dans ta bibliothèque',
    addPrefillBanner:    (t: string) => `✨ Pré-rempli depuis ${t}`,
    addCloseAria:        'Fermer le sélecteur',
    addPickAria:         (t: string) => `Choisir le template ${t}`,
```

- [ ] **Step 4.3 : Ajouter les valeurs anglaises dans `en.ts`**

Cherche la ligne `libManageTypes:      'Manage types',` dans `web/lib/i18n/dictionaries/en.ts`. Juste après le bloc `lib*` (avant `sessionEditTitle`), insère :

```ts
    // SessionAddSheet
    addTitle:            'Add a session',
    addCreateBtn:        '+ Create new session',
    addOrLibrary:        'Or pick from library',
    addSearchPh:         'Search a session…',
    addNoMatch:          'No session matches',
    addReset:            'Reset filters',
    addEmpty:            'Your library is empty',
    addPrefillBanner:    (t: string) => `✨ Prefilled from ${t}`,
    addCloseAria:        'Close picker',
    addPickAria:         (t: string) => `Pick template ${t}`,
```

- [ ] **Step 4.4 : Vérifier le type-check**

Run :
```bash
npx tsc --noEmit -p .
```
Expected: aucune erreur (les deux dicos respectent l'interface).

- [ ] **Step 4.5 : Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "feat(i18n): add plan.add* keys for SessionAddSheet picker"
```

---

## Task 5 : Ajouter `prefillTemplate` à `SessionEditorModal`

**Files:**
- Modify: `web/components/plan/SessionEditorModal.tsx`
- Create: `web/__tests__/components/plan/SessionEditorModal.test.tsx`

- [ ] **Step 5.1 : Écrire les tests**

Le fichier n'existe pas encore. Crée `web/__tests__/components/plan/SessionEditorModal.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { SessionEditorModal } from '@/components/plan/SessionEditorModal'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { SessionTemplate } from '@/types/plan'

// Mocks pour éviter Supabase et le storage durant les tests unitaires
jest.mock('@/lib/plan/storage', () => ({
  savePlannedSession: jest.fn().mockResolvedValue(undefined),
  deletePlannedSession: jest.fn().mockResolvedValue(undefined),
  getCurrentPlan: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/plan/use-activity-types', () => ({
  useActivityTypes: () => ({ visibleTypes: [], types: [] }),
}))

const TPL: SessionTemplate = {
  id: 'tpl-vma', title: 'VMA 10×400m', type: 'fractionne',
  defaultDuration: 45, defaultDistance: 8,
  defaultIntensity: 5, description: 'Séance VMA', tags: ['vma'],
}

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLocale="fr">{ui}</I18nProvider>
}

describe('<SessionEditorModal> prefillTemplate', () => {
  it('without prefillTemplate, opens with empty default draft', () => {
    render(wrap(
      <SessionEditorModal
        session={null} initialDate="2026-05-13" open
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    // pas de bandeau
    expect(screen.queryByText(/Pré-rempli depuis/)).toBeNull()
    // titre vide
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('')
  })

  it('with prefillTemplate, prefills fields and shows the banner', () => {
    render(wrap(
      <SessionEditorModal
        session={null} initialDate="2026-05-13" open
        prefillTemplate={TPL}
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    expect(screen.getByText(/Pré-rempli depuis/)).toHaveTextContent('VMA 10×400m')
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('VMA 10×400m')
  })

  it('with both session AND prefillTemplate, session wins (edit mode)', () => {
    render(wrap(
      <SessionEditorModal
        session={{
          id: 's1', planId: 'p1', date: '2026-05-13', type: 'footing',
          title: 'Mon footing', duration: 60, intensity: 1,
          estimatedCharge: 48, status: 'planned',
        }}
        open
        prefillTemplate={TPL}
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    expect(screen.queryByText(/Pré-rempli depuis/)).toBeNull()
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('Mon footing')
  })
})
```

- [ ] **Step 5.2 : Lancer les tests, vérifier qu'ils échouent**

Run : `npx jest __tests__/components/plan/SessionEditorModal.test.tsx`
Expected: 3 tests FAIL (prop `prefillTemplate` inconnue, bandeau absent).

- [ ] **Step 5.3 : Modifier `SessionEditorModal.tsx` — ajouter la prop**

Dans le type `Props` (vers ligne 56), ajoute :

```ts
type Props = {
  session: PlannedSession | null
  initialDate?: string
  open: boolean
  /**
   * Si fourni et `session === null`, initialise le draft avec les valeurs du template
   * et affiche un bandeau « Pré-rempli depuis <titre> ». Ignoré en mode édition.
   */
  prefillTemplate?: SessionTemplate | null
  matchedActivities?: MatchableActivity[] | null
  onUnlink?: (sessionId: string, activityIds: string[]) => void
  onClose: () => void
  onSaved: () => void
}
```

Ajoute l'import en tête :

```ts
import type { PlannedSession, SessionTemplate, /* … existants … */ } from '@/types/plan'
```
(le type `SessionTemplate` doit être ajouté à l'import existant depuis `@/types/plan`).

- [ ] **Step 5.4 : Ajouter une factory `draftFromTemplate`**

Juste après `emptyDraft` (vers ligne 94), ajoute :

```ts
function draftFromTemplate(tpl: SessionTemplate, initialDate: string | undefined): PlannedSession {
  return {
    id: '',
    planId: '',
    date: initialDate ?? todayISO(),
    type: tpl.type,
    title: tpl.title,
    duration: tpl.defaultDuration,
    distance: tpl.defaultDistance,
    elevation: tpl.defaultElevation,
    intensity: tpl.defaultIntensity,
    estimatedCharge: estimateCharge(tpl.defaultDuration, tpl.defaultIntensity, tpl.defaultElevation),
    zones: undefined,
    notes: undefined,
    status: 'planned',
  }
}
```

- [ ] **Step 5.5 : Mettre à jour la signature et l'initialisation du state**

Dans la signature du composant (ligne 112-114), ajoute `prefillTemplate` :

```ts
export function SessionEditorModal({
  session, initialDate, open, prefillTemplate, matchedActivities, onUnlink, onClose, onSaved,
}: Props) {
```

Dans le `useState` initial du draft (ligne 117), modifie :

```ts
const [draft, setDraft] = useState<PlannedSession>(
  () => session ?? (prefillTemplate ? draftFromTemplate(prefillTemplate, initialDate) : emptyDraft(initialDate))
)
```

Et dans le `useEffect` qui reset le draft à l'ouverture (ligne 124-131), modifie :

```ts
useEffect(() => {
  if (open) {
    const base = session
      ?? (prefillTemplate ? draftFromTemplate(prefillTemplate, initialDate) : emptyDraft(initialDate))
    setDraft(base)
    setTab('general')
    setChargeOverridden(isEdit)
  }
}, [open, session, initialDate, isEdit, prefillTemplate])
```

- [ ] **Step 5.6 : Afficher le bandeau « Pré-rempli depuis »**

Repère dans le JSX du composant le bloc qui affiche le titre + le bandeau `matchedActivities` (vers ligne 230). Juste après le bloc `matchedActivities` et **avant** le bloc `Tabs` (ligne ~287), ajoute :

```tsx
{!isEdit && prefillTemplate && (
  <div
    className="flex items-center gap-2 mb-3 p-2 rounded-[10px] border border-dashed"
    style={{
      backgroundColor: `${colors.chargeOrange}1A`,
      borderColor: `${colors.chargeOrange}66`,
      color: colors.chargeOrange,
    }}
    role="status"
  >
    <span aria-hidden>✨</span>
    <span className="text-[12px] font-semibold">
      {L.addPrefillBanner(L.sessionTemplates[prefillTemplate.id]?.title ?? prefillTemplate.title)}
    </span>
  </div>
)}
```

- [ ] **Step 5.7 : Lancer les tests, vérifier qu'ils passent**

Run : `npx jest __tests__/components/plan/SessionEditorModal.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5.8 : Type-check**

Run : `npx tsc --noEmit -p .`
Expected: aucune erreur.

- [ ] **Step 5.9 : Commit**

```bash
git add web/components/plan/SessionEditorModal.tsx web/__tests__/components/plan/SessionEditorModal.test.tsx
git commit -m "feat(plan): SessionEditorModal supports prefillTemplate prop"
```

---

## Task 6 : Créer `SessionAddSheet`

**Files:**
- Create: `web/components/plan/SessionAddSheet.tsx`
- Test: `web/__tests__/components/plan/SessionAddSheet.test.tsx`

- [ ] **Step 6.1 : Écrire les tests**

```tsx
// web/__tests__/components/plan/SessionAddSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionAddSheet } from '@/components/plan/SessionAddSheet'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { SessionTemplate } from '@/types/plan'

// Mocks storage : on n'a besoin que des templates custom (vide) et des hidden ids (vide)
jest.mock('@/lib/plan/storage', () => ({
  getCustomTemplates: jest.fn().mockResolvedValue([]),
  getHiddenSystemTemplateIds: jest.fn().mockReturnValue([]),
}))
jest.mock('@/lib/training/session-templates', () => ({
  SESSION_TEMPLATES: [
    {
      id: 'sys-vma', title: 'VMA 10×400m', type: 'fractionne',
      defaultDuration: 45, defaultDistance: 8, defaultIntensity: 5,
      description: 'VMA', tags: ['vma'],
    } as SessionTemplate,
    {
      id: 'sys-sl', title: 'SL 20km', type: 'sortie_longue',
      defaultDuration: 120, defaultDistance: 20, defaultIntensity: 2,
      description: 'Sortie longue', tags: [],
    } as SessionTemplate,
  ],
}))
jest.mock('@/lib/plan/use-activity-types', () => ({
  useActivityTypes: () => ({
    visibleTypes: [
      { slug: 'fractionne', label: 'Fractionné' },
      { slug: 'sortie_longue', label: 'Sortie longue' },
    ],
    types: [
      { id: 't1', slug: 'fractionne', label: 'Fractionné', defaultIntensity: 5, category: 'run', isSystem: true },
      { id: 't2', slug: 'sortie_longue', label: 'Sortie longue', defaultIntensity: 2, category: 'run', isSystem: true },
    ],
  }),
}))

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLocale="fr">{ui}</I18nProvider>
}

describe('<SessionAddSheet>', () => {
  const baseProps = {
    open: true,
    dateISO: '2026-05-13',
    onClose: jest.fn(),
    onPickTemplate: jest.fn(),
    onCreateBlank: jest.fn(),
  }
  beforeEach(() => { jest.clearAllMocks() })

  it('renders header, CTA create, search, pills and template grid', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    expect(screen.getByText('Ajouter une séance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Créer une nouvelle séance/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Rechercher une séance…')).toBeInTheDocument()
    expect(await screen.findByText('VMA 10×400m')).toBeInTheDocument()
    expect(screen.getByText('SL 20km')).toBeInTheDocument()
  })

  it('CTA Créer appelle onCreateBlank', () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    fireEvent.click(screen.getByRole('button', { name: /Créer une nouvelle séance/i }))
    expect(baseProps.onCreateBlank).toHaveBeenCalled()
  })

  it('clic sur un template appelle onPickTemplate avec ce template', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    const card = await screen.findByLabelText(/Choisir le template VMA 10×400m/i)
    fireEvent.click(card)
    expect(baseProps.onPickTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'sys-vma' }))
  })

  it('touche Échap ferme', () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('clic sur le scrim ferme', () => {
    const { container } = render(wrap(<SessionAddSheet {...baseProps} />))
    const scrim = container.querySelector('[role="dialog"]') as HTMLElement
    fireEvent.click(scrim)
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('search filtre les templates par titre', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    await screen.findByText('VMA 10×400m')
    fireEvent.change(screen.getByPlaceholderText('Rechercher une séance…'), { target: { value: 'sl' } })
    expect(screen.queryByText('VMA 10×400m')).toBeNull()
    expect(screen.getByText('SL 20km')).toBeInTheDocument()
  })

  it('aucun résultat → affiche un empty state avec bouton reset', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    await screen.findByText('VMA 10×400m')
    fireEvent.change(screen.getByPlaceholderText('Rechercher une séance…'), { target: { value: 'xyz123' } })
    expect(screen.getByText('Aucune séance ne correspond')).toBeInTheDocument()
    const reset = screen.getByRole('button', { name: /Réinitialiser les filtres/i })
    fireEvent.click(reset)
    expect(await screen.findByText('VMA 10×400m')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2 : Lancer les tests, vérifier qu'ils échouent**

Run : `npx jest __tests__/components/plan/SessionAddSheet.test.tsx`
Expected: tests FAIL avec `Cannot find module '@/components/plan/SessionAddSheet'`.

- [ ] **Step 6.3 : Créer `web/components/plan/SessionAddSheet.tsx`**

```tsx
'use client'

// Bottom-sheet picker : ouvert depuis le « + » d'une journée (vues semaine et mois).
// Deux chemins : CTA orange « Créer » (éditeur vierge) ou tap sur un template
// (éditeur pré-rempli). Réutilise library/{FilterBar,TemplateCard} pour la grille.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SessionTemplate } from '@/types/plan'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { getCustomTemplates, getHiddenSystemTemplateIds } from '@/lib/plan/storage'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { FilterBar } from '@/components/plan/library/FilterBar'
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  open: boolean
  dateISO: string
  onClose: () => void
  onPickTemplate: (template: SessionTemplate) => void
  onCreateBlank: () => void
}

function formatLong(iso: string, months: readonly string[]): string {
  if (!iso || iso.length < 10) return iso
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

export function SessionAddSheet({ open, dateISO, onClose, onPickTemplate, onCreateBlank }: Props) {
  const L = useT().plan
  const { visibleTypes, types } = useActivityTypes()

  const [custom, setCustom] = useState<SessionTemplate[]>([])
  const [hiddenSystemIds, setHiddenSystemIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | 'all'>('all')

  // Reset des filtres à chaque réouverture (pas d'effet de bord entre clics sur deux jours).
  useEffect(() => {
    if (open) { setSearch(''); setSelectedType('all') }
  }, [open])

  // Fetch templates custom + hidden ids quand on s'ouvre.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const c = await getCustomTemplates()
      if (cancelled) return
      setCustom(c)
      setHiddenSystemIds(getHiddenSystemTemplateIds())
    })()
    return () => { cancelled = true }
  }, [open])

  // Échap ferme.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const customIds = useMemo(() => new Set(custom.map(t => t.id)), [custom])
  const hiddenSet = useMemo(() => new Set(hiddenSystemIds), [hiddenSystemIds])

  const allTemplates = useMemo<SessionTemplate[]>(() => {
    const visibleSystem = SESSION_TEMPLATES.filter(t => !hiddenSet.has(t.id))
    return [...custom, ...visibleSystem]
  }, [custom, hiddenSet])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTemplates.filter(t => {
      if (selectedType !== 'all' && t.type !== selectedType) return false
      if (q.length > 0) {
        const inTitle = t.title.toLowerCase().includes(q)
        const inTags = (t.tags ?? []).some(tag => tag.toLowerCase().includes(q))
        if (!inTitle && !inTags) return false
      }
      return true
    })
  }, [allTemplates, search, selectedType])

  const isLibraryEmpty = allTemplates.length === 0

  const resetFilters = useCallback(() => {
    setSearch('')
    setSelectedType('all')
  }, [])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={L.addTitle}
    >
      <div
        className="bg-trail-surface border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Grabber (mobile) */}
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mt-2 mb-1 md:hidden" />

        {/* Header */}
        <div className="px-4 pt-2 pb-3 flex items-start justify-between border-b border-trail-border">
          <div>
            <h2 className="text-[16px] font-semibold text-trail-text">{L.addTitle}</h2>
            <p className="text-[12px] text-trail-muted mt-[2px]">{formatLong(dateISO, L.monthsFull)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={L.addCloseAria}
            className="w-7 h-7 rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-text text-[14px] leading-none"
          >✕</button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <button
            type="button"
            onClick={onCreateBlank}
            className="w-full py-3 rounded-[12px] bg-trail-primary text-white text-[14px] font-bold flex items-center justify-center gap-2 hover:opacity-90"
          >
            <span className="text-[18px] leading-none">+</span>
            {L.addCreateBtn}
          </button>

          <div className="flex items-center gap-2 my-4 text-trail-muted text-[11px] font-semibold uppercase tracking-wider">
            <div className="flex-1 h-px bg-trail-border" />
            <span>{L.addOrLibrary}</span>
            <div className="flex-1 h-px bg-trail-border" />
          </div>

          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={L.addSearchPh}
            className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary mb-2"
            aria-label={L.libSearchAria}
          />

          <FilterBar
            variant="compact"
            visibleTypes={visibleTypes}
            types={types}
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />

          {isLibraryEmpty ? (
            <div className="mt-6 text-center text-trail-muted text-[13px]">
              {L.addEmpty}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 text-center">
              <p className="text-trail-muted text-[13px] mb-2">{L.addNoMatch}</p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
              >
                {L.addReset}
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  types={types}
                  isCustom={customIds.has(t.id)}
                  mode="pick"
                  onClick={() => onPickTemplate(t)}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 6.4 : Lancer les tests, vérifier qu'ils passent**

Run : `npx jest __tests__/components/plan/SessionAddSheet.test.tsx`
Expected: 7 tests PASS.

- [ ] **Step 6.5 : Type-check**

Run : `npx tsc --noEmit -p .`
Expected: aucune erreur.

- [ ] **Step 6.6 : Commit**

```bash
git add web/components/plan/SessionAddSheet.tsx web/__tests__/components/plan/SessionAddSheet.test.tsx
git commit -m "feat(plan): add SessionAddSheet picker (create | pick from library)"
```

---

## Task 7 : Câbler `SessionAddSheet` dans `VueSemaineBlock`

**Files:**
- Modify: `web/components/plan/VueSemaineBlock.tsx`

- [ ] **Step 7.1 : Ajouter l'import et l'état du sheet**

Dans `web/components/plan/VueSemaineBlock.tsx` :

Ajoute en haut, près des autres imports :
```ts
import { SessionAddSheet } from './SessionAddSheet'
```

Dans le corps du composant `VueSemaineBlock`, juste après les états `editorOpen / editingSession / editorInitialDate` (vers ligne 108-110), ajoute :

```ts
// Picker d'ajout : ouvert d'abord, redirige soit vers création vierge, soit
// vers éditeur pré-rempli depuis un template.
const [addSheetOpen, setAddSheetOpen] = useState(false)
const [addSheetDate, setAddSheetDate] = useState<string>('')
const [prefillTemplate, setPrefillTemplate] = useState<SessionTemplate | null>(null)
```

Ajoute aussi `SessionTemplate` à l'import existant `from '@/types/plan'` (s'il n'y est pas déjà) :
```ts
import type { PlannedSession, SessionTemplate, TrainingPlan } from '@/types/plan'
```

- [ ] **Step 7.2 : Modifier `openCreate` pour ouvrir le sheet**

Remplace la fonction `openCreate` actuelle (lignes ~249-253) par :

```ts
function openCreate(dateISO: string) {
  setAddSheetDate(dateISO)
  setAddSheetOpen(true)
}
```

- [ ] **Step 7.3 : Ajouter les handlers du sheet**

Juste après `openCreate`, ajoute :

```ts
function handlePickTemplate(t: SessionTemplate) {
  setAddSheetOpen(false)
  setEditingSession(null)
  setEditorInitialDate(addSheetDate)
  setPrefillTemplate(t)
  setEditorOpen(true)
}

function handleCreateBlank() {
  setAddSheetOpen(false)
  setEditingSession(null)
  setEditorInitialDate(addSheetDate)
  setPrefillTemplate(null)
  setEditorOpen(true)
}
```

- [ ] **Step 7.4 : Rendre le sheet dans le JSX et passer `prefillTemplate` à l'éditeur**

Repère la balise `<SessionEditorModal …>` à la fin du composant (vers ligne 388). Ajoute la prop `prefillTemplate={prefillTemplate}` à son appel.

Juste après cette balise, ajoute :

```tsx
<SessionAddSheet
  open={addSheetOpen}
  dateISO={addSheetDate}
  onClose={() => setAddSheetOpen(false)}
  onPickTemplate={handlePickTemplate}
  onCreateBlank={handleCreateBlank}
/>
```

Et dans le handler `onClose` de `SessionEditorModal`, ajoute le reset du prefill :
```tsx
onClose={() => { setEditorOpen(false); setPrefillTemplate(null) }}
```

- [ ] **Step 7.5 : Type-check + tests**

Run : `npx tsc --noEmit -p . && npx jest __tests__/components/plan/`
Expected: aucune erreur, tous les tests passent.

- [ ] **Step 7.6 : Commit**

```bash
git add web/components/plan/VueSemaineBlock.tsx
git commit -m "feat(plan): VueSemaineBlock ouvre SessionAddSheet sur tap +"
```

---

## Task 8 : Câbler `SessionAddSheet` dans `DayDetailPanel`

**Files:**
- Modify: `web/components/plan/DayDetailPanel.tsx`

Mêmes modifications, plus simples (un seul `+`).

- [ ] **Step 8.1 : Ajouter l'import, l'état et les handlers**

Dans `web/components/plan/DayDetailPanel.tsx`, après les états existants (vers ligne 34) :

```ts
import { SessionAddSheet } from './SessionAddSheet'
import type { SessionTemplate } from '@/types/plan'
// …
const [addSheetOpen, setAddSheetOpen] = useState(false)
const [prefillTemplate, setPrefillTemplate] = useState<SessionTemplate | null>(null)
```

- [ ] **Step 8.2 : Modifier `openCreate` et ajouter les handlers**

Remplace `openCreate` (lignes 58-61) par :

```ts
function openCreate() {
  setAddSheetOpen(true)
}

function handlePickTemplate(t: SessionTemplate) {
  setAddSheetOpen(false)
  setEditingSession(null)
  setPrefillTemplate(t)
  setEditorOpen(true)
}

function handleCreateBlank() {
  setAddSheetOpen(false)
  setEditingSession(null)
  setPrefillTemplate(null)
  setEditorOpen(true)
}
```

- [ ] **Step 8.3 : Rendre le sheet et passer `prefillTemplate` à l'éditeur**

Repère la balise `<SessionEditorModal …>` (ligne ~131). Ajoute :
```tsx
prefillTemplate={prefillTemplate}
onClose={() => { setEditorOpen(false); setPrefillTemplate(null) }}
```

Juste après, ajoute :
```tsx
<SessionAddSheet
  open={addSheetOpen}
  dateISO={dateISO}
  onClose={() => setAddSheetOpen(false)}
  onPickTemplate={handlePickTemplate}
  onCreateBlank={handleCreateBlank}
/>
```

- [ ] **Step 8.4 : Type-check + tests**

Run : `npx tsc --noEmit -p . && npx jest __tests__/components/plan/`
Expected: aucune erreur, tests verts.

- [ ] **Step 8.5 : Commit**

```bash
git add web/components/plan/DayDetailPanel.tsx
git commit -m "feat(plan): DayDetailPanel ouvre SessionAddSheet sur tap +"
```

---

## Task 9 : QA manuelle + commit final

**Files:** aucun

- [ ] **Step 9.1 : Lancer la suite complète**

Run depuis `web/` :
```bash
npm test -- --ci
npx tsc --noEmit -p .
npm run lint
```
Tous doivent passer.

- [ ] **Step 9.2 : Smoke test fonctionnel en dev**

Run :
```bash
npm run dev
```

Scénarios à valider à la main sur `http://localhost:3000/plan` :

1. **Vue semaine, tap `+` sur un jour vide** → le bottom-sheet s'ouvre avec la bonne date en header.
2. **CTA orange « Créer une nouvelle séance »** → le sheet se ferme et l'éditeur s'ouvre vierge avec la bonne date pré-remplie, **pas de bandeau orange**.
3. **Tap sur un template (ex. « VMA 10×400m »)** → l'éditeur s'ouvre avec titre, type, durée, distance, intensité du template + **bandeau orange « ✨ Pré-rempli depuis VMA 10×400m »**.
4. **Recherche `"vma"`** dans le sheet → seuls les templates qui matchent restent.
5. **Pill filtre « Fractionné »** → seuls les fractionnés restent ; la pill prend la couleur rouge du type.
6. **Search + filtre qui ne matche rien** → empty state « Aucune séance ne correspond » + bouton reset (le bouton ramène les pills/search à zéro).
7. **Vue mois, clic sur un jour → DayDetailPanel s'ouvre → tap `+`** → même picker.
8. **Échap / clic scrim / bouton ✕** → ferme le sheet.
9. **DnD bibliothèque → jour** (régression) : encore fonctionnel, dépose une séance sans passer par le picker.

- [ ] **Step 9.3 : Ajouter le bandeau « Status: Implémenté » au spec**

Édite `docs/superpowers/specs/2026-05-26-plan-add-session-picker-design.md` ligne 3 :

```markdown
> **Status: Implémenté** · 2026-05-26 · Code: web/components/plan/SessionAddSheet.tsx, web/components/plan/library/
```

(Date à mettre à la date réelle de la PR.)

- [ ] **Step 9.4 : Commit final**

```bash
git add docs/superpowers/specs/2026-05-26-plan-add-session-picker-design.md
git commit -m "docs(plan): mark add-session-picker spec as Implémenté"
```

---

## Résumé

| Task | Sortie | Couvre dans le spec |
|---|---|---|
| 1 | `library/TemplateCard.tsx` + tests | « Architecture & réutilisation → Composants factorisés » |
| 2 | `library/FilterBar.tsx` + tests | idem |
| 3 | Refactor BibliothequeSeancesBlock | idem (no-regression) |
| 4 | i18n `plan.add*` (fr + en) | « i18n » |
| 5 | `SessionEditorModal.prefillTemplate` + tests | « Comportement de sélection » + « Composant modifié » |
| 6 | `SessionAddSheet.tsx` + tests | « UX retenue » + « Edge cases » + « Tests » |
| 7 | Wire `VueSemaineBlock` | « Triggers à câbler » |
| 8 | Wire `DayDetailPanel` | idem |
| 9 | QA + status spec | clôture |
