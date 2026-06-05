'use client'

import { useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import {
  ArrowRight, ArrowLeft, Check, Sun, Moon, RotateCcw,
  Mountain, Footprints, Bike, Waves, Medal,
  Activity, TrendingUp, Compass, BarChart3,
  Upload, Watch, Rocket,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// Onboarding « Mission Setup » — PREVIEW isolée (/onboarding-preview).
// N'altère PAS l'onboarding existant (/onboarding) ni aucun écran métier.
// Aucune persistance, aucun calcul : étude visuelle de la marque.
// Dark + light via les tokens du Design System.
// ─────────────────────────────────────────────────────────────────────────

type Option = { id: string; label: string; desc: string; icon: typeof Mountain; accent: string }

const DISCIPLINES: Option[] = [
  { id: 'trail',     label: 'Trail',     desc: 'Sentiers & dénivelé',     icon: Mountain,   accent: 'var(--data-run)' },
  { id: 'route',     label: 'Route',     desc: 'Running sur route',        icon: Footprints, accent: 'var(--data-run)' },
  { id: 'velo',      label: 'Vélo',      desc: 'Cyclisme & home-trainer',  icon: Bike,       accent: 'var(--data-bike)' },
  { id: 'triathlon', label: 'Triathlon', desc: 'Multi-discipline',         icon: Medal,      accent: 'var(--primary)' },
  { id: 'natation',  label: 'Natation',  desc: 'Bassin & eau libre',       icon: Waves,      accent: 'var(--data-swim)' },
]

const MISSIONS: Option[] = [
  { id: 'trail',    label: 'Préparer un trail',             desc: 'Objectif daté, plan progressif', icon: Mountain,    accent: 'var(--data-run)' },
  { id: 'marathon', label: 'Préparer un marathon',          desc: 'Route, allure cible',            icon: Footprints,  accent: 'var(--data-run)' },
  { id: 'charge',   label: 'Suivre ma charge',              desc: 'Fatigue, fraîcheur, forme',      icon: Activity,    accent: 'var(--data-charge)' },
  { id: 'libre',    label: 'Progresser sans objectif précis', desc: 'Rester régulier, voir ses tendances', icon: TrendingUp, accent: 'var(--data-bike)' },
]

const MODES: (Option & { points: string[] })[] = [
  { id: 'mission', label: 'Mode Mission', desc: 'Simple, lisible, guidé.',  icon: Compass,   accent: 'var(--primary)',   points: ['Vue épurée', 'Une mission à la fois', 'Conseils guidés'] },
  { id: 'expert',  label: 'Mode Expert',  desc: 'Données complètes.',        icon: BarChart3, accent: 'var(--data-bike)', points: ['Charge & fatigue', 'Graphiques avancés', 'Cockpit complet'] },
]

const TOTAL = 5

function ringStyle(accent: string, extra?: CSSProperties): CSSProperties {
  return { ['--tw-ring-color' as string]: accent, ...extra } as CSSProperties
}

// Tuile sélectionnable, focusable clavier (a11y), colorée par l'accent du sport.
function SelectTile({
  selected, accent, icon: Icon, title, desc, onClick, compact,
}: {
  selected: boolean; accent: string; icon: typeof Mountain
  title: string; desc?: string; onClick: () => void; compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative w-full text-left rounded-xl border bg-ink-700 p-4 cursor-pointer',
        'transition-[border-color,transform,box-shadow] duration-150',
        'hover:-translate-y-0.5 active:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        selected ? 'border-transparent' : 'border-ink-600 hover:border-ink-500',
      )}
      style={
        selected
          ? ringStyle(accent, { borderColor: accent, boxShadow: `0 0 0 1px ${accent}, 0 10px 28px -16px ${accent}` })
          : ringStyle(accent)
      }
    >
      <div className={cn('flex items-center gap-3.5', compact && 'gap-3')}>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
        >
          <Icon size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">{title}</p>
          {desc && <p className="font-body text-[12.5px] text-fg-muted leading-snug mt-0.5">{desc}</p>}
        </div>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-opacity',
            selected ? 'opacity-100' : 'opacity-0',
          )}
          style={{ backgroundColor: accent, borderColor: accent }}
        >
          <Check size={13} className="text-ink-900" strokeWidth={3} />
        </span>
      </div>
    </button>
  )
}

function StepShell({ eyebrow, title, subtitle, children, stepKey }: {
  eyebrow: string; title: string; subtitle?: ReactNode; children: ReactNode; stepKey: number
}) {
  return (
    <div key={stepKey} className="animate-[stepIn_320ms_cubic-bezier(0.32,0.72,0,1)]">
      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-text">{eyebrow}</p>
      <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-fg-primary mt-1.5">{title}</h2>
      {subtitle && <p className="font-body text-[14px] text-fg-muted leading-relaxed mt-2">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function MissionSetupFlow() {
  const { theme, setTheme } = useTheme()
  // next-themes ne connaît pas le thème au SSR → on garde l'icône du toggle
  // derrière `mounted` pour éviter un mismatch d'hydratation (Sun vs Moon).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [discipline, setDiscipline] = useState<string | null>(null)
  const [mission, setMission] = useState<string | null>(null)
  const [mode, setMode] = useState<string | null>(null)

  const canNext =
    step === 1 ? true :
    step === 2 ? !!discipline :
    step === 3 ? !!mission :
    step === 4 ? !!mode :
    true

  function reset() {
    setStep(1); setDone(false); setDiscipline(null); setMission(null); setMode(null)
  }

  const disciplineOpt = DISCIPLINES.find(d => d.id === discipline)
  const missionOpt = MISSIONS.find(m => m.id === mission)
  const modeOpt = MODES.find(m => m.id === mode)

  return (
    <main className="min-h-screen bg-ink-900 text-fg-primary flex flex-col">
      {/* Top bar : marque + progression + thème */}
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-[14px] font-bold tracking-widest uppercase">
            <span className="text-primary-text">Mission</span>
            <span className="text-fg-primary"> Setup</span>
          </span>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 border border-ink-600 text-fg-muted hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Basculer le thème"
          >
            {mounted && theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>

        {/* Progression — segments + signature trajectoire */}
        {!done && (
          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    i < step ? 'bg-primary' : 'bg-ink-600',
                  )}
                />
              ))}
            </div>
            <p className="font-body text-[11px] text-fg-muted mt-2">Étape {step} sur {TOTAL}</p>
          </div>
        )}
      </header>

      {/* Contenu */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-7">
        {done ? (
          <CompletionScreen
            discipline={disciplineOpt} mission={missionOpt} mode={modeOpt} onReset={reset}
          />
        ) : (
          <div className="flex-1">
            {step === 1 && (
              <StepShell
                stepKey={1}
                eyebrow="Bienvenue"
                title="Bienvenue dans Trail Cockpit"
                subtitle="Le centre de contrôle intelligent des sportifs d'endurance."
              >
                <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
                  <div className="h-28 w-full">
                    <TrajectoryLine orientation="horizontal" animated duration={1.8} />
                  </div>
                  <p className="font-display text-center text-[18px] font-semibold tracking-tight text-fg-primary mt-2">
                    Préparer. <span className="text-primary-text">Piloter.</span> Accomplir.
                  </p>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell stepKey={2} eyebrow="Discipline" title="Choisis ta discipline principale"
                subtitle="Elle colore ton cockpit. Tu pourras en ajouter d'autres ensuite.">
                <div className="grid gap-2.5">
                  {DISCIPLINES.map(d => (
                    <SelectTile key={d.id} icon={d.icon} title={d.label} desc={d.desc} accent={d.accent}
                      selected={discipline === d.id} onClick={() => setDiscipline(d.id)} />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell stepKey={3} eyebrow="Mission" title="Définis ta mission"
                subtitle="Quel est ton cap pour les prochaines semaines ?">
                <div className="grid gap-2.5">
                  {MISSIONS.map(m => (
                    <SelectTile key={m.id} icon={m.icon} title={m.label} desc={m.desc} accent={m.accent}
                      selected={mission === m.id} onClick={() => setMission(m.id)} />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell stepKey={4} eyebrow="Mode" title="Choisis ton mode"
                subtitle="Tu pourras basculer à tout moment.">
                <div className="grid gap-3">
                  {MODES.map(m => {
                    const selected = mode === m.id
                    const Icon = m.icon
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        aria-pressed={selected}
                        className={cn(
                          'w-full text-left rounded-xl border bg-ink-700 p-4 cursor-pointer',
                          'transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
                          selected ? 'border-transparent' : 'border-ink-600 hover:border-ink-500',
                        )}
                        style={selected
                          ? ringStyle(m.accent, { borderColor: m.accent, boxShadow: `0 0 0 1px ${m.accent}, 0 10px 28px -16px ${m.accent}` })
                          : ringStyle(m.accent)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `color-mix(in srgb, ${m.accent} 16%, transparent)`, color: m.accent }}>
                            <Icon size={22} />
                          </span>
                          <div className="flex-1">
                            <p className="font-display text-[16px] font-semibold tracking-tight text-fg-primary">{m.label}</p>
                            <p className="font-body text-[12.5px] text-fg-muted">{m.desc}</p>
                          </div>
                          {selected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: m.accent }}>
                              <Check size={13} className="text-ink-900" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5 pl-14">
                          {m.points.map(p => (
                            <span key={p} className="font-body text-[11px] text-fg-secondary rounded-full bg-ink-600/70 px-2 py-0.5">{p}</span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell stepKey={5} eyebrow="Données" title="Connecte tes données"
                subtitle="Synchronise tes activités pour activer le cockpit.">
                <div className="grid gap-2.5">
                  <a
                    href="/api/strava/connect?from=onboarding"
                    className="group flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(252,76,2,0.15)', color: '#FC4C02' }}>
                      <Activity size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Strava</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Recommandé · flux existant préservé</p>
                    </div>
                    <ArrowRight size={18} className="text-fg-muted group-hover:text-fg-primary" />
                  </a>

                  <div className="flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 opacity-60">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-600 text-fg-muted">
                      <Watch size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Garmin</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Bientôt disponible</p>
                    </div>
                    <Badge variant="neutral" size="sm">Bientôt</Badge>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 hover:-translate-y-0.5 transition-transform text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-600 text-fg-secondary">
                      <Upload size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Import manuel</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Fichiers GPX / FIT</p>
                    </div>
                  </button>
                </div>
                <p className="font-body text-[11px] text-fg-muted mt-4 text-center">
                  Aperçu — aucune donnée n’est enregistrée dans cette démo.
                </p>
              </StepShell>
            )}
          </div>
        )}

        {/* Navigation */}
        {!done && (
          <nav className="mt-7 flex items-center gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} leadingIcon={<ArrowLeft size={16} />}>
                Retour
              </Button>
            )}
            <div className="flex-1" />
            {step < TOTAL ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext} trailingIcon={<ArrowRight size={16} />}>
                Continuer
              </Button>
            ) : (
              <Button onClick={() => setDone(true)} leadingIcon={<Rocket size={16} />}>
                Lancer le cockpit
              </Button>
            )}
          </nav>
        )}
      </div>
    </main>
  )
}

function CompletionScreen({ discipline, mission, mode, onReset }: {
  discipline?: Option; mission?: Option; mode?: Option; onReset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-[stepIn_320ms_cubic-bezier(0.32,0.72,0,1)]">
      <div className="h-20 w-full max-w-[220px]">
        {/* Mission accomplie → chemin entièrement plein, drapeau atteint. */}
        <TrajectoryLine orientation="horizontal" animated duration={1.4} progress={1} />
      </div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mt-2">
        <Check size={26} strokeWidth={3} />
      </span>
      <h2 className="font-display text-[24px] font-bold tracking-tight text-fg-primary mt-4">Mission prête</h2>
      <p className="font-body text-[14px] text-fg-muted mt-1.5 max-w-xs">
        Ton cockpit est configuré. Préparer. Piloter. Accomplir.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {discipline && <Badge color={discipline.accent} dot>{discipline.label}</Badge>}
        {mission && <Badge variant="charge" dot>{mission.label}</Badge>}
        {mode && <Badge color={mode.accent} dot>{mode.label}</Badge>}
      </div>

      <div className="mt-7 w-full">
        <Button fullWidth variant="secondary" onClick={onReset} leadingIcon={<RotateCcw size={16} />}>
          Relancer la démo
        </Button>
      </div>
    </div>
  )
}
