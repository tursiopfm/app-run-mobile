'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Rocket, Flag, ArrowRight, Bike, Footprints, Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { LogoTrailCockpit, LogoMark } from '@/components/brand/LogoTrailCockpit'
import { OgCard } from '@/components/brand/OgCard'

/* eslint-disable @next/next/no-img-element */

// Page interne de validation de la marque — /design-system
// Présente palette, typographies, boutons, badges, cartes, sheets et la
// TrajectoryLine. Sert à valider la fondation AVANT toute refonte des écrans.
// Aucune logique métier, aucun calcul.

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-trail-muted mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

const INK = [
  ['ink-900', 'bg-ink-900', 'Fond app'],
  ['ink-800', 'bg-ink-800', 'Surface'],
  ['ink-700', 'bg-ink-700', 'Carte'],
  ['ink-600', 'bg-ink-600', 'Bordure'],
  ['ink-500', 'bg-ink-500', 'Bordure +'],
] as const

const BRAND = [
  ['primary', 'bg-primary', 'Branding'],
  ['primary-dim', 'bg-primary-dim', 'Branding —'],
] as const

const DATA = [
  ['data-charge', 'bg-data-charge', 'Charge'],
  ['data-run', 'bg-data-run', 'Course'],
  ['data-bike', 'bg-data-bike', 'Vélo'],
  ['data-swim', 'bg-data-swim', 'Natation'],
] as const

function Swatch({ token, bg, label }: { token: string; bg: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${bg} h-16 rounded-xl border border-ink-600`} />
      <div className="font-body">
        <p className="text-[12px] font-semibold text-trail-text">{label}</p>
        <p className="text-[11px] text-trail-muted">{token}</p>
      </div>
    </div>
  )
}

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  return (
    <main className="min-h-screen bg-ink-900 text-trail-text">
      <div className="mx-auto max-w-3xl px-5 py-10 space-y-14">

        {/* Header */}
        <header className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-[12px] font-medium uppercase tracking-[0.2em] text-primary">
                Brand Foundation
              </p>
              <h1 className="font-display text-[34px] font-bold leading-none tracking-tight mt-1">
                <span className="text-primary">Trail</span> Cockpit
              </h1>
              <p className="font-body text-[14px] text-trail-muted mt-2">
                Préparer. Piloter. Accomplir.
              </p>
            </div>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700 border border-ink-600 text-trail-muted hover:text-trail-text"
              aria-label="Basculer le thème"
            >
              {mounted && theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          <div className="h-12 w-full">
            <TrajectoryLine orientation="horizontal" />
          </div>
        </header>

        {/* Logo */}
        <Section id="logo" title="Logo — Identité de marque">
          <div className="space-y-4">
            {/* Variantes principales sur deux fonds (test dark + light) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-ink-600 p-6 flex flex-col items-center gap-6" style={{ background: '#0B0F14', color: '#E2ECE9' }}>
                <LogoTrailCockpit variant="horizontal" tone="brand" size={44} />
                <LogoTrailCockpit variant="stacked" tone="brand" size={56} />
                <p className="font-body text-[11px]" style={{ color: '#8BA8A3' }}>sur fond sombre</p>
              </div>
              <div className="rounded-xl border border-ink-600 p-6 flex flex-col items-center gap-6" style={{ background: '#F4F7F6' }}>
                <div style={{ color: '#13201D' }}>
                  <LogoTrailCockpit variant="horizontal" tone="brand" size={44} />
                </div>
                <div style={{ color: '#13201D' }}>
                  <LogoTrailCockpit variant="stacked" tone="brand" size={56} />
                </div>
                <p className="font-body text-[11px]" style={{ color: '#5F7771' }}>sur fond clair</p>
              </div>
            </div>

            {/* Icon-only : tons + tailles (jusqu'au favicon) */}
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-6">
              <p className="font-body text-[12px] text-trail-muted mb-4">Icon-only — jusqu’à la taille favicon</p>
              <div className="flex flex-wrap items-end gap-6">
                <LogoMark size={64} />
                <LogoMark size={40} />
                <LogoMark size={24} />
                <LogoMark size={16} />
              </div>
            </div>

            {/* Zone de sécurité */}
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-6">
              <p className="font-body text-[12px] text-trail-muted mb-4">Zone de sécurité (≈ ½ pastille autour du logo)</p>
              <div className="inline-block rounded-lg" style={{ outline: '1px dashed var(--ink-500)', padding: 22 }}>
                <LogoTrailCockpit variant="horizontal" tone="brand" size={44} />
              </div>
            </div>
          </div>
        </Section>

        {/* App Icon — logo raster unique */}
        <Section id="appicon" title="App Icon — logo (lisibilité par taille)">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-6">
            <p className="font-body text-[12px] text-trail-muted mb-4">
              Logo unique (raster, généré depuis <code className="text-trail-text">brand-source/logo-master.png</code>) — du favicon à l’app icon.
            </p>
            <div className="flex flex-wrap items-end gap-5">
              {[16, 24, 32, 64, 104, 128].map((s) => (
                <div key={s} className="flex flex-col items-center gap-1.5">
                  <img src="/icons/icon-512.png" width={s} height={s} alt={`logo ${s}px`} />
                  <span className="font-body text-[11px] text-trail-muted">{s}px</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Pack exporté (PNG réels depuis /brand-preview) */}
        <Section id="pack" title="Pack exporté — favicon · PWA · Apple">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-6 space-y-6">
            <div>
              <p className="font-body text-[12px] text-trail-muted mb-3">Favicon (tailles réelles)</p>
              <div className="flex items-end gap-6">
                {[16, 32, 48].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/brand-preview/favicon-${s}.png`} width={s} height={s} alt={`favicon ${s}`} />
                    <span className="font-body text-[11px] text-trail-muted">{s}px</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              {([
                ['icon-192.png', 96, 'PWA any 192'],
                ['icon-512.png', 96, 'PWA any 512'],
                ['maskable-512.png', 96, 'PWA maskable'],
                ['apple-touch-icon.png', 90, 'Apple 180'],
              ] as const).map(([file, w, label]) => (
                <div key={file} className="flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand-preview/${file}`} width={w} height={w} alt={label} className="rounded-2xl" />
                  <span className="font-body text-[11px] text-trail-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="font-body text-[12px] text-trail-muted">
              Pack généré depuis <code className="text-trail-text">brand-source/logo-master.png</code> via <code className="text-trail-text">npm run gen:brand-assets</code>. Détail dans <code className="text-trail-text">/brand-preview/README.md</code>.
            </p>
          </div>
        </Section>

        {/* Splash — concept */}
        <Section id="splash" title="Splash — concept">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-6 flex justify-center">
            <div className="flex flex-col items-center justify-center rounded-[34px] border border-ink-600" style={{ width: 300, height: 540, background: '#0B0F14' }}>
              <img src="/icons/icon-512.png" width={72} height={72} alt="Trail Cockpit" style={{ borderRadius: 21 }} />
              <span className="wordmark font-display mt-3.5 text-[17px] font-bold uppercase tracking-[0.12em]">
                <span className="text-primary">Trail</span> Cockpit
              </span>
              <span className="font-display text-trail-muted text-[13px] mt-7">Préparer. Piloter. Accomplir.</span>
            </div>
          </div>
        </Section>

        {/* Palette */}
        <Section id="palette" title="Palette — Deep Mission">
          <div className="space-y-6">
            <div>
              <p className="font-body text-[12px] text-trail-muted mb-2">Encre (multi-sport, neutre)</p>
              <div className="grid grid-cols-5 gap-3">
                {INK.map(([t, bg, l]) => <Swatch key={t} token={t} bg={bg} label={l} />)}
              </div>
            </div>
            <div>
              <p className="font-body text-[12px] text-trail-muted mb-2">Branding (jamais piloté par la donnée)</p>
              <div className="grid grid-cols-5 gap-3">
                {BRAND.map(([t, bg, l]) => <Swatch key={t} token={t} bg={bg} label={l} />)}
              </div>
            </div>
            <div>
              <p className="font-body text-[12px] text-trail-muted mb-2">Données (sémantique sport, découplée)</p>
              <div className="grid grid-cols-4 gap-3">
                {DATA.map(([t, bg, l]) => <Swatch key={t} token={t} bg={bg} label={l} />)}
              </div>
            </div>
          </div>
        </Section>

        {/* Typographies */}
        <Section id="type" title="Typographies">
          <div className="space-y-5">
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
              <p className="font-body text-[11px] uppercase tracking-widest text-trail-muted mb-2">
                Space Grotesk — Titres / valeurs
              </p>
              <p className="font-display text-[32px] font-bold tracking-tight leading-none">J-42 · UTMB</p>
              <p className="font-display text-[20px] font-semibold tracking-tight mt-2 text-trail-muted">
                Readiness 78%
              </p>
            </div>
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
              <p className="font-body text-[11px] uppercase tracking-widest text-trail-muted mb-2">
                Inter — Texte courant
              </p>
              <p className="font-body text-[14px] leading-relaxed text-trail-text">
                Trail Cockpit transforme chaque objectif en mission préparée, pilotée, accomplie.
                Le centre de contrôle des sportifs d’endurance.
              </p>
            </div>
            {/* Échelle officielle — tokens Tailwind (text-display … text-micro).
                Règle 14 vs 13 : voir docs/reference/TYPOGRAPHIE.md */}
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
              <p className="font-body text-micro uppercase tracking-widest text-trail-muted mb-3">
                Échelle typographique
              </p>
              <div className="space-y-2">
                <p className="font-display text-display leading-none">Display · 28 <span className="font-body text-micro text-trail-muted">text-display</span></p>
                <p className="font-display text-h1 leading-none">Titre H1 · 22 <span className="font-body text-micro text-trail-muted">text-h1</span></p>
                <p className="font-display text-h2 leading-none">Titre H2 · 18 <span className="font-body text-micro text-trail-muted">text-h2</span></p>
                <p className="font-body text-body">Body · 14 — nouveaux écrans <span className="text-micro text-trail-muted">text-body</span></p>
                <p className="font-body text-body-sm text-trail-text">Body Small · 13 — écrans denses <span className="text-micro text-trail-muted">text-body-sm</span></p>
                <p className="font-body text-caption text-trail-muted">Caption · 12 <span className="text-micro">text-caption</span></p>
                <p className="font-body text-micro text-trail-muted">Micro · 11 · text-micro</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Boutons */}
        <Section id="buttons" title="Boutons">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" leadingIcon={<Rocket size={16} />}>Lancer la mission</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Supprimer</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md" trailingIcon={<ArrowRight size={16} />}>Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Désactivé</Button>
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section id="badges" title="Badges">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="primary">Mission</Badge>
            <Badge variant="success" dot>En forme</Badge>
            <Badge variant="warning">Fatigue</Badge>
            <Badge variant="danger">Surcharge</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="neutral">Neutre</Badge>
            <Badge variant="run" dot>Course</Badge>
            <Badge variant="bike" dot>Vélo</Badge>
            <Badge variant="swim" dot>Natation</Badge>
            <Badge variant="charge" dot>Charge</Badge>
            <Badge color="#A855F7" dot>Custom (hex)</Badge>
          </div>
        </Section>

        {/* Cartes */}
        <Section id="cards" title="Cartes">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card level="surface">
              <CardTitle>Surface</CardTitle>
              <CardContent className="mt-1">Conteneur discret de fond.</CardContent>
            </Card>
            <Card level="card" interactive>
              <CardTitle>Card</CardTitle>
              <CardContent className="mt-1">Carte standard interactive.</CardContent>
            </Card>
            <Card level="highlight">
              <CardTitle>Highlight</CardTitle>
              <CardContent className="mt-1">Carte « mission » accentuée.</CardContent>
            </Card>
          </div>

          <Card level="card" className="mt-4">
            <CardHeader>
              <CardTitle>Prochaine mission</CardTitle>
              <Badge variant="primary">J-42</Badge>
            </CardHeader>
            <CardContent>
              UTMB — 171 km · 10 000 m D+. Préparation en phase de développement.
            </CardContent>
            <CardFooter>
              <Button size="sm" trailingIcon={<ArrowRight size={15} />}>Voir le plan</Button>
              <Badge variant="charge" dot size="sm">Charge optimale</Badge>
            </CardFooter>
          </Card>
        </Section>

        {/* Sheet */}
        <Section id="sheet" title="Sheet">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Ouvrir une sheet
          </Button>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Détails de la mission">
            <div className="font-body text-[13px] text-trail-muted leading-relaxed space-y-3">
              <p>
                Bottom-sheet unifié du Design System. Ferme au clic sur le fond, à la
                touche Échap, ou via la croix. Verrouille le scroll du body.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="run" dot>Course</Badge>
                <Badge variant="bike" dot>Vélo</Badge>
                <Badge variant="swim" dot>Natation</Badge>
              </div>
              <Button fullWidth onClick={() => setSheetOpen(false)}>Compris</Button>
            </div>
          </Sheet>
        </Section>

        {/* TrajectoryLine */}
        <Section id="trajectory" title="Trajectory Line — signature">
          <div className="space-y-4">
            <Card level="card">
              <div className="flex items-center justify-between mb-3">
                <CardTitle>Horizontale</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setAnimKey(k => k + 1)}>
                  Rejouer l’animation
                </Button>
              </div>
              <div className="space-y-5">
                <div className="h-14">
                  <p className="font-body text-[11px] text-trail-muted mb-1">Statique</p>
                  <TrajectoryLine orientation="horizontal" />
                </div>
                <div className="h-14">
                  <p className="font-body text-[11px] text-trail-muted mb-1">Animée (se dessine)</p>
                  <TrajectoryLine key={animKey} orientation="horizontal" animated />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card level="card">
                <CardTitle>Verticale</CardTitle>
                <div className="mx-auto mt-3 h-44 w-10">
                  <TrajectoryLine orientation="vertical" />
                </div>
              </Card>
              <Card level="card">
                <CardTitle>Verticale animée</CardTitle>
                <div className="mx-auto mt-3 h-44 w-10">
                  <TrajectoryLine key={animKey + 1000} orientation="vertical" animated />
                </div>
              </Card>
            </div>

            <Card level="highlight">
              <div className="flex items-center gap-2 mb-3">
                <Flag size={16} className="text-primary" />
                <CardTitle>Usage « mission » — timeline</CardTitle>
              </div>
              <div className="flex items-center gap-4">
                <Footprints size={18} className="shrink-0 text-data-run" />
                <div className="h-8 flex-1">
                  <TrajectoryLine orientation="horizontal" endpoint={false} track />
                </div>
                <Bike size={18} className="shrink-0 text-data-bike" />
                <div className="h-8 flex-1">
                  <TrajectoryLine orientation="horizontal" endpoint={false} track />
                </div>
                <Waves size={18} className="shrink-0 text-data-swim" />
                <div className="h-8 flex-1">
                  <TrajectoryLine orientation="horizontal" />
                </div>
                <Flag size={18} className="shrink-0 text-primary" />
              </div>
            </Card>
          </div>
        </Section>

        {/* Open Graph */}
        <Section id="og" title="Open Graph — concept (1200×630)">
          <div className="overflow-auto rounded-xl border border-ink-600">
            <OgCard />
          </div>
        </Section>

        <footer className="border-t border-ink-600 pt-6 font-body text-[12px] text-trail-muted">
          Fondation de marque — aucune logique métier. Valider ici avant toute refonte des écrans.
        </footer>
      </div>
    </main>
  )
}
