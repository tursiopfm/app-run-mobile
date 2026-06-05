'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import {
  Sun, Moon, ArrowRight, ChevronDown, Footprints, Mountain,
  Activity, Sparkles, CheckCircle2,
} from 'lucide-react'
import { LogoTrailCockpit } from '@/components/brand/LogoTrailCockpit'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// PREVIEW — Cockpit « Mode Mission » (/cockpit-mission-preview)
// Teste l'identité Trail Cockpit sur le cœur produit, en mode épuré.
// Données 100 % mockées. N'altère ni le dashboard, ni les calculs, ni BlockGrid.
// Répond en 5 s : ma mission · où j'en suis · quoi faire aujourd'hui ·
// forme/fatigue · prochaine action.
// ─────────────────────────────────────────────────────────────────────────

// ── Données simulées ────────────────────────────────────────────────────
const MISSION = { race: 'Ultra Marin', distance: '175 km', dplus: '2 400 m D+', jMinus: 22, prep: 72 }
const TODAY = {
  type: 'Footing endurance',
  duration: '50 min',
  goal: 'Construire la base aérobie',
  state: 'ready' as 'ready' | 'prudent' | 'repos',
}
const READINESS = { score: 78 }
const PROGRESSION = [
  { label: 'Volume', value: '52', unit: 'km', sub: 'cette semaine' },
  { label: 'D+', value: '1 240', unit: 'm', sub: 'cette semaine' },
  { label: 'Charge', value: 'Optimale', unit: '', sub: '7 j' },
]
const SIGNAL = 'Ta charge monte vite depuis 10 jours. Garde une sortie facile demain pour absorber.'
const EXPERT = [
  { k: 'ATL', label: 'Fatigue', v: 64 },
  { k: 'CTL', label: 'Forme', v: 58 },
  { k: 'TSB', label: 'Fraîcheur', v: '+6' },
]
const TREND = [42, 45, 44, 48, 52, 50, 55, 58, 57, 60, 64]

const TODAY_STATE = {
  ready:   { badge: 'success' as const, label: 'Prêt',          line: 'Tu peux t’entraîner normalement.' },
  prudent: { badge: 'warning' as const, label: 'Prudent',       line: 'Réduis l’intensité aujourd’hui.' },
  repos:   { badge: 'danger' as const,  label: 'Repos conseillé', line: 'Privilégie le repos ou une sortie très facile.' },
}

// ── Anneau readiness (SVG pur) ──────────────────────────────────────────
function ReadinessRing({ value }: { value: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const off = c * (1 - value / 100)
  const color = value >= 70 ? 'var(--status-success)' : value >= 45 ? 'var(--status-warning)' : 'var(--status-danger)'
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx={40} cy={40} r={r} fill="none" stroke="var(--ink-600)" strokeWidth={7} />
        <circle
          cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-bold leading-none text-fg-primary">{value}</span>
        <span className="font-body text-[9px] uppercase tracking-wider text-fg-muted">/100</span>
      </div>
    </div>
  )
}

// ── Sparkline (SVG pur) ─────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const w = 100, h = 28
  const min = Math.min(...data), max = Math.max(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full" style={{ color: 'var(--primary)' }} aria-hidden>
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function MissionSection({ children, title }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted mb-2 px-1">{title}</h2>}
      {children}
    </section>
  )
}

export function CockpitMissionPreview() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [expert, setExpert] = useState(false)
  const st = TODAY_STATE[TODAY.state]

  return (
    <main className="min-h-screen bg-ink-900 text-fg-primary">
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-5">

        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <LogoTrailCockpit variant="horizontal" tone="brand" size={28} />
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Basculer le thème"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 border border-ink-600 text-fg-muted hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {mounted && theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </header>
        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          <Badge variant="primary" size="sm">Mode Mission</Badge>
          <span className="flex items-center gap-1.5 font-body text-[11px] text-fg-muted">
            <CheckCircle2 size={12} className="text-status-success" />
            Synchronisé · 08:42
          </span>
        </div>

        <div className="mt-5 space-y-5">

          {/* Hero Mission */}
          <Card level="highlight" className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-[0.18]">
              <TrajectoryLine orientation="horizontal" progress={MISSION.prep / 100} glow={false} animated />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-text">Ma mission</span>
                <Badge variant="primary" size="sm">J-{MISSION.jMinus}</Badge>
              </div>
              <h1 className="font-display text-[30px] font-bold leading-none tracking-tight text-fg-primary mt-2">{MISSION.race}</h1>
              <p className="font-body text-[13px] text-fg-secondary mt-1.5 flex items-center gap-2">
                <Mountain size={14} className="text-primary" /> {MISSION.distance} · {MISSION.dplus}
              </p>

              <div className="mt-4">
                <div className="flex items-end justify-between mb-1.5">
                  <span className="font-body text-[12px] text-fg-muted">Préparation</span>
                  <span className="font-display text-[15px] font-bold text-fg-primary">{MISSION.prep}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-600">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${MISSION.prep}%` }} />
                </div>
              </div>

              <Button className="mt-5" fullWidth trailingIcon={<ArrowRight size={16} />}>Voir le plan</Button>
            </div>
          </Card>

          {/* Aujourd'hui */}
          <MissionSection title="Aujourd’hui">
            <Card>
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--data-run) 16%, transparent)', color: 'var(--data-run)' }}>
                  <Footprints size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-[16px] font-semibold tracking-tight text-fg-primary">{TODAY.type}</p>
                    <Badge variant={st.badge} size="sm" dot>{st.label}</Badge>
                  </div>
                  <p className="font-body text-[13px] text-fg-secondary mt-0.5">{TODAY.duration} · {TODAY.goal}</p>
                  <p className="font-body text-[12px] text-fg-muted mt-2">{st.line}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="mt-3" fullWidth trailingIcon={<ArrowRight size={15} />}>Démarrer la séance</Button>
            </Card>
          </MissionSection>

          {/* Readiness */}
          <MissionSection title="Ma forme">
            <Card>
              <div className="flex items-center gap-4">
                <ReadinessRing value={READINESS.score} />
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Tu peux t’entraîner normalement</p>
                  <p className="font-body text-[12.5px] text-fg-muted mt-1 leading-relaxed">Bonne fraîcheur, fatigue maîtrisée. Garde le cap sur l’endurance.</p>
                </div>
              </div>
            </Card>
          </MissionSection>

          {/* Progression — 3 KPI */}
          <MissionSection title="Progression">
            <div className="grid grid-cols-3 gap-3">
              {PROGRESSION.map((k) => (
                <Card key={k.label} className="p-3 text-center min-w-0">
                  <p className="font-body text-[10px] uppercase tracking-wider text-fg-muted truncate">{k.label}</p>
                  <p className="font-display text-[17px] font-bold leading-none text-fg-primary mt-1.5 truncate">
                    {k.value}{k.unit && <span className="font-body text-[11px] font-normal text-fg-muted ml-0.5">{k.unit}</span>}
                  </p>
                  <p className="font-body text-[10px] text-fg-muted mt-1 truncate">{k.sub}</p>
                </Card>
              ))}
            </div>
          </MissionSection>

          {/* Signal IA */}
          <MissionSection title="Signal">
            <Card className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                <Sparkles size={18} />
              </span>
              <p className="font-body text-[13px] text-fg-secondary leading-relaxed">{SIGNAL}</p>
            </Card>
          </MissionSection>

          {/* Expert preview — replié */}
          <Card className="p-0 overflow-hidden">
            <button
              onClick={() => setExpert((v) => !v)}
              aria-expanded={expert}
              className="flex w-full items-center justify-between gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-xl"
            >
              <span className="flex items-center gap-2.5">
                <Activity size={16} className="text-fg-muted" />
                <span className="font-display text-[14px] font-semibold tracking-tight text-fg-primary">Voir les données avancées</span>
              </span>
              <ChevronDown size={18} className={cn('text-fg-muted transition-transform', expert && 'rotate-180')} />
            </button>
            {expert && (
              <div className="border-t border-ink-600 p-4 animate-[stepIn_240ms_ease-out]">
                <div className="grid grid-cols-3 gap-3">
                  {EXPERT.map((e) => (
                    <div key={e.k} className="rounded-lg bg-ink-800 border border-ink-600 p-2.5 text-center">
                      <p className="font-body text-[10px] uppercase tracking-wider text-fg-muted">{e.k}</p>
                      <p className="font-display text-[18px] font-bold text-fg-primary leading-none mt-1">{e.v}</p>
                      <p className="font-body text-[10px] text-fg-muted mt-0.5">{e.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <p className="font-body text-[11px] text-fg-muted mb-1">Charge — 11 derniers jours</p>
                  <Sparkline data={TREND} />
                </div>
                <p className="font-body text-[11px] text-fg-muted mt-3">Le détail complet vit dans le <span className="text-fg-secondary font-semibold">Mode Expert</span>.</p>
              </div>
            )}
          </Card>

          <p className="pt-1 text-center font-body text-[11px] text-fg-muted">
            Mode Mission — l’essentiel en 5 secondes · aperçu, données simulées
          </p>
        </div>
      </div>
    </main>
  )
}
