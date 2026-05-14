> **Status: Implémenté** · Date: 2026-05-04 · Code: `web/lib/design/`, `web/tailwind.config.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Design System Migration — Android → Web

**Date:** 2026-05-04  
**Objectif:** Migration fidèle du design system Android (Jetpack Compose) vers la web app (Next.js + Tailwind).  
**Principe:** Zéro redesign, zéro interprétation SaaS générique. Même expérience visuelle.

---

## Source de vérité Android

| Fichier Android | Contenu |
|---|---|
| `ui/theme/Color.kt` | 30 tokens couleur — palette dark + light complète |
| `ui/theme/Theme.kt` | Injection palette, thème Material |
| `ui/components/Charts.kt` | ChartCard, LineChart, BarChart (x2), ComboBarLineChart, PieChart, AreaChart |
| `ui/components/KpiTiles.kt` | KpiTile (avec header band), ProgressRow, FullWidthBarStrip |
| `ui/components/WeekTable.kt` | Tableau semaine scroll horizontal |
| `ui/screens/DashboardScreen.kt` | 6 tabs : Cockpit, Charge, Plan, Activities, CoursesRecords, Settings |
| `res/values/strings.xml` | Tous les labels métier |

---

## Règles non négociables

1. **Fidélité visuelle** — radius, couleurs, paddings, font sizes identiques à l'Android.
2. **Labels centralisés** — aucun label codé en dur dans les composants. Source unique : `web/lib/design/labels.ts`.
3. **Tokens non-couleur** — typography, spacing, radius, layout, shadows dans des fichiers séparés.
4. **Noms composants charts** — préfixe `Cockpit` pour éviter conflits Recharts.
5. **Migration progressive** — un écran validé avant de passer au suivant.
6. **Mobile-first** — breakpoint default = mobile, max-w-lg centré.

---

## Definition of Done (par écran)

Un écran est migré quand :
- [ ] Mêmes couleurs que l'Android (tokens `trail-*`)
- [ ] Mêmes radius (4dp → rounded, 6dp → rounded-md)
- [ ] Mêmes espacements (card: px-2.5 py-2, screen: px-4)
- [ ] Mêmes tailles de texte (KPI value 20sp, header 12sp, subline 11sp)
- [ ] Même structure de blocs (header band sur KpiTile, etc.)
- [ ] Composants partagés Cockpit* utilisés
- [ ] Aucun design générique SaaS
- [ ] Mobile-first
- [ ] Build sans erreur TS
- [ ] Données existantes non cassées

---

## STEP 1 — Design Tokens

### Fichiers à créer

```
web/lib/design/colors.ts      — palette complète dark + light (mirror Color.kt)
web/lib/design/typography.ts  — font sizes, weights, line heights
web/lib/design/spacing.ts     — padding, gaps, hauteurs composants
web/lib/design/radius.ts      — border-radius par composant
web/lib/design/shadows.ts     — ombres (minimal, design à base de borders)
web/lib/design/layout.ts      — dimensions graphiques, largeurs, hauteurs blocs
web/lib/design/labels.ts      — labels métier depuis strings.xml
```

`web/tailwind.config.ts` mis à jour avec les tokens manquants.

### Couleurs manquantes (vs Color.kt)

| Token | Hex dark | Hex light | Usage |
|---|---|---|---|
| `pie-cotes` | `#8B5CF6` | `#7C56C9` | Camembert — segment Côtes |
| `pie-footing` | `#F59E0B` | `#DF8E16` | Camembert — segment Footing |
| `pie-autre` | `#6B8A85` | `#7B8E88` | Camembert — segment Autre |
| `progress-run-bg` | `#243530` | `#FBE2D8` | Fond barre run |
| `progress-volume-bg` | `#13211E` | `#DFF5E8` | Fond barre volume |
| `progress-dplus-bg` | `#11232A` | `#DCF0F7` | Fond barre D+ |

Tokens déjà présents (aliases sémantiques vérifiés) :
- `chargeOrange` = `primary` (#FF6B35) ✓
- `seriesBlue` = `accent` (#38BDF8) ✓
- `greenOk` = `success` (#4ADE80) ✓
- `runRed` = `danger` (#F87171) ✓
- `seriesYellow` = `warning` (#FBBF24) ✓
- `pieSeuil` = `warning` (#FBBF24) ✓
- `pieRuntaf` = `primary` (#FF6B35) ✓
- `pieVma` = `accent` (#38BDF8) ✓
- `pieSortieLongue` = `success` (#4ADE80) ✓

### Typography (depuis KpiTiles.kt, Charts.kt)

| Élément | Android | CSS équivalent |
|---|---|---|
| KPI main value | 20sp Bold | `text-[20px] font-bold` |
| KPI header label | 12sp Bold | `text-[12px] font-bold` |
| KPI subline | 11sp | `text-[11px]` |
| Chart title | 13sp SemiBold | `text-[13px] font-semibold` |
| Chart axis label | 12–13sp | `text-[12px]` |
| Chart value label | 13sp Bold | `text-[13px] font-bold` |
| Chart legend | 14sp | `text-[14px]` |
| BarStrip label | 10sp SemiBold | `text-[10px] font-semibold` |
| WeekTable cell | 11sp | `text-[11px]` |
| Section header | 12sp SemiBold uppercase | `text-[12px] font-semibold uppercase tracking-wide` |

### Spacing (depuis KpiTiles.kt, Charts.kt, DashboardScreen.kt)

| Contexte | Android | CSS |
|---|---|---|
| Screen horizontal | 16dp | `px-4` |
| Screen vertical | 16dp | `py-4` |
| Card horizontal | 10dp | `px-2.5` |
| Card vertical | 8dp | `py-2` |
| KpiTile header | 8dp h / 4dp v | `px-2 py-1` |
| Between KPI tiles | 8dp | `gap-2` |
| Between blocks | 8–12dp | `gap-2` / `space-y-2` |
| Chart between title and canvas | 6dp | `mt-1.5` |
| ProgressRow bar height | 16dp | `h-4` |
| ProgressRow label → bar | 4dp | `mt-1` |

### Radius (depuis RoundedCornerShape dans chaque composant)

| Composant | Android | CSS |
|---|---|---|
| KpiTile | 4dp | `rounded` (4px) |
| ChartCard | 6dp | `rounded-md` (6px) |
| WeekTable | 4dp | `rounded` (4px) |
| ProgressRow bar | 2dp | `rounded-sm` (2px) |
| FullWidthBarStrip bar | 2dp | `rounded-sm` (2px) |
| Pie legend dot | 2dp | `rounded-sm` (2px) |

> ⚠️ Le web actuel utilise `rounded-2xl` (16px) partout — incorrect. À corriger.

### Dimensions layout (depuis Charts.kt)

**Chart canvas pads (px):**
```
leftPad:   40px
rightPad:  10px (44px pour ComboBarLineChart axe double)
topPad:    35px (LineChart) / 18px (BarChart)
bottomPad: 86px (avec x-labels) / 12px (sans)
```

**ChartCard:**
```
minHeight:       180px (default) / 192px (AreaChart)
```

**Dimensions composants:**
```
WeekTable.HeaderCell height:  28px  (h-7)
WeekTable.BodyCell height:    26px  (h-[26px])
WeekTable.col session:        90px
WeekTable.col day:            92px
WeekTable.col total:          70px
FullWidthBarStrip height:     26px  (h-[26px])
FullWidthBarStrip gap:        2px
ProgressRow bar height:       16px  (h-4)
PieChart canvas:              150×150px
```

**Charts Recharts:**
```
Series stroke width:   4px
Point radius:          5.5px (Recharts dot r=5.5)
Bar width ratio:       55% du slot
Pie ring thickness:    55% du radius (donut épais)
```

### Shadows

Le design Android dark utilise des **borders** (`#1E3530`) plutôt que des ombres pour délimiter les blocs. Pas d'élévation visible. → Pas de `box-shadow` dans le design system web.

---

## STEP 2 — Composants primitifs

### Fichiers à créer/remplacer

| Fichier | Remplace / Nouveau |
|---|---|
| `web/components/ui/KpiTile.tsx` | Remplace `KpiCard.tsx` (ajout header band) |
| `web/components/ui/ProgressRow.tsx` | Nouveau |
| `web/components/ui/BarStrip.tsx` | Nouveau (FullWidthBarStrip) |
| `web/components/ui/WeekTable.tsx` | Nouveau |
| `web/components/charts/CockpitChartCard.tsx` | Nouveau (conteneur générique) |

### Structure KpiTile (source KpiTiles.kt)

```tsx
// Header band (fond headerBg, titre coloré)
<div className="bg-trail-header px-2 py-1 rounded-t flex items-center justify-between">
  <span className="text-[12px] font-bold" style={{ color: titleColor }}>{title}</span>
  {trailing}
</div>
// Body
<div className="bg-trail-card px-2.5 py-2">
  <p className="text-[20px] font-bold text-trail-text">{mainValue}</p>
  {subline1 && <p className="text-[11px] text-trail-muted mt-0.5">{subline1}</p>}
  {subline2 && <p className="text-[11px] text-trail-muted mt-1">{subline2}</p>}
</div>
```

---

## STEP 3 — Migration Dashboard / Cockpit

Blocs Cockpit Android (défaut visible) → équivalents web :

| Bloc Android | Composant web |
|---|---|
| `KpisRun` | `KpiTile` × 4 (km, D+, TSB, CES) |
| `GoalsRun` | `ProgressRow` × 2 (km annuels, D+) |
| `ChartRun` | `CockpitComboChart` (barres hebdo + ligne km cumulé) |
| `RatioRun` | `CockpitBarChart` (ratio D+/km) |
| `Load` | `CockpitLineChart` (ATL/CTL) |
| `DaysRun` | `WeekTable` |
| `CumulMonthsRun` | `CockpitBarChart` (km mensuels) |
| `Intensity` | `CockpitPieChart` (répartition intensité) |
| `Strava` | Section Strava (connexion/sync) |
| `CurrentWeek` | Liste activités de la semaine |

---

## STEP 4 — Comparaison visuelle Dashboard

Rapport de comparaison à fournir avant STEP 5, portant sur :
- Couleurs (token par token)
- Radius (composant par composant)
- Paddings
- Tailles de texte
- Structure des KPI (présence du header band)
- Graphiques (type, couleurs séries)
- Rendu mobile-first (375px)

---

## STEP 5 — Migration autres écrans

Ordre après validation Dashboard :
1. `charge` — 4 graphiques (CES/30j, EWMA, TSB, intensité)
2. `activities` — WeekTable + liste filtrable
3. `plan` — cycles d'entraînement
4. `courses` — records personnels
5. `settings` — profil athlète, connexions, compte
