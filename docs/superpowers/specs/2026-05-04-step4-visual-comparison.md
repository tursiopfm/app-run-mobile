> **Status: Implémenté** · Date: 2026-05-04 · Code: `web/app/(main)/dashboard/`, `web/components/cockpit/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# STEP 4 — Visual Comparison Report: Dashboard / Cockpit

**Date:** 2026-05-04  
**Source:** `DashboardScreen.kt` (CockpitTab, lines 1461–1733) + `Charts.kt` + `KpiTiles.kt`  
**Target:** `web/app/dashboard/page.tsx` + components

---

## Methodology

Code-level audit: each web component's visual properties compared directly against the Android Kotlin source. No Android screenshots exist in repo; web dashboard requires Supabase auth (login to validate visually at http://localhost:3001).

---

## Screen / Layout

| Property | Android | Web (before) | Web (after) | Status |
|---|---|---|---|---|
| Screen H padding | `8dp` (contentPadding) | `px-4` (16px) | `px-2` (8px) | ✅ Fixed |
| Screen V padding | `8dp` | `py-4` (16px) | `py-2` (8px) | ✅ Fixed |
| Block gap | `spacedBy(8dp)` | `space-y-3` (12px) | `space-y-2` (8px) | ✅ Fixed |

---

## KPIs Block (SectionCard)

| Property | Android | Web (before) | Web (after) | Status |
|---|---|---|---|---|
| SectionCard radius | `12dp` | `rounded-[12px]` | `rounded-[12px]` | ✅ |
| SectionCard bg | `CardBg` | `bg-trail-card` | `bg-trail-card` | ✅ |
| SectionCard padding | `10dp` | `p-[10px]` | `p-[10px]` | ✅ |
| Header row | "Activités — Course 🏃" + TsbBadge | Missing | Added | ✅ Fixed |
| Header text size | `16sp SemiBold` | — | `text-[16px] font-semibold` | ✅ Fixed |
| Tile gap | `spacedBy(6dp)` | `gap-2` (8px) | `gap-[6px]` | ✅ Fixed |
| Row gap between 2 rows | `Spacer(6dp)` | None | `h-[6px]` div | ✅ Fixed |

### CockpitKpiTile — SEMAINE km

| Property | Android | Web | Status |
|---|---|---|---|
| Radius | `10dp` | `rounded-[10px]` | ✅ |
| Bg | `Surface` | `bg-trail-surface` | ✅ |
| H/V padding | `8dp / 5dp` | `px-2 py-[5px]` | ✅ |
| Title | `11sp SemiBold SubtleText` | `text-[11px] font-semibold text-trail-muted` | ✅ |
| Value size | `21sp Black` | `text-[21px] font-black` | ✅ |
| Unit size | `14sp SubtleText` | `text-[14px] text-trail-muted` | ✅ Fixed (was 11px) |
| Bar labels | km values (e.g. "8.2") | Day letters "L M M…" | km values | ✅ Fixed |
| Bar color | `ChargeOrange` | `#FF6B35` | ✅ |

### CockpitKpiTile — D+ SEMAINE

| Property | Android | Web | Status |
|---|---|---|---|
| Value size | `21sp Black` | `text-[21px] font-black` | ✅ |
| Unit size | `14sp SubtleText` | `text-[14px] text-trail-muted` | ✅ Fixed |
| Bar labels | D+ int values | Day letters → D+ values | ✅ Fixed |
| Bar color | `SeriesBlue` | `#38BDF8` | ✅ |

### CockpitKpiTile — ANNÉE

| Property | Android | Web (before) | Web (after) | Status |
|---|---|---|---|---|
| Value size | `18sp Black` | `text-[21px]` | `text-[18px] font-black` | ✅ Fixed |
| Unit size | `14sp` | 11px | `text-[14px]` | ✅ Fixed |
| Bar labels | km rounded int | Day letters → km values | ✅ Fixed |
| Bar color | `ChargeOrange` | `#FF6B35` | ✅ |

### CockpitKpiTile — CHARGE (4th tile)

| Property | Android | Web (before) | Web (after) | Status |
|---|---|---|---|---|
| Icon | "⚡" | None | "⚡" | ✅ Fixed |
| Title | "CHARGE (RUN)" | "CHARGE" | "CHARGE (RUN)" | ✅ Fixed |
| Content | ATL orange 13sp Bold + ATL value 21sp Black + "•" + CTL blue | TsbBadge | ATL • CTL inline | ✅ Fixed |
| Bar data | weekly TSB last 7, min-max normalized | daily ATL → daily TSB last 7 | ✅ Fixed |
| Bar labels | TSB int values | Day letters → TSB int values | ✅ Fixed |
| Bar color | `SeriesYellow` (#FBBF24) | `ChargeOrange` | `#FBBF24` | ✅ Fixed |

---

## GoalProgressRow

| Property | Android | Web | Status |
|---|---|---|---|
| Label size | `16sp` left | `text-[16px]` | ✅ |
| Value size | `16sp colored` right | `text-[16px]` + color | ✅ |
| Bar height | `6dp` rounded-full | `h-[6px] rounded-full` | ✅ |
| Bar bg | `Border` | `bg-trail-border` | ✅ |

---

## CockpitChartCard (Load chart, Monthly, Intensity)

| Property | Android | Web | Status |
|---|---|---|---|
| Radius | `6dp` | `rounded-md` (6px) | ✅ |
| Bg | `CardBg` | `bg-trail-card` | ✅ |
| H/V padding | `10dp / 8dp` | `px-2.5 py-2` | ✅ |
| Title size | `13sp SemiBold` | `text-[13px] font-semibold` | ✅ |

---

## CockpitLineChart (ATL vs CTL)

| Property | Android | Web | Status |
|---|---|---|---|
| Stroke width | `4f` | `strokeWidth={4}` | ✅ |
| Dot radius | `5.5f` | `dot={{ r: 5.5 }}` | ✅ |
| ATL color | `ChargeOrange` | `#FF6B35` | ✅ |
| CTL color | `SeriesBlue` | `#38BDF8` | ✅ |
| Left pad | `40px` | `margin.left=0 + YAxis width=34` ≈ 34px | ~✅ |
| Bottom pad | `86px` | XAxis `height={70}` | ~✅ |
| Legend | Below chart | Below chart, colored lines | ✅ |

---

## CockpitBarChart (Monthly km)

| Property | Android | Web | Status |
|---|---|---|---|
| Bar width ratio | `0.55` | `barCategoryGap=45%` | ✅ |
| Bar radius | `2dp top` | `radius={[2,2,0,0]}` | ✅ |
| Color | `ChargeOrange` | `#FF6B35` | ✅ |
| X labels | month names | MONTH_ABBR | ✅ |

---

## CockpitPieChart (Intensity)

| Property | Android | Web | Status |
|---|---|---|---|
| Ring ratio | `pieRingRatio=0.55` | innerR = outerR × 0.45 | ✅ |
| Legend position | Right column | Right column | ✅ |
| Legend square | 10×10dp | 10×10px rounded-sm | ✅ |
| Legend text | `14sp` | `text-[14px]` | ✅ |

---

## WeekTable

| Property | Android | Web | Status |
|---|---|---|---|
| Radius | `4dp` | `rounded` (4px) | ✅ |
| Header height | `28dp` | `28px` | ✅ |
| Body height | `26dp` | `26px` | ✅ |
| Cell text | `11sp` | `text-[11px]` | ✅ |
| Header bg | `HeaderBg` | `bg-trail-header` | ✅ |
| Body bg | `Surface` | `bg-trail-surface` | ✅ |

---

## BarStrip

| Property | Android | Web | Status |
|---|---|---|---|
| Canvas height | `26dp` | `HEIGHT=26` | ✅ |
| Bar gap | `2px` | `GAP=2` | ✅ |
| Corner radius | `2dp` | `CORNER=2` | ✅ |
| Min inside threshold | `13dp` | `MIN_INSIDE=13` | ✅ |
| Label inside/above logic | barH≥13 → inside | barH≥13 → inside | ✅ |

---

## TsbBadge

| Property | Android | Web | Status |
|---|---|---|---|
| Text size | `15sp SemiBold` | `text-[15px] font-semibold` | ✅ |
| Border opacity | `fg/35%` | `${fg}59` | ✅ |
| TSB≥10 | bg=#0C2A4A fg=#38BDF8 | same | ✅ |
| TSB≥0 | bg=#0A2E1E fg=#4ADE80 | same | ✅ |
| TSB≥-10 | bg=#2A1F00 fg=#FBBF24 | same | ✅ |
| TSB<-10 | bg=#2A0A0A fg=#F87171 | same | ✅ |

---

## Summary

- **8 discrepancies fixed** in this step (padding, gaps, unit sizes, tile content, bar labels, bar colors)
- **0 remaining structural discrepancies** found through code audit
- **Visual validation needed** by user at `http://localhost:3001/dashboard` (login required)

### Items needing user eye-check
1. Chart axis label rotation — rotated -40° labels may clip on narrow screens
2. KPI tile content overflow — ATL • CTL on small tiles may wrap
3. Monthly bar chart label density — all 12 month labels at -40°
4. Intensity pie inner/outer ratio appearance
5. SectionCard vs ChartCard visual contrast (different bg colors)

---

## Decision

**Ready for STEP 5** once user confirms no blocking visual issues on the dashboard.
