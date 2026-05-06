# Thème Clair — Trail Cockpit PWA

**Date:** 2026-05-06  
**Scope:** Implémentation complète du thème Clair + Système dans l'onglet Réglages > Apparences

---

## Contexte

L'app PWA Trail Cockpit propose déjà un sélecteur de thème (Sombre / Clair / Système) dans `AppearanceSection.tsx`, mais celui-ci n'est connecté à rien : état local uniquement, aucune persistence, aucun changement visuel. La palette `light` est déjà définie dans `lib/design/colors.ts`. L'objectif est de brancher ce sélecteur sur un vrai mécanisme de thème.

---

## Palette retenue

**Option A — Vert Trail** : palette `light` existante dans `colors.ts`.

| Token | Sombre | Clair |
|---|---|---|
| background | `#0A0F0E` | `#F4F7F6` |
| surface | `#111A18` | `#FFFFFF` |
| cardBg | `#162420` | `#FFFFFF` |
| border | `#1E3530` | `#D6E1DD` |
| headerBg | `#101917` | `#E8F0ED` |
| subtleText | `#8BA8A3` | `#5F7771` |
| text | `#E2ECE9` | `#13201D` |
| chargeOrange | `#FF6B35` | `#E6612B` |
| seriesBlue | `#38BDF8` | `#1D8FC6` |
| greenOk | `#4ADE80` | `#138A52` |

---

## Architecture

```
next-themes ThemeProvider (layout.tsx)
    ↓ applique class="light" sur <html>
CSS variables (globals.css)
    :root       → palette sombre (défaut, évite flash)
    .light      → palette claire
    ↓ référencées par
Tailwind tokens (tailwind.config.ts)
    trail-bg → var(--trail-bg)  etc.
    ↓ utilisés par
Composants JSX  → classes Tailwind, rendu automatique
Charts/Canvas   → useColors() hook → palette active
    ↓ piloté par
AppearanceSection → useTheme() de next-themes
    "Dark"    → setTheme("dark")
    "Light"   → setTheme("light")
    "Système" → setTheme("system")
```

- **Persistence** : `next-themes` écrit dans `localStorage` automatiquement.
- **Système** : détection via `prefers-color-scheme` media query, gérée par `next-themes`.
- **Anti-flash SSR** : `suppressHydrationWarning` sur `<html>`, script inline injecté par `next-themes`.

---

## Fichiers à modifier

### 1. `package.json`
Ajouter la dépendance `next-themes`.

### 2. `components/providers/ThemeProvider.tsx` *(nouveau)*
Wrapper `'use client'` qui expose `<NextThemesProvider>` avec `attribute="class"` et `defaultTheme="dark"`.

```tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
```

### 3. `app/layout.tsx`
- Importer et wrapper `<body>` avec `<ThemeProvider>`.
- Ajouter `suppressHydrationWarning` sur `<html>`.

### 4. `app/globals.css`
Remplacer les couleurs hardcodées par des CSS variables :

```css
:root {
  --trail-bg:      #0A0F0E;
  --trail-surface: #111A18;
  --trail-card:    #162420;
  --trail-border:  #1E3530;
  --trail-header:  #101917;
  --trail-muted:   #8BA8A3;
  --trail-text:    #E2ECE9;
  --trail-primary: #FF6B35;
  --trail-accent:  #38BDF8;
  --trail-success: #4ADE80;
  /* ... autres tokens ... */
}
.light {
  --trail-bg:      #F4F7F6;
  --trail-surface: #FFFFFF;
  --trail-card:    #FFFFFF;
  --trail-border:  #D6E1DD;
  --trail-header:  #E8F0ED;
  --trail-muted:   #5F7771;
  --trail-text:    #13201D;
  --trail-primary: #E6612B;
  --trail-accent:  #1D8FC6;
  --trail-success: #138A52;
  /* ... autres tokens ... */
}
```

### 5. `tailwind.config.ts`
Remplacer les valeurs hex par des références CSS variables :

```ts
trail: {
  bg:      'var(--trail-bg)',
  surface: 'var(--trail-surface)',
  card:    'var(--trail-card)',
  border:  'var(--trail-border)',
  // ...
}
```

### 6. `lib/design/colors.ts`
Ajouter un hook `useColors()` qui retourne la palette active pour les composants canvas/charts :

```ts
import { useTheme } from 'next-themes'
export function useColors(): TrailPalette {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'light' ? light : dark
}
```

`colors` (export par défaut) reste `dark` pour les usages statiques (configs Chart.js SSR-safe).

### 7. `components/settings/AppearanceSection.tsx`
- Remplacer `useState<Theme>` par `useTheme()` de next-themes.
- Mapper `'Dark' → 'dark'`, `'Light' → 'light'`, `'System' → 'system'`.
- La valeur initiale est lue depuis `useTheme().theme` (persist automatique).
- Remplacer l'import statique `colors` par `useColors()` pour que les inline styles (`ActionChip`, `SettingsRow`) s'adaptent au thème actif.

---

## Comportement attendu

| Action | Résultat |
|---|---|
| Sélectionner "Clair" | `<html class="light">` → palette claire instantanée |
| Sélectionner "Sombre" | `<html class="dark">` → palette sombre |
| Sélectionner "Système" | Suit `prefers-color-scheme` de l'OS |
| Recharger l'app | Thème restauré depuis `localStorage` sans flash |
| OS passe en sombre (mode Système) | App bascule automatiquement |

---

## Hors scope

- Composants charts/canvas existants : ils continuent d'utiliser `colors` (dark) jusqu'à migration individuelle vers `useColors()`. Le thème clair sera correct pour tout le rendu Tailwind/CSS ; seules les couleurs internes des graphiques resteront en palette sombre le temps de la migration.
- Thèmes personnalisés (déjà listé dans "À venir" dans les Réglages).
