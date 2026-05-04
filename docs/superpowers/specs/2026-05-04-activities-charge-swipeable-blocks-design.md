# Blocs Activités & Charge — Swipeable multi-sport

**Date :** 2026-05-04  
**Scope :** Web app cockpit (`web/`)  
**Fonctionnalités :** carousel multi-sport pour les blocs Activités et Charge + fix font KPI tiles

---

## Contexte

Le bloc Activités du cockpit web est actuellement statique (Running uniquement, hardcodé). Le bloc Charge d'entraînement est également statique (ATL/CTL/TSB global). L'objectif est de transformer ces deux blocs en carousels swipeables avec sélection de sport configurable, alignés sur le comportement Android.

---

## 1. Couche données

### Sport mapping

| SportKey | sport_type Strava          |
|----------|---------------------------|
| `run`    | `Run`, `TrailRun`         |
| `ride`   | `Ride`, `VirtualRide`     |
| `swim`   | `Swim`                    |
| `all`    | toutes                    |

### Nouveau type `SportOverview`

```typescript
// SportKey est défini dans lib/design/sports.ts et importé ici
import type { SportKey } from '@/lib/design/sports'

type SportOverview = {
  // KPIs semaine
  weekKm: number
  weekDPlus: number
  weekSessions: number
  dailyKm: number[]       // 7 valeurs Lun[0]..Dim[6]
  dailyDPlus: number[]    // 7 valeurs

  // KPIs année
  ytdKm: number
  ytdDPlus: number
  monthlyKm: number[]     // 12 valeurs Jan[0]..Déc[11]

  // Charge (EWMA sport-spécifique)
  atl: number
  ctl: number
  tsb: number
  weekCes: number         // Suffer = somme CES semaine courante
  last7Tsb: number[]      // 7 valeurs pour BarStrip TSB
}
```

### Modifications `DashboardData`

Champs **supprimés** : `weekOverview`, `monthlyRunKm`, `ytd`, `weekSuffer`, `dailyMetrics`

Champ **ajouté** : `sportOverviews: Record<SportKey, SportOverview>`

Les autres champs (`recentActivities`, `hasActivities`, `weekSessions`, `intensityBreakdown`, `weeklyPoints`, `cumulMonths`) restent inchangés.

### Modifications `getDashboardData`

Pour chaque `SportKey`, filtrer `activities` par les sport_types correspondants puis :
1. Calculer `weekKm`, `weekDPlus`, `weekSessions`, `dailyKm`, `dailyDPlus` sur la semaine courante
2. Calculer `ytdKm`, `ytdDPlus`, `monthlyKm` sur l'année
3. Appeler `buildWindowedLoads` + `buildDailyMetrics` sur les activités filtrées → extraire `atl`, `ctl`, `tsb`, `last7Tsb`
4. Calculer `weekCes` = somme des CES de la semaine filtrée

`buildDailyMetrics` est appelé 4 fois (une par sport). Les données sont légères (~100 lignes de métriques) donc aucun problème de perf.

---

## 2. Constante partagée

**Fichier :** `web/lib/design/sports.ts`

```typescript
export type SportKey = 'run' | 'ride' | 'swim' | 'all'

export const SPORT_CONFIG: Record<SportKey, {
  label: string
  shortLabel: string
  emoji: string
  color: string        // hex depuis colors.ts
}> = {
  run:  { label: 'Course',   shortLabel: 'RUN', emoji: '🏃', color: colors.chargeOrange },
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.seriesBlue   },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.seriesGreen  },
  all:  { label: 'Toutes',   shortLabel: 'ALL', emoji: '⚡', color: colors.seriesYellow },
}

export const ALL_SPORT_KEYS: SportKey[] = ['run', 'ride', 'swim', 'all']
```

---

## 3. Architecture des composants

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `web/lib/design/sports.ts` | Constante `SPORT_CONFIG` + `SportKey` |
| `web/components/cockpit/ActivitiesBlock.tsx` | Bloc Activités swipeable |
| `web/components/cockpit/ChargeBlock.tsx` | Bloc Charge swipeable |
| `web/components/cockpit/SportSettingsModal.tsx` | Modal ⋮ partagée |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `web/lib/data/dashboard.ts` | Nouveaux types + `sportOverviews` |
| `web/app/dashboard/page.tsx` | Utilise `ActivitiesBlock` et `ChargeBlock` |
| `web/components/ui/CockpitKpiTile.tsx` | Fix padding + leading |
| `web/components/ui/BarStrip.tsx` | fontSize 10 → 11 |

### `ActivitiesBlock` (Client Component)

```
Props: sportOverviews: Record<SportKey, SportOverview>

localStorage key: 'cockpit_activities_settings'
  { visible: SportKey[], default: SportKey }
  Défaut: { visible: ['run','ride','swim','all'], default: 'run' }

Rendu:
  SectionCard
    ├── Header: "Activités — {sport.label} {sport.emoji}"  TsbBadge  [⋮]
    ├── Carousel (scroll-snap)
    │     ├── slide run:  4 tuiles KPI (SEMAINE / D+SEM / ANNÉE / CHARGE(RUN))
    │     ├── slide ride: 4 tuiles KPI (SEMAINE / D+SEM / ANNÉE / CHARGE(VÉL))
    │     └── ...
    └── Dots navigation
```

Le titre du bloc (label + emoji) se met à jour en fonction du slide actif.

Le `TsbBadge` affiche toujours `sportOverviews.all.tsb` (état de forme global, indépendant du sport actif).

La tuile CHARGE affiche :
- Titre : `"CHARGE ({sport.shortLabel})"`
- Valeur : `ATL {atl} · CTL {ctl}` (couleurs sport-spécifiques)
- Subline : `TSB {tsb} • 7 derniers jours`
- BarStrip : `last7Tsb` normalisé

### `ChargeBlock` (Client Component)

```
Props: sportOverviews: Record<SportKey, SportOverview>

localStorage key: 'cockpit_charge_settings'
  { visible: SportKey[], default: SportKey }
  Défaut: { visible: ['all','run','ride','swim'], default: 'all' }

Rendu:
  SectionCard
    ├── Header: "Charge d'entraînement — {sport.label}"  [⋮]
    ├── Carousel (scroll-snap)
    │     ├── slide all:  4 CompactMetricCard (ATL/CTL/TSB/Suffer global)
    │     ├── slide run:  4 CompactMetricCard (ATL/CTL/TSB/Suffer running)
    │     └── ...
    └── Dots navigation
```

### `SportSettingsModal` (Client Component)

```
Props:
  title: string                    // "Volume d'activités"
  allKeys: SportKey[]              // ordre d'affichage
  visible: SportKey[]
  defaultKey: SportKey
  onSave: (visible, defaultKey) => void
  onClose: () => void

Layout:
  Overlay plein écran (bg semi-transparent)
  Card centrée
    ├── Titre
    ├── "Activités à afficher"
    │     └── checkbox × 4 (label + emoji)
    ├── Note: "Tout décocher masque ce bloc"
    ├── "Activité par défaut" (affiché en premier)
    │     └── radio × 4
    └── Bouton "Fermer"

Règle: le radio "par défaut" est limité aux sports visibles.
Si le sport par défaut est décoché → bascule automatiquement sur le premier sport visible.
```

---

## 4. Carousel — implémentation

CSS scroll snapping sans lib externe :

```css
/* conteneur */
overflow-x: auto;
scroll-snap-type: x mandatory;
scrollbar-width: none;   /* masquer scrollbar */
display: flex;

/* item */
flex-shrink: 0;
width: 100%;
scroll-snap-align: start;
```

Gestion de l'index courant via `onScroll` + `scrollLeft / scrollWidth`.  
Navigation par dots : `scrollTo({ left: index * width, behavior: 'smooth' })`.

---

## 5. Persistance localStorage

Pattern identique à `GoalsBlock` :

```typescript
// Lecture (avec merge des defaults pour robustesse)
const stored = localStorage.getItem(STORAGE_KEY)
const parsed = stored ? JSON.parse(stored) : {}
const settings = { ...DEFAULT_SETTINGS, ...parsed }

// Écriture immédiate sur changement
localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
```

Si `visible` est vide après chargement, le bloc se masque (même comportement Android).

---

## 6. Fix font KPI tiles

### `CockpitKpiTile.tsx`
- Padding : `py-[5px]` → `py-[8px]`
- Valeurs principales : ajouter `leading-none` aux spans de valeur (ex: `text-[21px] font-black leading-none`)
- Tuile CHARGE : `flex-wrap` → `flex-nowrap`, `items-center` → `items-baseline`

### `BarStrip.tsx`
- `fontSize` : 10 → 11 dans les éléments `<text>`

---

## 7. Intégration dans `page.tsx`

```tsx
// Imports
import { ActivitiesBlock } from '@/components/cockpit/ActivitiesBlock'
import { ChargeBlock } from '@/components/cockpit/ChargeBlock'

// Dans le JSX
{/* ── 1. Activités ── */}
<ActivitiesBlock sportOverviews={sportOverviews} />

{/* ── 5. Charge d'entraînement ── */}
<ChargeBlock sportOverviews={sportOverviews} />
```

Le bloc 1 (Activités) et le bloc 5 (Charge) sont remplacés. Les autres blocs (GoalsBlock, charts, HistoryPillsBlock, etc.) restent inchangés.

---

## 8. Critères de validation

- [ ] Swipe gauche/droite fonctionne sur mobile (touch)
- [ ] Clic sur dots navigue vers le bon sport
- [ ] Le ⋮ ouvre la modal, la sélection persiste au rechargement
- [ ] Si tous décochés → bloc masqué
- [ ] Le sport par défaut s'affiche en premier au chargement
- [ ] ATL/CTL/TSB diffèrent bien entre sports (Running ≠ Global)
- [ ] Les tuiles KPI n'ont plus l'aspect "écrasé" (padding + leading corrigés)
- [ ] TypeScript sans erreur, build Next.js OK
