# Migration du design Deep Mission vers les écrans réels

> **Status: Implémenté** · 2026-06-05 · Branche: `claude/design-deep-mission` · Code: web/app/globals.css, web/tailwind.config.ts, web/app/layout.tsx, web/lib/design/{colors,sports}.ts

## Contexte

La fondation de marque « Deep Mission » existe déjà (branche `claude/trail-cockpit-design-audit-rPRxL`, en retard sur master) : tokens CSS additifs (`--ink-*`, `--primary`, `--data-*`, `--text-*`, `--status-*`), polices opt-in (`font-display` = Space Grotesk, `font-body` = Inter via `next/font`), config Tailwind correspondante, et composants DS (`Button`, `Badge`, `Card`, `Sheet`) + brand (`TrajectoryLine`, `LogoTrailCockpit`).

Les écrans métier, eux, stylent **tout** via les anciens tokens `--trail-*` (`bg-trail-bg`, `text-trail-text`, `text-trail-primary`…) et la police par défaut. « Migrer le design » = faire passer ces écrans au langage Deep Mission **pour les deux modes** (Mission et Expert).

## Décision de stratégie : remap de tokens

On **ne réécrit pas** les classNames métier. On rebranche les variables `--trail-*` sur les valeurs Deep Mission dans une seule couche de `globals.css`. Conséquences :

- Tous les écrans héritent du nouveau look instantanément (Mission **et** Expert basculent ensemble).
- Risque visuel faible, changement réversible (on touche la couche tokens, pas le markup).
- Le raffinage fin (composants DS, `TrajectoryLine` en hero) reste possible en phase ultérieure, hors de cette spec.

## Périmètre

**Dans le périmètre :**
1. Rapporter la fondation Deep Mission (tokens, polices, config Tailwind, composants DS/brand, pages de validation) sur `claude/design-deep-mission`.
2. Couche de remap `--trail-*` → Deep Mission (dark + light).
3. Typographie : Inter en police de corps globale + Space Grotesk sur les éléments signature.
4. Couleurs sport de marque (course orange · vélo vert · natation bleu) via champs dédiés dans `colors.ts`.

**Hors périmètre (phases ultérieures) :** remplacer le markup par les composants DS (`<Card>`, `<Button>`…), intégrer `TrajectoryLine`/`Logo` en hero, refonte de layout. C'est un remap, pas une refonte structurelle.

## 1. Fondation rapportée

Reprendre, à l'identique de la branche d'audit, les ajouts **additifs** :
- `web/app/globals.css` : bloc de tokens Deep Mission (`--ink-*`, `--primary*`, `--data-*`, `--text-*`, `--primary-text`, `--status-*`) pour `:root` (dark) et `.light`, + keyframes `sheetUp` / `stepIn`.
- `web/tailwind.config.ts` : couleurs `ink`, `primary`, `data`, `fg`, `status` + `fontFamily.display` / `fontFamily.body`.
- `web/app/layout.tsx` : chargement `Space_Grotesk` + `Inter` via `next/font/google`, variables `--font-space-grotesk` / `--font-inter` sur `<html>`.
- Composants DS : `web/components/ui/{Button,Badge,Card,Sheet}.tsx`, helper `web/lib/cn.ts`.
- Brand : `web/components/brand/{TrajectoryLine,LogoTrailCockpit}.tsx`.
- Pages de validation (utiles pour QA, sans impact métier) : `/design-system`, `/onboarding-preview`, `/cockpit-mission-preview` et leurs composants.

> Ne **pas** reprendre les autres divergences de la branche d'audit (elle est en retard sur master, notamment sur le correctif Fraîcheur). On ne rapporte que les fichiers de la fondation listés ci-dessus.

## 2. Remap couleurs (`globals.css`)

Après le bloc de tokens Deep Mission, on redéfinit les `--trail-*` en pointant sur les variables Deep Mission (source unique) ou sur une valeur littérale quand le thème l'exige.

### Dark (`:root`)
| `--trail-*` | actuel | cible |
|---|---|---|
| `--trail-bg` | `#0A0F0E` | `var(--ink-900)` |
| `--trail-surface` | `#111A18` | `var(--ink-800)` |
| `--trail-card` | `#162420` | `var(--ink-700)` |
| `--trail-border` | `#1E3530` | `var(--ink-600)` |
| `--trail-header` | `#101917` | `#0F151D` (encre entre 900 et 800) |
| `--trail-primary` | `#FF6B35` | `var(--primary)` = `#FF7900` |
| `--trail-primary-dim` | `#CC5528` | `var(--primary-dim)` = `#CC6100` |
| `--trail-text` | `#E2ECE9` | `var(--text-primary)` (identique) |
| `--trail-muted` | `#8BA8A3` | `var(--text-muted)` (identique) |
| `--trail-accent` `--trail-success` `--trail-warning` `--trail-danger` | — | **inchangés** (déjà alignés Deep Mission) |
| `--trail-pale-green`, `--trail-pie-*`, `--trail-progress-*` | — | **inchangés** (couleurs de graphe, hors marque) |

### Light (`.light`)
bg / surface / card / border / text / muted sont déjà identiques aux valeurs Deep Mission claires → on les pointe sur les variables ink/text pour cohérence. Seuls changements réels :

| `--trail-*` | actuel | cible |
|---|---|---|
| `--trail-primary` | `#E6612B` | **`#C2410C`** |
| `--trail-primary-dim` | `#CC5226` | `#A8380A` |
| reste | — | inchangé (`--trail-header` `#E8F0ED` conservé) |

**Arbitrage contraste (light) :** `--trail-primary` sert à la fois de fond de bouton (texte blanc) et de couleur de texte orange. `#FF7900` échoue l'AA dans ces deux usages (~2.3:1). `#C2410C` passe l'AA (~5.9:1 dans les deux cas) au prix d'un orange plus profond. On retient `#C2410C` en light. Retrouver l'orange vif en light supposera de séparer fond/texte via les composants DS (phase ultérieure, hors périmètre).

## 3. Typographie

- **T1 — Inter global :** dans `tailwind.config.ts`, faire pointer `fontFamily.sans` sur la stack Inter (`var(--font-inter)`, …). Un seul changement, tout le texte bascule. Risque quasi nul (métriques Inter proches du système).
- **T2 — Space Grotesk signature :** ajouter `font-display` sur le wordmark « TRAIL COCKPIT » (`AppShell` header + `DesktopSidebar`).
- **T3 — Titres de blocs & valeurs héro :** il n'existe pas de composant titre partagé ; ajouter `font-display` sur le titre et la valeur métrique principale de chaque bloc, à énumérer dans le plan (blocs cockpit : `LastActivityBlock`, `GoalsBlock`, `WeekActivitiesBlock`, `HistoryBlock`, `FreshnessCard` ; blocs plan : `ObjectifCourseBlock`, `ResumeSemaineBlock`, `VueSemaineBlock`, `BibliothequeSeancesBlock` ; blocs charge ; morning-report). Liste exhaustive établie au moment du plan par recensement des composants `*Block`.

## 4. Couleurs sport de marque

Identité de marque : **course = orange `#FF7900`**, **vélo = vert `#27A971`**, **natation = bleu `#4BB4E6`**.

État actuel (`web/lib/design/colors.ts` + `web/lib/design/sports.ts`) : `SPORT_CONFIG.ride.color = seriesGreen #4ADE80` et `SPORT_CONFIG.swim.color = seriesBlue #38BDF8`. Or `seriesGreen`/`seriesBlue` servent **aussi** aux graphes génériques (barres volume, D+, camemberts) — on ne peut donc pas les remapper.

Solution : introduire dans `colors.ts` des champs **dédiés** sans toucher aux séries génériques :
- `bikeGreen` : dark `#27A971`, light variante AA (≈ `#1E8E5E`).
- `swimBlue` : dark `#4BB4E6`, light variante AA (≈ `#2A8FC4`).
- `chargeOrange` : dark `#FF6B35` → `#FF7900` ; light `#E6612B` → `#C2410C` (cohérence avec `--trail-primary`).

Brancher `SPORT_CONFIG.ride.color → bikeGreen`, `SPORT_CONFIG.swim.color → swimBlue`. `seriesGreen`/`seriesBlue`/`seriesYellow` (et donc les graphes génériques) restent inchangés.

**Vérification obligatoire :** recenser tout usage de `colors.seriesGreen` / `colors.seriesBlue` (ou `bikeBlack`) qui signifie « vélo / natation » plutôt que « série de graphe », et le rebrancher sur `bikeGreen` / `swimBlue`.

## 5. Validation

- `npx tsc --noEmit` + `npm run lint` verts (build autoritatif sur Vercel — cf. contrainte build local Windows).
- QA visuelle par Franck sur la preview Vercel de la branche : **2 thèmes × 2 modes**, écrans Cockpit, Plan, Activités, Charge, détail activité, Réglages. Contrôler en particulier : lisibilité de l'orange en light, rendu des graphes après bascule des couleurs sport, interlignage après passage à Inter.

## Déroulé (5 étapes)

1. Fondation rapportée sur la branche.
2. Couche de remap `--trail-*` (dark + light).
3. Typographie (Inter global + Space Grotesk signature/titres).
4. Couleurs sport de marque (`colors.ts` + `SPORT_CONFIG` + vérif des usages).
5. Validation (tsc/lint + QA Vercel).

## Risques

| Risque | Mitigation |
|---|---|
| Orange illisible en light | `--trail-primary` light = `#C2410C` (AA) |
| Swap de police global déplace des layouts | Inter ≈ métriques système ; QA visuelle |
| Couleurs sport propagées aux graphes génériques | Champs dédiés `bikeGreen`/`swimBlue`, séries génériques intactes, étape de vérif |
| Branche d'audit en retard sur master | Ne rapporter que les fichiers de fondation listés, pas les autres divergences |
