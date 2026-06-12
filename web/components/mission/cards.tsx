'use client'

// Primitives visuelles des écrans Mission (cf. maquette
// Prompts/mode-mission-3-piliers-mockup-v2.html). Style aligné Deep Mission.

export function MissionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[16px] bg-trail-card border border-trail-border p-4 ${className}`}>
      {children}
    </div>
  )
}

export function MissionCardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] font-semibold text-trail-muted font-display leading-none">
      {children}
    </p>
  )
}

export type DayDotState = 'done' | 'today' | 'upcoming' | 'rest'

// Pastille d'un jour de la semaine. `color` = couleur de la discipline du jour
// (défaut --primary) pour l'adaptation tri/vélo.
export function DayDot({ state, color }: { state: DayDotState; color?: string }) {
  const c = color ?? 'var(--primary)'
  const base = 'w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold'
  if (state === 'done') {
    return <span data-state="done" className={base} style={{ background: c, color: 'var(--ink-900)' }}>✓</span>
  }
  if (state === 'today') {
    return (
      <span
        data-state="today"
        className={base}
        style={{ border: '2px solid var(--primary)', color: 'var(--primary-text)', boxShadow: '0 0 0 4px var(--primary-glow)' }}
      >●</span>
    )
  }
  if (state === 'upcoming') {
    return <span data-state="upcoming" className={base} style={{ border: '2px dashed var(--ink-500)' }} />
  }
  return <span data-state="rest" className={base} style={{ background: 'var(--ink-600)', color: 'var(--text-disabled)' }}>–</span>
}

// Jauge horizontale réalisé/objectif avec repère optionnel « attendu aujourd'hui ».
export function CapGauge({ pct, markerPct, color }: { pct: number; markerPct?: number; color: string }) {
  return (
    <div className="relative h-[10px] rounded-full bg-trail-border">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
      {markerPct != null && (
        <span
          className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-[1px]"
          style={{ left: `${Math.min(100, Math.max(0, markerPct))}%`, background: 'var(--text-secondary)' }}
        />
      )}
    </div>
  )
}
