'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { PlanWarning, WarningSeverity } from '@/lib/training/plan-warnings'

type Props = {
  warnings: PlanWarning[]
  onPhaseClick?: (phaseId: string) => void
}

const SEVERITY_COLOR: Record<WarningSeverity, string> = {
  critical: '#F97316',
  warning:  '#EAB308',
  info:     '#60A5FA',
}

function SeverityIcon({ severity }: { severity: WarningSeverity }) {
  const color = SEVERITY_COLOR[severity]
  if (severity === 'critical') return <AlertCircle size={14} style={{ color }} aria-hidden />
  if (severity === 'warning')  return <AlertTriangle size={14} style={{ color }} aria-hidden />
  return <Info size={14} style={{ color }} aria-hidden />
}

export function PlanWarnings({ warnings, onPhaseClick }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (warnings.length === 0) return null

  return (
    <div className="mt-3 p-3 rounded-[10px] border border-[color:var(--trail-border)] bg-[color:var(--trail-card)]">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-2"
        aria-expanded={!collapsed}
        aria-label={`${warnings.length} suggestion${warnings.length > 1 ? 's' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={14} className="text-[color:var(--trail-primary)]" aria-hidden />
          <span className="text-[12px] font-semibold text-[color:var(--trail-text)]">
            Suggestions · {warnings.length}
          </span>
        </div>
        <ChevronDown
          size={14}
          className="text-[color:var(--trail-muted)] shrink-0"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
          aria-hidden
        />
      </button>

      {!collapsed && (
        <div className="mt-2 flex flex-col gap-1">
          {warnings.map(w => {
            const isOpen = expandedId === w.id
            return (
              <div key={w.id} className="rounded-[8px] bg-[color:var(--trail-surface)]">
                <button
                  type="button"
                  onClick={() => setExpandedId(prev => prev === w.id ? null : w.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                  aria-expanded={isOpen}
                >
                  <SeverityIcon severity={w.severity} />
                  <span className="text-[11px] font-semibold text-[color:var(--trail-text)] truncate flex-1 min-w-0">
                    {w.title}
                  </span>
                  <ChevronRight
                    size={12}
                    className="text-[color:var(--trail-muted)] shrink-0"
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms ease',
                    }}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div className="px-2 pb-2">
                    <p className="text-[11px] text-[color:var(--trail-muted)] leading-relaxed mb-2">
                      {w.detail}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {w.phaseId && onPhaseClick && (
                        <button
                          type="button"
                          onClick={() => onPhaseClick(w.phaseId!)}
                          className="px-2 py-1 rounded-[6px] text-[10px] font-semibold bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] text-[color:var(--trail-primary)] hover:border-[color:var(--trail-primary)]"
                        >
                          Voir le cycle →
                        </button>
                      )}
                      {w.raceId && (
                        <a
                          href={`/plan/courses/${w.raceId}`}
                          className="px-2 py-1 rounded-[6px] text-[10px] font-semibold bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] text-[color:var(--trail-primary)] hover:border-[color:var(--trail-primary)] inline-block"
                        >
                          Voir la course →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
