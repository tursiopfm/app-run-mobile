# Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le thème Clair + Système dans Trail Cockpit PWA via next-themes, CSS variables et Tailwind tokens dynamiques.

**Architecture:** `next-themes` applique une classe `light` sur `<html>`, les CSS variables dans `globals.css` définissent les deux palettes, et les tokens Tailwind référencent ces variables — tous les composants utilisant des classes Tailwind s'adaptent automatiquement. Les composants canvas/charts utiliseront un hook `useColors()` distinct.

**Tech Stack:** Next.js 14 (App Router), next-themes, Tailwind CSS, TypeScript

> **Répertoire de travail :** toutes les commandes `npm`/`npx` s'exécutent depuis `web/`. Les commandes `git` s'exécutent depuis la racine du repo (`app-run-mobile/`).

---

## Fichiers touchés

| Action | Fichier |
|--------|---------|
| Modifier | `web/package.json` |
| Créer | `web/components/providers/ThemeProvider.tsx` |
| Modifier | `web/app/layout.tsx` |
| Modifier | `web/app/globals.css` |
| Modifier | `web/tailwind.config.ts` |
| Créer | `web/lib/design/useColors.ts` |
| Modifier | `web/components/settings/AppearanceSection.tsx` |

---

## Task 1 : Installer next-themes

**Files:**
- Modify: `web/package.json` (via npm)

- [ ] **Step 1.1 : Installer la dépendance**

```bash
cd web && npm install next-themes
```

Expected output : `added 1 package` (ou similaire), aucune erreur.

- [ ] **Step 1.2 : Vérifier l'ajout dans package.json**

```bash
grep "next-themes" web/package.json
```

Expected : `"next-themes": "^X.X.X"` présent dans `dependencies`.

- [ ] **Step 1.3 : Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: add next-themes dependency"
```

---

## Task 2 : CSS Variables dans globals.css

**Files:**
- Modify: `web/app/globals.css`

Remplacer le contenu entier du fichier par :

- [ ] **Step 2.1 : Mettre à jour globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Palette Sombre (défaut) ─────────────────────────── */
:root {
  --trail-bg:               #0A0F0E;
  --trail-surface:          #111A18;
  --trail-card:             #162420;
  --trail-border:           #1E3530;
  --trail-header:           #101917;
  --trail-muted:            #8BA8A3;
  --trail-text:             #E2ECE9;
  --trail-primary:          #FF6B35;
  --trail-primary-dim:      #CC5528;
  --trail-accent:           #38BDF8;
  --trail-success:          #4ADE80;
  --trail-warning:          #FBBF24;
  --trail-danger:           #F87171;
  --trail-pale-green:       #0A2E1E;
  --trail-pie-cotes:        #8B5CF6;
  --trail-pie-footing:      #F59E0B;
  --trail-pie-autre:        #6B8A85;
  --trail-progress-run-bg:    #243530;
  --trail-progress-volume-bg: #13211E;
  --trail-progress-dplus-bg:  #11232A;
}

/* ── Palette Claire ──────────────────────────────────── */
.light {
  --trail-bg:               #F4F7F6;
  --trail-surface:          #FFFFFF;
  --trail-card:             #FFFFFF;
  --trail-border:           #D6E1DD;
  --trail-header:           #E8F0ED;
  --trail-muted:            #5F7771;
  --trail-text:             #13201D;
  --trail-primary:          #E6612B;
  --trail-primary-dim:      #CC5226;
  --trail-accent:           #1D8FC6;
  --trail-success:          #138A52;
  --trail-warning:          #CC9200;
  --trail-danger:           #D94F45;
  --trail-pale-green:       #DFF5E8;
  --trail-pie-cotes:        #7C56C9;
  --trail-pie-footing:      #DF8E16;
  --trail-pie-autre:        #7B8E88;
  --trail-progress-run-bg:    #FBE2D8;
  --trail-progress-volume-bg: #DFF5E8;
  --trail-progress-dplus-bg:  #DCF0F7;
}

html, body {
  background-color: var(--trail-bg);
  color: var(--trail-text);
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
}

.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--trail-surface); }
::-webkit-scrollbar-thumb { background: var(--trail-border); border-radius: 2px; }
```

- [ ] **Step 2.2 : Commit**

```bash
git add web/app/globals.css
git commit -m "style: CSS variables pour thème sombre et clair"
```

---

## Task 3 : Mettre à jour tailwind.config.ts

**Files:**
- Modify: `web/tailwind.config.ts`

Remplacer le contenu entier par :

- [ ] **Step 3.1 : Mettre à jour tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        trail: {
          bg:           'var(--trail-bg)',
          surface:      'var(--trail-surface)',
          card:         'var(--trail-card)',
          border:       'var(--trail-border)',
          header:       'var(--trail-header)',
          muted:        'var(--trail-muted)',
          text:         'var(--trail-text)',
          primary:      'var(--trail-primary)',
          'primary-dim':'var(--trail-primary-dim)',
          accent:       'var(--trail-accent)',
          success:      'var(--trail-success)',
          warning:      'var(--trail-warning)',
          danger:       'var(--trail-danger)',
          'pale-green': 'var(--trail-pale-green)',
          'pie-cotes':       'var(--trail-pie-cotes)',
          'pie-footing':     'var(--trail-pie-footing)',
          'pie-autre':       'var(--trail-pie-autre)',
          'progress-run-bg':    'var(--trail-progress-run-bg)',
          'progress-volume-bg': 'var(--trail-progress-volume-bg)',
          'progress-dplus-bg':  'var(--trail-progress-dplus-bg)',
        },
      },
      fontSize: {
        '10':  ['10px', { lineHeight: '1.2' }],
        '11':  ['11px', { lineHeight: '1.3' }],
        '13':  ['13px', { lineHeight: '1.4' }],
        '14':  ['14px', { lineHeight: '1.4' }],
        '20':  ['20px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'kpi':   '4px',
        'chart': '6px',
        'bar':   '2px',
      },
      height: {
        'week-header': '28px',
        'week-body':   '26px',
        'bar-strip':   '26px',
        'progress':    '16px',
      },
      minHeight: {
        'chart':      '180px',
        'chart-area': '192px',
      },
      width: {
        'week-session': '90px',
        'week-day':     '92px',
        'week-total':   '70px',
        'pie-canvas':   '150px',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 3.2 : Vérifier que le build TypeScript passe**

```bash
cd web && npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 3.3 : Commit**

```bash
git add web/tailwind.config.ts
git commit -m "style: tailwind tokens référencent CSS variables"
```

---

## Task 4 : Créer ThemeProvider

**Files:**
- Create: `web/components/providers/ThemeProvider.tsx`

- [ ] **Step 4.1 : Créer le répertoire et le fichier**

```bash
mkdir -p web/components/providers
```

Créer `web/components/providers/ThemeProvider.tsx` :

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

- [ ] **Step 4.2 : Commit**

```bash
git add web/components/providers/ThemeProvider.tsx
git commit -m "feat: ThemeProvider wrapper next-themes"
```

---

## Task 5 : Mettre à jour layout.tsx

**Files:**
- Modify: `web/app/layout.tsx`

- [ ] **Step 5.1 : Mettre à jour layout.tsx**

Remplacer le contenu entier par :

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'Trail Cockpit',
  description: 'Your trail running dashboard',
  manifest: '/manifest.json',
  applicationName: 'Trail Cockpit',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Trail Cockpit',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-trail-bg text-trail-text min-h-screen">
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistrar />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5.2 : Vérifier que le build passe**

```bash
cd web && npm run build
```

Expected : build réussi, aucune erreur TS/lint.

- [ ] **Step 5.3 : Commit**

```bash
git add web/app/layout.tsx
git commit -m "feat: ThemeProvider dans layout + suppressHydrationWarning"
```

---

## Task 6 : Hook useColors()

**Files:**
- Create: `web/lib/design/useColors.ts`

- [ ] **Step 6.1 : Créer web/lib/design/useColors.ts**

```ts
'use client'

import { useTheme } from 'next-themes'
import { dark, light, type TrailPalette } from './colors'

export function useColors(): TrailPalette {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'light' ? light : dark
}
```

Note : `resolvedTheme` (pas `theme`) est utilisé pour résoudre correctement le mode `system` en `light` ou `dark` selon l'OS.

- [ ] **Step 6.2 : Commit**

```bash
git add web/lib/design/useColors.ts
git commit -m "feat: hook useColors() retourne palette active selon thème"
```

---

## Task 7 : Connecter AppearanceSection au thème réel

**Files:**
- Modify: `web/components/settings/AppearanceSection.tsx`

- [ ] **Step 7.1 : Remplacer le contenu entier du fichier**

```tsx
'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useColors } from '@/lib/design/useColors'
import { type TrailPalette } from '@/lib/design/colors'
import { settings as settingsLabels } from '@/lib/design/labels'

type ThemeOption = 'Dark' | 'Light' | 'System'
type Lang  = 'fr' | 'en' | 'system'

const THEME_OPTIONS: { value: ThemeOption; nextTheme: string; label: string }[] = [
  { value: 'Dark',   nextTheme: 'dark',   label: settingsLabels.themeDark },
  { value: 'Light',  nextTheme: 'light',  label: settingsLabels.themeLight },
  { value: 'System', nextTheme: 'system', label: settingsLabels.themeSystem },
]

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'fr',     label: settingsLabels.langFrench },
  { value: 'en',     label: settingsLabels.langEnglish },
  { value: 'system', label: settingsLabels.langSystem },
]

const THEME_DESC: Record<ThemeOption, string> = {
  Dark:   'Interface sombre optimisée pour la lecture en extérieur.',
  Light:  'Interface claire adaptée aux environnements bien éclairés.',
  System: "Suit automatiquement le réglage système de l'appareil.",
}

function ActionChip({
  label, active, onClick, colors,
}: {
  label: string; active: boolean; onClick: () => void; colors: TrailPalette
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-3 py-[6px] border text-[12px] font-semibold"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}2B` : colors.surface,
        borderColor:     active ? colors.chargeOrange : colors.border,
        color:           active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function SettingsRow({
  title, value, accent, colors,
}: {
  title: string; value: string; accent: string; colors: TrailPalette
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[12px]"
      style={{ padding: '10px 12px', backgroundColor: colors.surface }}
    >
      <span className="text-[14px] text-trail-muted">{title}</span>
      <span className="text-[14px] font-semibold" style={{ color: accent }}>{value}</span>
    </div>
  )
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const [lang, setLang] = useState<Lang>('fr')
  const colors = useColors()

  const activeOption = THEME_OPTIONS.find(o => o.nextTheme === theme) ?? THEME_OPTIONS[0]
  const selectedLang = LANG_OPTIONS.find(l => l.value === lang)!

  return (
    <>
      {/* Theme chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {THEME_OPTIONS.map(opt => (
          <ActionChip
            key={opt.value}
            label={opt.label}
            active={activeOption.value === opt.value}
            onClick={() => setTheme(opt.nextTheme)}
            colors={colors}
          />
        ))}
      </div>
      <p className="text-[11px] text-trail-muted leading-[16px] mt-[10px]">
        {THEME_DESC[activeOption.value]}
      </p>

      {/* Language row + chips */}
      <div className="mt-[14px] space-y-2">
        <SettingsRow
          title="Langue"
          value={selectedLang.label}
          accent={colors.seriesBlue}
          colors={colors}
        />
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {LANG_OPTIONS.map(opt => (
            <ActionChip
              key={opt.value}
              label={opt.label}
              active={lang === opt.value}
              onClick={() => setLang(opt.value)}
              colors={colors}
            />
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 7.2 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 7.3 : Commit**

```bash
git add web/components/settings/AppearanceSection.tsx
git commit -m "feat: AppearanceSection connectée à next-themes + useColors"
```

---

## Task 8 : Vérification manuelle

- [ ] **Step 8.1 : Lancer le serveur de développement**

```bash
cd web && npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

- [ ] **Step 8.2 : Vérifier le thème Clair**

1. Aller dans Réglages > Apparences
2. Cliquer "Clair"
3. Vérifier : fond `#F4F7F6`, texte `#13201D`, header `#E8F0ED`
4. Inspecter `<html>` dans DevTools → doit avoir `class="light"`

- [ ] **Step 8.3 : Vérifier la persistence**

1. Thème "Clair" sélectionné
2. Recharger la page (F5)
3. Vérifier : thème clair restauré immédiatement sans flash blanc

- [ ] **Step 8.4 : Vérifier le mode Système**

1. Cliquer "Système"
2. Dans DevTools → changer `prefers-color-scheme` (Rendering tab → Emulate CSS media feature)
3. Passer entre dark/light → l'app doit basculer automatiquement

- [ ] **Step 8.5 : Build de production**

```bash
cd web && npm run build
```

Expected : build réussi, aucun warning critique.

- [ ] **Step 8.6 : Commit final si fichiers non encore commités**

```bash
git status
# Si rien à commiter : toutes les tâches ont déjà été commitées individuellement, c'est bon.
```
