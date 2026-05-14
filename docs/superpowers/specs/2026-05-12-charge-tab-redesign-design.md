> **Status: Implémenté** · Date: 2026-05-12 · Code: `web/lib/analytics/charge-insights.ts`, `web/components/charge/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Redesign onglet Charge — Design Spec

**Date** : 2026-05-12
**Status** : Validé (brainstorming)
**Auteur** : Claude + Franck
**Périmètre** : `web/` (Next.js PWA), aucun changement Android

---

## Objectif

Refondre entièrement l'onglet Charge du web app Trail Cockpit pour qu'un utilisateur comprenne en 10 secondes :

1. Est-ce que je suis frais ou fatigué ?
2. Est-ce que ma charge récente est cohérente avec mon habitude ?
3. Quel sport m'a le plus chargé ?
4. Est-ce que ma semaine est équilibrée ?
5. Est-ce que je progresse trop vite, normalement, ou pas assez ?

Conserver la rigueur scientifique (EWMA ATL/CTL/TSB existante) mais présenter avec un vocabulaire accessible :
- ATL → "Fatigue récente"
- CTL → "Base de forme"
- TSB → "Fraîcheur"

Réutiliser au maximum la logique de blocs draggables/masquables du Cockpit.

---

## Décisions clés (validées en brainstorming)

| Décision | Choix |
|---|---|
| Périodes EWMA | Garder 7j/42j (Banister classique, code actuel). Re-labeler en "Fatigue récente" / "Base de forme". |
| Filtre sport global | 4 entrées : Tout / Course (Run+TrailRun) / Vélo / Natation. Réutilise `SPORT_TYPE_MAP` existant. |
| Persistance filtre sport | localStorage `charge_sport_filter`, persistant entre sessions. |
| ChargeBlock Cockpit | Relabeler les strings (ATL→"Fatigue récente"...) pour cohérence. Structure inchangée. |
| Stratégie data | Nouveau loader serveur `web/lib/data/charge.ts`. Page Charge reste server-rendered, switch sport instantané (datasets pré-calculés). |
| Drag & drop | Extraire `BlockGrid` générique partagé entre Cockpit et Charge. Persistance localStorage par onglet (clés séparées). |

---

## Architecture data & analytics

### Module analytics dédié

**Fichier** : `web/lib/analytics/charge-insights.ts`

Fonctions pures, testables, indépendantes de Supabase :

```ts
getDailyLoadSeries(activities, days = 90): { date, ces }[]
getWeeklyLoadByCategory(activities, weeks = 10): WeeklyLoadByCategory[]
computeAcuteLoad7d(metrics): number          // ATL latest
computeChronicLoad(metrics): number          // CTL latest
computeFreshness(metrics): { tsb, deltaVsWeekAgo, zone }
computeLoadBalanceRatio(activities): { ewmaRatio, sumRatio7vs28 }
computeMonotony7d(dailyLoads): number        // mean / std (jours actifs)
computeStrain7d(dailyLoads): number          // sum7d × monotony
computeSportDistribution(activities, windowDays): { run, ride, swim, other, total }
computeIntensityDistribution(activities, windowDays, profile, zones): IntensityShareCes[]
computeTopLoadActivities(activities, days, n = 5): TopActivity[]
computeRampRate(weeklyLoad): { deltaWeekPct, label }
computeLoadInsights(payload): { status, headline, notes[] }
```

**Fichier** : `web/lib/analytics/charge-thresholds.ts`

Seuils centralisés (modifiables sans toucher au code) :

```ts
export const LOAD_BALANCE = { low: 0.75, balanced: 1.25, high: 1.5 }
export const FRESHNESS    = { veryFresh: 15, fresh: 5, normalFatigue: -10, highFatigue: -25 }
export const MONOTONY     = { variedMax: 1.5, repetitiveMin: 2.0 }
export const STRAIN       = { high: 6000 }   // à recalibrer
export const RAMP_RATE    = { fastRise: 0.30, controlledRise: 0.10, decline: -0.30 }
```

### Loader serveur

**Fichier** : `web/lib/data/charge.ts`

```ts
export async function getChargePageData(userId: string): Promise<ChargePageData>
```

- 1 requête Supabase : activités 90 derniers jours (champs : `id, sport_type, name, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_intensity, workout_type`).
- 1 requête profil (HR zones + seuils CES).
- Pré-calcule les 4 datasets (`all|run|ride|swim`).

**Type retourné** :

```ts
type ChargePageData = {
  activitiesRaw: ActivityRow[]      // 90j
  hrZones: HrZone[]
  perSport: Record<SportKey, ChargeSportPayload>
  generatedAt: string
}

type ChargeSportPayload = {
  dailyMetrics: DailyMetrics[]                   // ATL/CTL/TSB sur ~90j
  dailyLoads: DailyLoad[]
  weeklyLoadByCategory: WeeklyLoadByCategory[]   // 10 semaines
  sportDistribution: { 7: …, 28: …, 70: … }
  intensityDistribution: { 7: …, 28: …, 70: … }
  top: TopActivity[]                              // 5 max
  monotony7d: number
  strain7d: number
  activeDays7d: number
  peakDay7d: { date: string; ces: number }
  rampRate: { deltaWeekPct: number; label: string }
  insights: { status: StatusId; headline: string; notes: string[] }
  noCesActivities7d: number
  noCesActivities28d: number
  historyDays: number
}
```

---

## Page Charge & filtre sport global

### Shell server

**Fichier** : `web/app/(main)/charge/page.tsx`

```tsx
export default async function ChargePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const data = await getChargePageData(user.id)
  return <ChargePageClient data={data} />
}
```

### ChargePageClient

**Fichier** : `web/app/(main)/charge/ChargePageClient.tsx`

État local :
- `sport: SportKey` ← localStorage `charge_sport_filter` (default `all`)
- `order: BlockId[]` ← localStorage `charge_block_order`
- `hidden: BlockId[]` ← localStorage `charge_hidden_blocks`

Composition :
- Header sticky `<SportSegmentedTabs sport={sport} onChange={setSport} />`
- `<BlockGrid ... storageKey="charge" />` avec les blocs visibles

Aucun re-calcul client : `data.perSport[sport]` est lu directement, le switch est instantané.

### Composant générique partagé

**Fichier** : `web/components/blocks/BlockGrid.tsx`

Extrait de l'actuel `DashboardGrid.tsx`. API :

```ts
type Props = {
  storageKey: 'cockpit' | 'charge'
  blocks: Array<{ id: string; label: string; emoji: string; render: () => ReactNode }>
  defaultOrder: string[]
}
```

Refactor : `DashboardGrid` migre sur `BlockGrid` (comportement identique, juste extraction).

---

## Les 12 blocs

Ordre par défaut (du plus pédagogique au plus détaillé) :

| # | ID | Composant | Source | Visuel |
|---|---|---|---|---|
| 1 | `status` | `LoadStatusCard` | `insights.status`, ATL/CTL/TSB | Grande carte : icône + statut + phrase + mini-KPI (Fatigue récente / Base de forme / Fraîcheur). Tooltip ATL/CTL/TSB. |
| 2 | `acute-chronic` | `AcuteChronicCard` | `acuteLoad7d`, `chronicLoad`, `loadBalanceRatio` | 2 grands chiffres + barre comparative + % + phrase pédagogique. |
| 3 | `freshness` | `FreshnessCard` | `freshness` | Jauge horizontale 4 zones + flèche tendance vs J-7 + phrase. |
| 4 | `weekly-load` | `WeeklyLoadChart` | `weeklyLoadByCategory` | Bar chart empilé Course/Vélo/Natation/Autres + ligne moyenne 4 sem. |
| 5 | `fitness-fatigue` | `FitnessFatigueChart` | `dailyMetrics` (70j) | 2 lignes (Fatigue récente / Base de forme), zone Fraîcheur en arrière-plan. |
| 6 | `sport-distribution` | `SportDistributionChart` | `sportDistribution` | Donut + mini-tabs internes 7j/28j/10sem. |
| 7 | `intensity-distribution` | `IntensityDistributionChart` | `intensityDistribution` | Barres horizontales (Récup/Footing/Endurance active/Seuil/VMA/Non déterminée) + mini-tabs + texte. |
| 8 | `monotony-strain` | `MonotonyStrainCard` | `monotony7d`, `strain7d`, `activeDays7d`, `peakDay7d` | 4 mini-KPIs + tooltip "Variété / Contrainte / Jours actifs / Plus grosse journée". |
| 9 | `top-activities` | `TopLoadActivitiesCard` | `top` | Liste 3-5 activités : date, sport, nom, CES, durée, intensité, % charge 7j. |
| 10 | `heatmap-28d` | `LoadHeatmap28d` | `dailyLoads.slice(-28)` | Grille 4×7, opacité = CES/maxCES, tooltip charge + sports du jour. |
| 11 | `ramp-rate` | `RampRateCard` | `rampRate` | Variations week vs week + libellé déterministe. |
| 12 | `insights` | `LoadInsightsCard` | `insights.notes` | Carte "Lecture rapide" : 2-5 bullets. |

Chaque bloc reçoit `{ payload: ChargeSportPayload, sportLabel: string, onHide: () => void }`.

---

## Moteur d'insights déterministe

### Statut global (priorité décroissante, premier match)

| Condition | Status ID | Phrase |
|---|---|---|
| `historyDays < 14` | `insufficient` | "Pas assez de données pour estimer ta forme. Reviens après quelques séances." |
| `tsb <= -25` | `overloaded` | "Charge élevée à surveiller. Récupération conseillée." |
| `ewmaRatio > 1.5` | `peak` | "Pic de charge cette semaine. Reste attentif à la récupération." |
| `tsb <= -10` | `loaded` | "Fatigue normale d'entraînement. C'est cohérent en phase de charge." |
| `tsb >= 15 && chronicLoad < 30` | `under-trained` | "Tu es très frais mais ta base de forme est basse. Tu peux remonter le volume." |
| `tsb >= 15` | `very-fresh` | "Tu es bien reposé. Bonne fenêtre pour une séance intense." |
| `ewmaRatio < 0.75` | `light` | "Charge récente plus faible que d'habitude. Utile si tu récupères." |
| `ewmaRatio in [1.25, 1.5]` | `progressing` | "Progression élevée. Tu charges plus que ta moyenne." |
| sinon | `balanced` | "Charge équilibrée. Tu peux suivre ton plan normalement." |

### Notes pédagogiques (cumulatives)

| Condition | Note |
|---|---|
| run/total > 0.7 (7j) | "Tu as beaucoup chargé en course à pied." |
| ride/total > 0.5 (7j) ∧ ride/total < 0.3 (28j) | "La charge vélo compense une baisse de charge running." |
| activeDays7d ≤ 2 ∧ sum7d > 0 | "Beaucoup de charge concentrée sur peu de jours." |
| monotony7d ≥ 2.0 | "Semaine peu variée. Pense à alterner intensités et durées." |
| strain7d > STRAIN.high | "Semaine très exigeante, prends le temps de récupérer." |
| (vma+seuil)/total > 0.4 (7j) | "Beaucoup d'intensité haute cette semaine." |
| sports utilisés ≥ 2 et aucun > 0.4 ratio | "Bonne variété entre sports." |
| noCesActivities28d > 0 | "{N} activité(s) récente(s) n'ont pas de charge exploitable." |
| chronicLoad < 20 ∧ historyDays ≥ 14 | "Ta base de forme est encore basse, progresse graduellement." |

### Ramp-rate (Bloc 11)

| ΔweekVsPrev | Libellé |
|---|---|
| > +30% | "Hausse rapide" |
| +10% à +30% | "Progression maîtrisée" |
| −10% à +10% | "Charge stable" |
| < −30% | "Baisse de charge" |
| −30% à −10% (et semaine précédente ≈ 0) | "Reprise progressive" |
| −30% à −10% (sinon) | "Charge en baisse" |

### Garde-fous

- Aucun terme médical ("risque de blessure", "blessure imminente", etc.).
- Vocabulaire orienté coaching/observation : "à surveiller", "récupération conseillée", "pic de charge", "progression rapide".
- Toutes les phrases dans `web/lib/design/labels.ts` (section `charge`) → traduisibles.

---

## UI mobile-first

### Layout

```
┌──────────────────────────────────────┐
│ Header sticky (top-0 z-20)            │
│  [ Tout | Course | Vélo | Natation ]  │  SportSegmentedTabs
└──────────────────────────────────────┘
   ↓ vertical, gap 2-3
[Bloc 1 : LoadStatusCard]
[Bloc 2 : AcuteChronicCard]
...
[ + Ajouter un bloc ]   (si hidden.length > 0)
```

### Composants partagés à créer

Dossier `web/components/charge/` :
- `SportSegmentedTabs.tsx` — pill-tabs sticky avec couleur active par sport.
- `MiniKpi.tsx` — chiffre + label + couleur.
- `Gauge.tsx` — jauge horizontale 4 zones (Fraîcheur, ramp-rate).
- `StackedBarChart.tsx` — wrapper Recharts pour weekly-load empilé.
- `DonutChart.tsx` — wrapper Recharts pour sport-distribution (étend `CockpitPieChart`).
- `HorizontalBars.tsx` — barres horizontales intensité.
- `Heatmap28d.tsx` — grille 4×7, opacité = CES/maxCES.
- `InsightNote.tsx` — bullet `• texte`.
- `BlockHelpSheet.tsx` — bottom-sheet d'aide ouverte au tap sur l'icône `ⓘ`.

### Style cohérent Cockpit

- `rounded-[12px] bg-trail-card border border-trail-border p-[10px]`
- Drag handle 6 dots gris en haut centre, identique à `DashboardGrid`.
- Titre `text-[13px] font-semibold text-trail-text`.
- À droite du titre : `ⓘ` puis `⋮` (Masquer).
- Sous-titres : `text-[11px] text-trail-muted leading-[16px]`.

### Couleurs (réutilise `web/lib/design/colors.ts`)

- Course/Trail : `chargeOrange`
- Vélo : `seriesGreen`
- Natation : `seriesBlue`
- Autres : `subtleText`
- Statut fraîcheur 4 paliers : bleu / vert / jaune / rouge.
- Aucune info portée uniquement par la couleur : label texte toujours présent.

### Interactions

- Drag : long-press 500ms (mobile), 8px (desktop) — sensors `dnd-kit` identiques.
- Menu `⋮` : "Masquer".
- Icône `ⓘ` : ouvre bottom-sheet d'aide (contenu dans `labels.ts` clé `charge.help.<blocId>`).
- Mini-tabs internes 7j/28j/10sem sur blocs `sport-distribution` et `intensity-distribution` (états locaux, non persistés).

### Accessibilité

- Chaque chart wrappé dans `CockpitChartCard` avec titre H3 explicite.
- `aria-label` sur drag handle, tabs, boutons de filtre.
- Contraste WCAG AA sur badges statut.

### Loading & error

- `loading.tsx` skeleton (3 cards grises pulsantes).
- Erreur loader → carte "Impossible de charger ta charge. Réessaie."

### Empty state

- Si `perSport[sport].historyDays === 0` → "Pas encore assez de données <sport> pour calculer la charge."

---

## Tests

### Unitaires (Jest, déjà configuré)

**Fichier** : `web/__tests__/analytics/charge-insights.test.ts`
- 9 branches de statut.
- Chaque règle de note (9 cas).
- Ramp-rate (5 branches).
- Snapshots des phrases.

**Fichier** : `web/__tests__/analytics/charge-analytics.test.ts`
- `getDailyLoadSeries`, `getWeeklyLoadByCategory`, `computeMonotony7d`, `computeStrain7d`, `computeSportDistribution`, `computeIntensityDistribution`, `computeTopLoadActivities`, `computeLoadBalanceRatio`.
- Cas spéciaux : array vide, < 14 jours, < 42 jours, jours avec CES=0, activité sans CES, filtre sport sans data.

### Non-régression

- Pas de test pour `getChargePageData` (intégration Supabase) — vérif manuelle.
- `BlockGrid` partagé : test léger ordre/hide localStorage.
- `ChargeBlock` Cockpit : seuls strings changent → snapshot visuel manuel.

### Vérifications finales

- `pnpm test` ✓
- `pnpm build` ✓
- `pnpm lint` ✓
- Test manuel dev server : navigation tabs sport, drag, masquage/restauration, bottom-sheet d'aide.

---

## Migration & déploiement

### Supabase

Aucune migration. Tous les champs requis existent (`ces`, `sport_type`, `manual_intensity`, `avg_hr`, `distance_m`, `elevation_gain_m`, `moving_time_sec`).

### Découpage en commits

1. `feat(analytics): add charge-insights module + thresholds + tests`
2. `feat(data): add getChargePageData server loader`
3. `refactor(cockpit): extract BlockGrid generic component`
4. `feat(charge): add SportSegmentedTabs + ChargePageClient shell`
5. `feat(charge): blocks 1-4 (status, acute-chronic, freshness, weekly-load)`
6. `feat(charge): blocks 5-8 (fitness-fatigue, sport-dist, intensity-dist, monotony-strain)`
7. `feat(charge): blocks 9-12 (top-activities, heatmap, ramp-rate, insights) + help bottom-sheets`
8. `chore(labels): relabel ChargeBlock cockpit to match new vocabulary`

### Déploiement

`git push` sur `master` → Vercel auto-deploy. Pas de `vercel --prod` direct.

---

## Limites connues

- `STRAIN.high = 6000` est un seuil arbitraire à recalibrer sur les données réelles après quelques semaines d'utilisation.
- "Reprise progressive" du ramp-rate est ambigu si la semaine précédente était à 0 ; règle conservatrice.
- Pas de prise en compte altitude/chaleur (hors scope CES).
- Workout type (sortie longue / fractionné / côtes / runtaf / vélotaf) affiché seulement dans `top-activities`, pas de bloc dédié.
- Filtre intensité utilise la classification existante de `dashboard.ts:getIntensityLabel` — la 6e catégorie "Endurance active" sera ajoutée (entre Footing et Seuil) en s'appuyant sur zone HR 2 si dispo, sinon mot-clé "endurance" dans le nom.
- Calcul `loadBalanceRatio.sumRatio7vs28` ignore la confidence ATL/CTL (< 14 jours d'historique). En cas d'historique court, on retourne `status: insufficient` plutôt qu'un ratio fragile.

---

## Prochaines améliorations possibles (hors scope)

- Vue 12 semaines (au lieu de 10) configurable.
- Comparaison à la même période de l'année précédente.
- Détection automatique d'une période de tapering pré-course (intègre la table `races`).
- Insights croisés avec le plan d'entraînement (cohérence séances prévues vs réalisées).
- Export PDF d'un rapport hebdo.
