# Migration design Deep Mission (remap de tokens) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire basculer tous les écrans réels (Cockpit/Plan/Activités/Charge, modes Mission **et** Expert) vers le langage de marque « Deep Mission » sans réécrire le markup, via un remap des variables `--trail-*`, un swap de police global, et l'alignement des couleurs sport.

**Architecture:** La fondation Deep Mission est additive (tokens CSS `--ink/--primary/--data/--text/--status`, polices `next/font`, config Tailwind, composants DS). On la rapporte sur la branche, puis on rebranche les `--trail-*` (utilisés partout) sur les valeurs Deep Mission dans `globals.css`. Les custom properties CSS se résolvant à l'usage, l'ordre de déclaration n'importe pas. Tout le reste hérite automatiquement.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, CSS custom properties, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-06-05-design-deep-mission-migration-design.md`
**Branche:** `claude/design-deep-mission` (déjà créée depuis `origin/master`).

**Notes d'environnement (Windows) :**
- Lancer `tsc`/`npm`/`lint` **depuis `web/`** (cwd peu fiable → `cd` absolu vers `c:\Users\Franc\app-run-mobile\web`).
- **Ne pas** lancer `next build` en local si un `next dev` tourne (conflit `.next`). Vérif autoritaire = `npx tsc --noEmit` + `npm run lint` ; le build réel se fait sur Vercel au push.
- Commits git depuis la racine du repo.

---

## Carte des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `web/components/ui/{Button,Badge,Card,Sheet}.tsx`, `web/lib/cn.ts` | Composants DS + helper classes | Rapportés (checkout) |
| `web/components/brand/{TrajectoryLine,LogoTrailCockpit}.tsx` | Composants brand | Rapportés (checkout) |
| `web/app/{design-system,onboarding-preview,cockpit-mission-preview}/page.tsx` + `web/components/mission-preview/*`, `web/components/onboarding/mission-setup/*` | Pages de validation | Rapportées (checkout) |
| `web/app/globals.css` | Tokens Deep Mission + couche de remap `--trail-*` | Modifié |
| `web/tailwind.config.ts` | Couleurs `ink/primary/data/fg/status` + `fontFamily` (display/body/sans→Inter) | Modifié |
| `web/app/layout.tsx` | Chargement polices Space Grotesk + Inter | Modifié |
| `web/components/navigation/AppShell.tsx`, `web/components/navigation/DesktopSidebar.tsx` | `font-display` sur le wordmark | Modifié |
| `web/components/cockpit/*Block.tsx` (+ MorningReportTile) | `font-display` sur le titre de bloc | Modifié |
| `web/components/plan/{ObjectifCourseBlock,ResumeSemaineBlock}.tsx` | `font-display` sur le titre/valeur héro | Modifié |
| `web/lib/design/colors.ts` | `bikeGreen`/`swimBlue` + orange de marque `#FF7900`/`#C2410C` | Modifié |
| `web/lib/design/sports.ts` | `SPORT_CONFIG` vélo/natation → couleurs dédiées | Modifié |

---

## Task 1 : Rapporter la fondation Deep Mission

**Files:**
- Create (checkout depuis la branche d'audit) : `web/components/ui/Button.tsx`, `web/components/ui/Badge.tsx`, `web/components/ui/Card.tsx`, `web/components/ui/Sheet.tsx`, `web/lib/cn.ts`, `web/components/brand/TrajectoryLine.tsx`, `web/components/brand/LogoTrailCockpit.tsx`, `web/app/design-system/page.tsx`, `web/app/onboarding-preview/page.tsx`, `web/app/cockpit-mission-preview/page.tsx`, `web/components/mission-preview/CockpitMissionPreview.tsx`, `web/components/onboarding/mission-setup/MissionSetupFlow.tsx`
- Modify: `web/app/globals.css`, `web/tailwind.config.ts`, `web/app/layout.tsx`

- [ ] **Step 1 : Rapporter les fichiers de fondation depuis la branche d'audit**

Depuis la racine du repo :
```bash
git checkout claude/trail-cockpit-design-audit-rPRxL -- \
  web/components/ui/Button.tsx \
  web/components/ui/Badge.tsx \
  web/components/ui/Card.tsx \
  web/components/ui/Sheet.tsx \
  web/lib/cn.ts \
  web/components/brand/TrajectoryLine.tsx \
  web/components/brand/LogoTrailCockpit.tsx \
  web/app/design-system/page.tsx \
  web/app/onboarding-preview/page.tsx \
  web/app/cockpit-mission-preview/page.tsx \
  web/components/mission-preview/CockpitMissionPreview.tsx \
  web/components/onboarding/mission-setup/MissionSetupFlow.tsx
```

- [ ] **Step 2 : Ajouter le bloc de tokens Deep Mission à `globals.css`**

Dans `web/app/globals.css`, à la fin du bloc `:root { … }` (juste avant la `}` fermante de `:root`, après la ligne `--ind-shadow: 0 2px 4px rgba(0,0,0,0.3);`), insérer :

```css

  /* ── Brand foundation « Deep Mission » (nouveau DS, additif) ─────────
     Encre neutre multi-sport. Découple le branding (--primary) des données
     (--data-*). Voir /design-system. */
  --ink-900: #0B0F14;
  --ink-800: #121821;
  --ink-700: #18202B;
  --ink-600: #25303E;
  --ink-500: #34414F;
  --primary:      #FF7900;
  --primary-dim:  #CC6100;
  --primary-glow: rgba(255, 121, 0, 0.18);
  --data-charge: #FF7900;
  --data-bike:   #27A971;
  --data-swim:   #4BB4E6;
  --data-run:    #FF7900;
  --text-primary:   #E2ECE9;
  --text-secondary: #B7C6C1;
  --text-muted:     #8BA8A3;
  --text-disabled:  #5A6E69;
  --text-inverse:   #0B0F14;
  --primary-text:   #FF8A33;
  --status-success: #4ADE80;
  --status-warning: #FBBF24;
  --status-danger:  #F87171;
  --status-info:    #38BDF8;
  --status-neutral: #8BA8A3;
```

Puis, à la fin du bloc `.light { … }` (juste avant sa `}`, après `--ind-shadow: 0 1px 2px rgba(15,30,28,0.08);`), insérer :

```css

  /* ── Brand foundation « Deep Mission » — variante claire ───────────── */
  --ink-900: #F4F7F6;
  --ink-800: #FFFFFF;
  --ink-700: #FFFFFF;
  --ink-600: #D6E1DD;
  --ink-500: #BBCBC4;
  --primary:      #FF7900;
  --primary-dim:  #CC6100;
  --primary-glow: rgba(255, 121, 0, 0.18);
  --data-charge: #FF7900;
  --data-bike:   #27A971;
  --data-swim:   #4BB4E6;
  --data-run:    #FF7900;
  --text-primary:   #13201D;
  --text-secondary: #3C4F49;
  --text-muted:     #5F7771;
  --text-disabled:  #9DB0AA;
  --text-inverse:   #F7FAF9;
  --primary-text:   #C2410C;
  --status-success: #138A52;
  --status-warning: #B07A00;
  --status-danger:  #D94F45;
  --status-info:    #1D8FC6;
  --status-neutral: #5F7771;
```

Enfin, à la toute fin du fichier (après la keyframe `slideDown`), ajouter :

```css

/* Brand foundation — montée du bottom-sheet (composant Sheet du DS) */
@keyframes sheetUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Onboarding Mission Setup — entrée d'écran */
@keyframes stepIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 3 : Ajouter les couleurs Deep Mission + `fontFamily` à `tailwind.config.ts`**

Dans `web/tailwind.config.ts`, dans `theme.extend.colors`, après le bloc `'progress-dplus-bg': 'var(--trail-progress-dplus-bg)',` et sa `},` fermante (la fin de la clé `trail`), insérer ces nouvelles clés de couleurs :

```ts
        // ── Brand foundation « Deep Mission » (nouveau DS) ──────────────
        ink: {
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
          500: 'var(--ink-500)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          dim:     'var(--primary-dim)',
          glow:    'var(--primary-glow)',
          text:    'var(--primary-text)',
        },
        data: {
          charge: 'var(--data-charge)',
          bike:   'var(--data-bike)',
          swim:   'var(--data-swim)',
          run:    'var(--data-run)',
        },
        fg: {
          DEFAULT:   'var(--text-primary)',
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          disabled:  'var(--text-disabled)',
          inverse:   'var(--text-inverse)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger:  'var(--status-danger)',
          info:    'var(--status-info)',
          neutral: 'var(--status-neutral)',
        },
```

Puis, après la clé `colors` (au même niveau, dans `theme.extend`), ajouter la clé `fontFamily` (l'override `sans → Inter` arrive en Task 3 ; ici on n'ajoute que `display`/`body`) :

```ts
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

> Si une clé `fontFamily` existe déjà dans `theme.extend`, fusionner `display`/`body` dedans au lieu d'en créer une seconde.

- [ ] **Step 4 : Charger les polices dans `layout.tsx`**

Dans `web/app/layout.tsx`, après la ligne `import type { Metadata, Viewport } from 'next'`, ajouter :
```ts
import { Space_Grotesk, Inter } from 'next/font/google'
```
Puis, après l'import de `'./globals.css'`, ajouter :
```ts
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
```
Enfin, remplacer la balise d'ouverture `<html lang={lang} suppressHydrationWarning>` par :
```tsx
    <html lang={lang} suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable}`}>
```

- [ ] **Step 5 : Vérifier la compilation**

Depuis `web/` :
```bash
npx tsc --noEmit
```
Expected : 0 erreur.
```bash
npm run lint
```
Expected : 0 erreur (warnings tolérés).

- [ ] **Step 6 : Commit**

```bash
git add web/components/ui web/lib/cn.ts web/components/brand web/app/design-system web/app/onboarding-preview web/app/cockpit-mission-preview web/components/mission-preview web/components/onboarding web/app/globals.css web/tailwind.config.ts web/app/layout.tsx
git commit -m "feat(design): rapporter la fondation Deep Mission (tokens, polices, DS)"
```

---

## Task 2 : Remap des tokens `--trail-*` → Deep Mission

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1 : Remap du thème sombre (`:root`)**

Dans `web/app/globals.css`, dans le bloc `:root`, remplacer les valeurs littérales des `--trail-*` par les variables Deep Mission. Lignes à modifier :
```css
  --trail-bg:               var(--ink-900);
  --trail-surface:          var(--ink-800);
  --trail-card:             var(--ink-700);
  --trail-border:           var(--ink-600);
  --trail-header:           #0F151D;
  --trail-muted:            var(--text-muted);
  --trail-text:             var(--text-primary);
  --trail-primary:          var(--primary);
  --trail-primary-dim:      var(--primary-dim);
```
Laisser inchangés : `--trail-accent`, `--trail-success`, `--trail-warning`, `--trail-danger`, `--trail-pale-green`, `--trail-pie-*`, `--trail-progress-*`, `--ind-*`.

- [ ] **Step 2 : Remap du thème clair (`.light`)**

Dans le bloc `.light`, remplacer :
```css
  --trail-bg:               var(--ink-900);
  --trail-surface:          var(--ink-800);
  --trail-card:             var(--ink-700);
  --trail-border:           var(--ink-600);
  --trail-muted:            var(--text-muted);
  --trail-text:             var(--text-primary);
  --trail-primary:          #C2410C;
  --trail-primary-dim:      #A8380A;
```
Laisser `--trail-header: #E8F0ED;` et les autres (accent/success/…/pie/progress/ind) inchangés.

> Rappel arbitrage : en light, `#C2410C` (au lieu de l'orange vif `#FF7900`) garantit l'AA pour le texte orange et le texte blanc sur bouton orange.

- [ ] **Step 3 : Vérifier la compilation**

Depuis `web/` :
```bash
npx tsc --noEmit && npm run lint
```
Expected : 0 erreur. (Le rendu couleur ne se vérifie qu'en visuel — voir Task 5.)

- [ ] **Step 4 : Commit**

```bash
git add web/app/globals.css
git commit -m "feat(design): remap des tokens --trail-* vers la palette Deep Mission"
```

---

## Task 3 : Typographie (Inter global + Space Grotesk signature)

**Files:**
- Modify: `web/tailwind.config.ts`, `web/components/navigation/AppShell.tsx`, `web/components/navigation/DesktopSidebar.tsx`, `web/components/cockpit/{ActivitiesBlock,ChargeBlock,CumulBlock,GoalsBlock,HistoryBlock,HistoryPillsBlock,IntensityBlock,LastActivityBlock,WeeklyStatsBlock,WeekActivitiesBlock,WeekBlock,MorningReportTile}.tsx`, `web/components/plan/{ObjectifCourseBlock,ResumeSemaineBlock}.tsx`

- [ ] **Step 1 : Inter en police de corps globale**

Dans `web/tailwind.config.ts`, dans la clé `fontFamily` ajoutée en Task 1, ajouter l'override `sans` :
```ts
      fontFamily: {
        sans:    ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

- [ ] **Step 2 : `font-display` sur le wordmark (header mobile)**

Dans `web/components/navigation/AppShell.tsx`, remplacer :
```tsx
            <span className="text-base font-bold tracking-widest uppercase">
```
par :
```tsx
            <span className="text-base font-bold tracking-widest uppercase font-display">
```

- [ ] **Step 3 : `font-display` sur le wordmark (sidebar desktop)**

Dans `web/components/navigation/DesktopSidebar.tsx`, remplacer :
```tsx
            <span className="flex-1 text-sm font-bold tracking-widest uppercase whitespace-nowrap">
```
par :
```tsx
            <span className="flex-1 text-sm font-bold tracking-widest uppercase whitespace-nowrap font-display">
```

- [ ] **Step 4 : `font-display` sur les titres de blocs cockpit (pattern partagé)**

Dans chacun des fichiers suivants, le titre de bloc est un `<span>` portant la classe **exacte** `text-[15px] font-semibold text-trail-muted`. Y ajouter `font-display` (→ `text-[15px] font-semibold text-trail-muted font-display`). Un seul `<span>` par fichier porte ce trio (le libellé sport voisin utilise une couleur inline, pas `text-trail-muted`) :

- `web/components/cockpit/ActivitiesBlock.tsx`
- `web/components/cockpit/ChargeBlock.tsx`
- `web/components/cockpit/CumulBlock.tsx`
- `web/components/cockpit/GoalsBlock.tsx`
- `web/components/cockpit/HistoryBlock.tsx`
- `web/components/cockpit/HistoryPillsBlock.tsx`
- `web/components/cockpit/IntensityBlock.tsx`
- `web/components/cockpit/LastActivityBlock.tsx`
- `web/components/cockpit/WeeklyStatsBlock.tsx`
- `web/components/cockpit/MorningReportTile.tsx`

Cas particuliers (classe légèrement différente) :
- `web/components/cockpit/WeekActivitiesBlock.tsx` : ajouter `font-display` au `<span>` `text-[15px] font-semibold text-trail-muted` (préfixe) **et** au `<span>` `text-[15px] font-semibold text-trail-text` (suffixe).
- `web/components/cockpit/WeekBlock.tsx` : le titre est `<p className="text-[15px] font-semibold text-trail-text">` → ajouter `font-display`.

- [ ] **Step 5 : `font-display` sur les titres/valeurs héro Plan**

- `web/components/plan/ObjectifCourseBlock.tsx` : le `<h3 className="text-[20px] text-trail-text mb-1">` → ajouter `font-display`.
- `web/components/plan/ResumeSemaineBlock.tsx` : ajouter `font-display` au titre `text-[18px] text-trail-text leading-tight` et à la valeur héro `text-[18px] font-bold leading-none truncate` (le `<span>` `style={{ color }}`).

- [ ] **Step 6 : Vérifier la compilation**

Depuis `web/` :
```bash
npx tsc --noEmit && npm run lint
```
Expected : 0 erreur.

- [ ] **Step 7 : Commit**

```bash
git add web/tailwind.config.ts web/components/navigation/AppShell.tsx web/components/navigation/DesktopSidebar.tsx web/components/cockpit web/components/plan/ObjectifCourseBlock.tsx web/components/plan/ResumeSemaineBlock.tsx
git commit -m "feat(design): Inter en corps global + Space Grotesk sur wordmark et titres de blocs"
```

---

## Task 4 : Couleurs sport de marque

**Files:**
- Modify: `web/lib/design/colors.ts`, `web/lib/design/sports.ts`

- [ ] **Step 1 : Ajouter les couleurs sport dédiées + l'orange de marque (`colors.ts`)**

Dans `web/lib/design/colors.ts`, bloc `dark` :
- Remplacer les **4** occurrences de `'#FF6B35'` par `'#FF7900'` (champs `chargeOrange`, `seriesOrange`, `pieRuntaf`, `progressRunFg`).
- Après la ligne `chargeOrange: '#FF7900',`, ajouter :
```ts
  bikeGreen:        '#27A971',
  swimBlue:         '#4BB4E6',
```

Dans le bloc `light` :
- Remplacer les **4** occurrences de `'#E6612B'` par `'#C2410C'` (mêmes champs).
- Après la ligne `chargeOrange: '#C2410C',`, ajouter :
```ts
  bikeGreen:        '#1E8E5E',
  swimBlue:         '#2A8FC4',
```

> `seriesGreen`, `seriesBlue`, `seriesYellow` et les `pie*`/`progress*` génériques restent **inchangés** (utilisés par les graphes).

- [ ] **Step 2 : Brancher `SPORT_CONFIG` sur les couleurs dédiées (`sports.ts`)**

Dans `web/lib/design/sports.ts`, dans `SPORT_CONFIG` :
- Ligne `ride` : remplacer `color: colors.seriesGreen` par `color: colors.bikeGreen`.
- Ligne `swim` : remplacer `color: colors.seriesBlue` par `color: colors.swimBlue`.

Résultat attendu :
```ts
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.bikeGreen },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.swimBlue  },
```

- [ ] **Step 3 : Vérifier les usages « sport » de `seriesGreen`/`seriesBlue`**

Recenser les usages directs, hors graphes, qui signifient « vélo/natation » :
```bash
git grep -n "seriesGreen\|seriesBlue\|bikeBlack" -- web/components web/lib
```
Pour chaque résultat : si le contexte représente le **sport** vélo/natation (libellé/pastille/icône de sport), le rebrancher sur `colors.bikeGreen` / `colors.swimBlue`. Si le contexte est une **série de graphe générique** (barres, camembert, courbe), **ne pas** modifier. Documenter les changements éventuels dans le message de commit.

- [ ] **Step 4 : Vérifier la compilation**

Depuis `web/` :
```bash
npx tsc --noEmit && npm run lint
```
Expected : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/design/colors.ts web/lib/design/sports.ts
git commit -m "feat(design): couleurs sport de marque (vélo vert, natation bleu, orange #FF7900)"
```

---

## Task 5 : Validation finale & preview

**Files:** aucun (vérification + push).

- [ ] **Step 1 : Vérification globale**

Depuis `web/` :
```bash
npx tsc --noEmit && npm run lint
```
Expected : 0 erreur.

- [ ] **Step 2 : Pousser la branche (déclenche la preview Vercel)**

```bash
git push -u origin claude/design-deep-mission
```

- [ ] **Step 3 : QA visuelle (Franck, sur la preview Vercel)**

Checklist — **2 thèmes (sombre/clair) × 2 modes (Mission/Expert)** :
- [ ] Cockpit : titres de blocs en Space Grotesk, orange `#FF7900` (sombre), encre cohérente.
- [ ] Plan : titres/valeurs héro, lisibilité.
- [ ] Activités + détail activité : couleurs sport (course orange, vélo vert, natation bleu) correctes et lisibles.
- [ ] Charge : graphes lisibles après bascule des couleurs sport (pas de série illisible).
- [ ] Réglages : contrôles, bascule de mode.
- [ ] **Light** : orange `#C2410C` lisible (texte + boutons), pas de texte orange vif illisible.
- [ ] Interlignage global cohérent après passage à Inter (pas de débordement/chevauchement).

- [ ] **Step 4 : Mettre à jour la spec en « Implémenté »**

Dans `docs/superpowers/specs/2026-06-05-design-deep-mission-migration-design.md`, remplacer le bandeau `Status: Spec` par :
```md
> **Status: Implémenté** · 2026-06-05 · Code: web/app/globals.css, web/tailwind.config.ts, web/lib/design/{colors,sports}.ts
```
Puis :
```bash
git add docs/superpowers/specs/2026-06-05-design-deep-mission-migration-design.md
git commit -m "docs(spec): Deep Mission migration implémentée"
git push
```

---

## Auto-revue (couverture spec)

- **Stratégie remap** → Task 2. ✓
- **Fondation rapportée** → Task 1 (checkout + tokens + tailwind + fonts). ✓
- **Remap dark + light** → Task 2 (steps 1 & 2). ✓
- **Arbitrage contraste orange light `#C2410C`** → Task 2 step 2 + Task 4 (light orange). ✓
- **Typo Inter global + Space Grotesk signature/titres** → Task 3. ✓
- **Couleurs sport de marque (champs dédiés, séries génériques intactes, vérif usages)** → Task 4. ✓
- **Validation tsc/lint + QA Vercel 2 thèmes × 2 modes** → Task 5. ✓
- **Ne rapporter que les fichiers de fondation (pas les divergences de la branche d'audit)** → Task 1 step 1 (liste explicite de paths). ✓
