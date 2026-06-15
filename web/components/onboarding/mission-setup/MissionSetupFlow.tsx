'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, Check,
  Mountain, Footprints, Bike, Waves, Medal,
  Activity, TrendingUp, Compass, BarChart3,
  Upload, Watch, Rocket, HeartPulse,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { applyDisciplineDefaultToCockpit } from '@/lib/design/sport-settings'
import { APP_MODE_KEY } from '@/lib/preferences/app-mode'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// Onboarding « Mission Setup » — écran de production (/onboarding).
// Collecte discipline / mission / mode / source et les persiste dans
// `profiles` (colonnes onboarding_*). Seuls la connexion Strava et le flag
// onboarding_completed_at pilotent le parcours ; les autres réponses sont
// stockées pour usage futur. FR codé en dur (v1).
// ─────────────────────────────────────────────────────────────────────────

type Option = { id: string; label: string; desc: string; icon: typeof Mountain; accent: string }

export type OnboardingAnswers = {
  discipline: string | null
  mission: string | null
  mode: string | null
  dataSource: string | null
  raceDate: string | null
}

const DISCIPLINES: Option[] = [
  { id: 'trail',     label: 'Trail',     desc: 'Sentiers & dénivelé',     icon: Mountain,   accent: 'var(--data-run)' },
  { id: 'route',     label: 'Route',     desc: 'Running sur route',        icon: Footprints, accent: 'var(--data-run)' },
  { id: 'velo',      label: 'Vélo',      desc: 'Cyclisme & home-trainer',  icon: Bike,       accent: 'var(--data-bike)' },
  { id: 'triathlon', label: 'Triathlon', desc: 'Multi-discipline',         icon: Medal,      accent: 'var(--primary)' },
  { id: 'natation',  label: 'Natation',  desc: 'Bassin & eau libre',       icon: Waves,      accent: 'var(--data-swim)' },
]

const MISSIONS: Option[] = [
  { id: 'trail',    label: 'Préparer un trail',             desc: 'Objectif daté, plan progressif', icon: Mountain,    accent: 'var(--data-run)' },
  { id: 'route',    label: 'Préparer une course sur route', desc: '10 km, semi, marathon',          icon: Footprints,  accent: 'var(--data-run)' },
  { id: 'charge',   label: 'Suivre ma charge',              desc: 'Fatigue, fraîcheur, forme',      icon: Activity,    accent: 'var(--data-charge)' },
  { id: 'libre',    label: 'Progresser sans objectif précis', desc: 'Rester régulier, voir ses tendances', icon: TrendingUp, accent: 'var(--data-bike)' },
]

const MODES: (Option & { points: string[] })[] = [
  { id: 'mission', label: 'Mode Simplifié', desc: 'Simple, lisible, guidé.',  icon: Compass,   accent: 'var(--primary)',   points: ['Vue épurée', 'Une mission à la fois', 'Conseils guidés'] },
  { id: 'expert',  label: 'Mode Expert',  desc: 'Données complètes.',        icon: BarChart3, accent: 'var(--data-bike)', points: ['Charge & fatigue', 'Graphiques avancés', 'Cockpit complet'] },
]

const TOTAL = 6

function ringStyle(accent: string, extra?: CSSProperties): CSSProperties {
  return { ['--tw-ring-color' as string]: accent, ...extra } as CSSProperties
}

// Vignette stylisée par mode (pas de vraie capture, ne se périme pas) :
// « mission » = vue épurée (1 carte + 1 bouton) · « expert » = tableau de bord dense.
function ModeThumb({ id }: { id: string }) {
  return (
    <div className="mt-3 h-[78px] w-full overflow-hidden rounded-[10px] border border-[#1b232e] bg-ink-900">
      {id === 'mission' ? (
        <svg viewBox="0 0 320 78" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
          <rect x="14" y="12" width="292" height="38" rx="8" fill="#18202B" stroke="#2a3644" />
          <circle cx="34" cy="31" r="9" fill="none" stroke="var(--primary)" strokeWidth="2.4" />
          <rect x="52" y="22" width="120" height="6" rx="3" fill="#3a4754" />
          <rect x="52" y="34" width="70" height="5" rx="2.5" fill="#2c3947" />
          <rect x="120" y="58" width="80" height="11" rx="5.5" fill="var(--primary)" />
        </svg>
      ) : (
        <svg viewBox="0 0 320 78" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
          <rect x="12" y="10" width="58" height="22" rx="5" fill="#18202B" stroke="#2a3644" />
          <rect x="76" y="10" width="58" height="22" rx="5" fill="#18202B" stroke="#2a3644" />
          <rect x="140" y="10" width="58" height="22" rx="5" fill="#18202B" stroke="#2a3644" />
          <rect x="18" y="15" width="20" height="4" rx="2" fill="var(--data-bike)" />
          <rect x="18" y="23" width="34" height="4" rx="2" fill="#33414f" />
          <rect x="82" y="15" width="20" height="4" rx="2" fill="#FF8A33" />
          <rect x="82" y="23" width="34" height="4" rx="2" fill="#33414f" />
          <rect x="146" y="15" width="20" height="4" rx="2" fill="#7aa8ff" />
          <rect x="146" y="23" width="34" height="4" rx="2" fill="#33414f" />
          <rect x="208" y="10" width="100" height="58" rx="6" fill="#18202B" stroke="#2a3644" />
          <path d="M214 52 L226 44 L238 48 L250 34 L262 40 L274 26 L286 32 L300 20" fill="none" stroke="var(--data-bike)" strokeWidth="2" />
          <path d="M214 52 L226 44 L238 48 L250 34 L262 40 L274 26 L286 32 L300 20 L300 62 L214 62 Z" fill="var(--data-bike)" opacity="0.14" />
          <rect x="14" y="60" width="10" height="8" rx="2" fill="#33414f" />
          <rect x="30" y="52" width="10" height="16" rx="2" fill="#3a4754" />
          <rect x="46" y="46" width="10" height="22" rx="2" fill="var(--primary)" />
          <rect x="62" y="55" width="10" height="13" rx="2" fill="#33414f" />
          <rect x="78" y="48" width="10" height="20" rx="2" fill="#3a4754" />
          <rect x="94" y="58" width="10" height="10" rx="2" fill="#33414f" />
          <rect x="110" y="50" width="10" height="18" rx="2" fill="#3a4754" />
          <rect x="126" y="44" width="10" height="24" rx="2" fill="var(--data-bike)" />
          <rect x="142" y="56" width="10" height="12" rx="2" fill="#33414f" />
          <rect x="158" y="52" width="10" height="16" rx="2" fill="#3a4754" />
          <rect x="174" y="47" width="10" height="21" rx="2" fill="#3a4754" />
          <rect x="190" y="58" width="10" height="10" rx="2" fill="#33414f" />
        </svg>
      )}
    </div>
  )
}

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
      <p className="font-body text-micro font-semibold uppercase tracking-[0.22em] text-primary-text">{eyebrow}</p>
      <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-fg-primary mt-1.5">{title}</h2>
      {subtitle && <p className="font-body text-body text-fg-muted leading-relaxed mt-2">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function MissionSetupFlow({
  stravaStatus,
  initialAnswers,
}: {
  stravaStatus?: string
  initialAnswers?: OnboardingAnswers
}) {
  const router = useRouter()
  // Retour d'un échec OAuth → on réaffiche directement l'étape Données.
  // Invariant : l'étape Données est la dernière (step === TOTAL) ; le callback
  // OAuth y renvoie. Toute renumérotation des étapes doit préserver ça.
  const [step, setStep] = useState(stravaStatus ? TOTAL : 1)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completionError, setCompletionError] = useState(false)
  const [discipline, setDiscipline] = useState<string | null>(initialAnswers?.discipline ?? null)
  const [mission, setMission] = useState<string | null>(initialAnswers?.mission ?? null)
  const [mode, setMode] = useState<string | null>(initialAnswers?.mode ?? null)
  const [dataSource, setDataSource] = useState<string | null>(initialAnswers?.dataSource ?? null)
  const [raceDate, setRaceDate] = useState<string | null>(initialAnswers?.raceDate ?? null)
  const [hrMethod, setHrMethod] = useState<'deduced' | 'pct_max' | 'auto' | null>(null)
  const [showManualHr, setShowManualHr] = useState(false)
  const [showAgeHr, setShowAgeHr] = useState(false)
  const [maxHrInput, setMaxHrInput] = useState('')
  const [birthYearInput, setBirthYearInput] = useState('')

  function chooseDeduced() {
    setHrMethod('deduced')
    void persist({ hr_zone_method: 'deduced' })
  }

  // Bornes de plausibilité : on n'enregistre une FC max / année de naissance
  // que si la valeur est physiologiquement crédible — sinon une faute de frappe
  // (max_hr: 1, naissance 2024) corromprait silencieusement les zones FC.
  const currentYear = new Date().getFullYear()
  const maxHrNum = Number(maxHrInput)
  const birthYearNum = Number(birthYearInput)
  const hrInputValid = showAgeHr
    ? Number.isFinite(birthYearNum) && birthYearNum > 1900 && birthYearNum <= currentYear - 10
    : Number.isFinite(maxHrNum) && maxHrNum >= 100 && maxHrNum <= 250

  function validateManualHr() {
    if (!hrInputValid) return
    if (showAgeHr) {
      setHrMethod('auto')
      void persist({ hr_zone_method: 'auto', birth_year: birthYearNum })
    } else {
      setHrMethod('pct_max')
      void persist({ hr_zone_method: 'pct_max', max_hr: maxHrNum })
    }
  }

  const errorMsg =
    stravaStatus === 'already_linked' ? 'Ce compte Strava est déjà connecté à un autre compte Trail Cockpit.'
    : stravaStatus === 'error'        ? 'La connexion Strava a échoué. Réessaie.'
    : null

  const canNext =
    step === 1 ? true :
    step === 2 ? !!discipline :
    step === 3 ? !!mission :
    step === 4 ? !!mode :
    true

  function answersPayload(): Record<string, unknown> {
    return {
      onboarding_discipline: discipline,
      onboarding_mission: mission,
      onboarding_mode: mode,
      onboarding_data_source: dataSource,
      onboarding_race_date: raceDate,
    }
  }

  async function persist(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Persistance au fil des sélections : chaque choix est sauvegardé seul, ce
  // qui survit au round-trip OAuth (la tuile Strava est un simple lien, pas
  // de navigation pilotée par JS). Le callback Strava pose data_source='strava'.
  function selectAndPersist(field: string, value: string, set: (v: string) => void) {
    set(value)
    void persist({ [field]: value })
  }

  // Chemin sans Strava : persister les réponses + demander la complétion
  // (le serveur pose onboarding_completed_at), puis dashboard. Si l'écriture
  // échoue, on NE navigue PAS (le gate renverrait l'user ici en boucle) : on
  // réaffiche le bouton avec une erreur pour qu'il réessaie.
  async function finish() {
    setBusy(true)
    setCompletionError(false)
    const ok = await persist({ ...answersPayload(), onboarding_complete: true })
    if (!ok) {
      setCompletionError(true)
      setBusy(false)
      return
    }
    // Pose le sport de la discipline comme défaut des blocs Cockpit avant la
    // navigation (sinon un réglage LS résiduel laisse les blocs sur « course »).
    applyDisciplineDefaultToCockpit(discipline)
    // Reflète le Mode choisi en localStorage tout de suite : le serveur a semé
    // app_mode en DB, mais on évite ainsi le flash expert→mission au 1er render
    // du dashboard (avant l'hydratation cloud→localStorage).
    if (mode === 'mission' || mode === 'expert') {
      try { localStorage.setItem(APP_MODE_KEY, JSON.stringify(mode)) } catch { /* private mode */ }
    }
    router.push('/dashboard')
    // Invalide le Router Cache : sans ça l'AppShell de (main) peut être servi
    // depuis un rendu antérieur (mode expert) → le raccourci « Expert » du header
    // (visible seulement en mode mission) n'apparaît pas après l'onboarding.
    router.refresh()
  }

  const disciplineOpt = DISCIPLINES.find(d => d.id === discipline)
  const missionOpt = MISSIONS.find(m => m.id === mission)
  const modeOpt = MODES.find(m => m.id === mode)

  return (
    <main className="min-h-screen bg-ink-900 text-fg-primary flex flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-body font-bold tracking-widest uppercase">
            <span className="text-primary-text">Mission</span>
            <span className="text-fg-primary"> Setup</span>
          </span>
        </div>

        {!done && (
          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL }, (_, i) => (
                <span
                  key={i}
                  className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < step ? 'bg-primary' : 'bg-ink-600')}
                />
              ))}
            </div>
            <p className="font-body text-micro text-fg-muted mt-2">Étape {step} sur {TOTAL}</p>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-7">
        {done ? (
          <CompletionScreen discipline={disciplineOpt} mission={missionOpt} mode={modeOpt} busy={busy} error={completionError} onEnter={finish} />
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
                  <p className="font-display text-center text-h2 font-semibold tracking-tight text-fg-primary mt-2">
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
                      selected={discipline === d.id} onClick={() => selectAndPersist('onboarding_discipline', d.id, setDiscipline)} />
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
                      selected={mission === m.id} onClick={() => selectAndPersist('onboarding_mission', m.id, setMission)} />
                  ))}
                </div>
                {(mission === 'trail' || mission === 'route') && (
                  <label className="mt-4 grid gap-1.5">
                    <span className="font-body text-[12.5px] text-fg-muted">As-tu une date de course&nbsp;? (optionnel)</span>
                    <input
                      type="date"
                      aria-label="Date de course"
                      value={raceDate ?? ''}
                      onChange={(e) => { const v = e.target.value || null; setRaceDate(v); void persist({ onboarding_race_date: v }) }}
                      className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                )}
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
                        onClick={() => selectAndPersist('onboarding_mode', m.id, setMode)}
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
                        <ModeThumb id={m.id} />
                        <div className="mt-3 flex flex-nowrap gap-1">
                          {m.points.map(p => (
                            <span key={p} className="whitespace-nowrap font-body text-micro text-fg-secondary rounded-full bg-ink-600/70 px-1.5 py-0.5">{p}</span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell stepKey={5} eyebrow="Fréquence cardiaque" title="Tes zones de FC"
                subtitle="Tes zones FC alimentent l'intensité, la charge et la fraîcheur. Tu pourras affiner dans Réglages.">
                <div className="grid gap-2.5">
                  <SelectTile
                    icon={HeartPulse}
                    title="Déduire automatiquement"
                    desc="Recommandé · on analyse ton historique Strava"
                    accent="var(--primary)"
                    selected={hrMethod === 'deduced'}
                    onClick={chooseDeduced}
                  />

                  {!showManualHr ? (
                    <button
                      type="button"
                      onClick={() => setShowManualHr(true)}
                      className="text-left font-body text-[13px] text-fg-muted underline underline-offset-2 hover:text-fg-primary px-1 py-2"
                    >
                      Je connais ma FC max
                    </button>
                  ) : (
                    <div className="rounded-xl border border-ink-600 bg-ink-700 p-4 grid gap-3">
                      {!showAgeHr ? (
                        <label className="grid gap-1.5">
                          <span className="font-body text-[12.5px] text-fg-muted">FC max (bpm)</span>
                          <input
                            type="number" inputMode="numeric" value={maxHrInput}
                            onChange={(e) => setMaxHrInput(e.target.value)}
                            placeholder="ex. 190"
                            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          <button type="button" onClick={() => { setShowAgeHr(true); setMaxHrInput('') }}
                            className="justify-self-start font-body text-[12px] text-fg-muted underline underline-offset-2 hover:text-fg-primary">
                            Je ne la connais pas
                          </button>
                        </label>
                      ) : (
                        <label className="grid gap-1.5">
                          <span className="font-body text-[12.5px] text-fg-muted">Année de naissance</span>
                          <input
                            type="number" inputMode="numeric" value={birthYearInput}
                            onChange={(e) => setBirthYearInput(e.target.value)}
                            placeholder="ex. 1988"
                            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          <span className="font-body text-[11px] text-fg-muted">On estimera ta FC max par l&apos;âge.</span>
                        </label>
                      )}
                      <Button onClick={validateManualHr} disabled={!hrInputValid}>Valider mes zones</Button>
                      {(hrMethod === 'pct_max' || hrMethod === 'auto') && (
                        <p className="font-body text-[12px] text-status-success">Zones enregistrées ✓</p>
                      )}
                    </div>
                  )}
                </div>
              </StepShell>
            )}

            {step === 6 && (
              <StepShell stepKey={6} eyebrow="Données" title="Connecte tes données"
                subtitle="Synchronise tes activités pour activer le cockpit.">
                {errorMsg && (
                  <p role="alert" className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
                    {errorMsg}
                  </p>
                )}
                <div className="grid gap-2.5">
                  <a
                    href="/api/strava/connect?from=onboarding"
                    className="group flex items-center gap-3.5 rounded-xl border border-ink-600 bg-ink-700 p-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(252,76,2,0.15)', color: '#FC4C02' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/strava/strava-mark.svg" alt="" width={22} height={22} className="block" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Strava</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Recommandé · import automatique</p>
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
                    onClick={() => selectAndPersist('onboarding_data_source', 'manual', setDataSource)}
                    aria-pressed={dataSource === 'manual'}
                    className={cn(
                      'flex items-center gap-3.5 rounded-xl border bg-ink-700 p-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
                      dataSource === 'manual' ? 'border-primary' : 'border-ink-600',
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-600 text-fg-secondary">
                      <Upload size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Import manuel</p>
                      <p className="font-body text-[12.5px] text-fg-muted">J&apos;ajouterai mes activités plus tard</p>
                    </div>
                    {dataSource === 'manual' && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check size={13} className="text-ink-900" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </div>
              </StepShell>
            )}
          </div>
        )}

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

function CompletionScreen({ discipline, mission, mode, busy, error, onEnter }: {
  discipline?: Option; mission?: Option; mode?: Option; busy: boolean; error: boolean; onEnter: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-[stepIn_320ms_cubic-bezier(0.32,0.72,0,1)]">
      <div className="h-20 w-full max-w-[220px]">
        <TrajectoryLine orientation="horizontal" animated duration={1.4} progress={1} />
      </div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mt-2">
        <Check size={26} strokeWidth={3} />
      </span>
      <h2 className="font-display text-[24px] font-bold tracking-tight text-fg-primary mt-4">Mission prête</h2>
      <p className="font-body text-body text-fg-muted mt-1.5 max-w-xs">
        Ton cockpit est configuré.
      </p>

      {/* Mantra de l'app — mis en avant, sur une seule ligne */}
      <p className="font-display whitespace-nowrap text-[clamp(16px,5vw,20px)] font-bold tracking-tight text-fg-primary mt-3.5">
        Préparer <span className="font-normal text-fg-muted/50">·</span> <span className="text-primary-text">Piloter</span> <span className="font-normal text-fg-muted/50">·</span> Accomplir
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {discipline && <Badge color={discipline.accent} dot>{discipline.label}</Badge>}
        {mission && <Badge variant="charge" dot>{mission.label}</Badge>}
        {mode && <Badge color={mode.accent} dot>{mode.label}</Badge>}
      </div>

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 max-w-xs">
          L&apos;enregistrement a échoué. Réessaie.
        </p>
      )}

      <div className="mt-7 w-full">
        <Button fullWidth onClick={onEnter} disabled={busy} trailingIcon={<ArrowRight size={16} />}>
          Entrer dans le cockpit
        </Button>
      </div>
    </div>
  )
}
