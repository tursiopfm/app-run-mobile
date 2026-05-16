'use client'

// Bloc Charge Planifiée : mini bar chart 4 semaines (W-1, W0, W+1, W+2).
// SVG inline (Recharts overkill ici). Couleur par seuils ; ligne pointillée =
// cible hebdo de la phase courante (issue du TrainingPlan).

import { useEffect, useMemo, useState } from 'react'
import type { PlannedSession, TrainingPlan, Phase } from '@/types/plan'
import { getCurrentPlan, getPlannedSessions } from '@/lib/plan/storage'
import { colors } from '@/lib/design/colors'

type WeekBucket = {
  label:    string
  startISO: string
  endISO:   string
  charge:   number
}

// ─── Date helpers (semaine ISO : lundi → dimanche) ──────────────────────────
function toISO(d: Date): string {
  // YYYY-MM-DD en UTC pour éviter les surprises timezone.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfISOWeek(d: Date): Date {
  // getUTCDay : 0 = dimanche, 1 = lundi … 6 = samedi.
  // On veut le lundi de la semaine ISO contenant d.
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = utc.getUTCDay() || 7 // dimanche -> 7
  if (dow !== 1) utc.setUTCDate(utc.getUTCDate() - (dow - 1))
  return utc
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime())
  next.setUTCDate(next.getUTCDate() + n)
  return next
}

function buildWeekBuckets(now: Date): { week: WeekBucket; offset: number }[] {
  const monday = startOfISOWeek(now)
  // offsets : -1, 0, +1, +2 (en semaines)
  return [-1, 0, 1, 2].map((offset) => {
    const start = addDays(monday, offset * 7)
    const end   = addDays(start, 6)
    return {
      week: {
        label:    offset === -1 ? 'W-1' : offset === 0 ? 'W0' : `W+${offset}`,
        startISO: toISO(start),
        endISO:   toISO(end),
        charge:   0,
      },
      offset,
    }
  })
}

// ─── Couleurs par seuil de charge ───────────────────────────────────────────
// Spec de la tâche (aucune constante équivalente dans charge-thresholds.ts
// qui couvre des semaines au lieu de jours).
function chargeColor(c: number): string {
  if (c < 100) return colors.greenOk        // #4ADE80
  if (c < 200) return colors.seriesYellow   // #FBBF24
  if (c < 300) return colors.chargeOrange   // #FF6B35
  if (c < 450) return colors.seriesRed      // #F87171
  return colors.pieCotes                    // violet (overload)
}

// ─── Phase courante (now ∈ [start, end]) ────────────────────────────────────
function findCurrentPhase(plan: TrainingPlan | null, nowISO: string): Phase | null {
  if (!plan) return null
  return plan.phases.find(p => p.startDate <= nowISO && nowISO <= p.endDate) ?? null
}

type ChargePlanifieeBlockProps = {
  /**
   * Compteur incrémenté par le parent (PlanClient) après une opération DnD
   * (move / create depuis template). Inclus dans les deps du reload pour
   * forcer un re-fetch sans démonter le composant.
   */
  reloadKey?: number
}

export function ChargePlanifieeBlock({ reloadKey = 0 }: ChargePlanifieeBlockProps = {}) {
  const [buckets, setBuckets] = useState<WeekBucket[]>([])
  const [target, setTarget]   = useState<number | null>(null)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const now = new Date()
      const skeleton = buildWeekBuckets(now)
      const fromISO = skeleton[0].week.startISO
      const toISO_  = skeleton[skeleton.length - 1].week.endISO

      const [sessions, plan] = await Promise.all([
        getPlannedSessions(fromISO, toISO_),
        getCurrentPlan(),
      ])

      // Somme par bucket
      const next = skeleton.map(({ week }) => {
        const sum = sessions
          .filter((s: PlannedSession) => s.date >= week.startISO && s.date <= week.endISO)
          .reduce((acc, s) => acc + (s.estimatedCharge || 0), 0)
        return { ...week, charge: sum }
      })

      const nowISODate = toISO(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
      const phase = findCurrentPhase(plan, nowISODate)

      if (!cancelled) {
        setBuckets(next)
        setTarget(phase?.weeklyChargeTarget ?? null)
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const maxCharge = useMemo(() => {
    const values = [...buckets.map(b => b.charge), target ?? 0, 450]
    return Math.max(...values, 1)
  }, [buckets, target])

  // Détection écart > 20% sur la semaine en cours (W0 = index 1)
  const w0 = buckets[1]
  const overshoot = (() => {
    if (!w0 || !target || target <= 0) return false
    return Math.abs(w0.charge - target) / target > 0.2
  })()

  // ─── Layout SVG ───────────────────────────────────────────────────────────
  const VB_W = 320
  const VB_H = 120
  const PAD_TOP = 8
  const PAD_BOTTOM = 22 // pour les labels W-1, W0, …
  const PAD_X = 12
  const innerW = VB_W - PAD_X * 2
  const innerH = VB_H - PAD_TOP - PAD_BOTTOM
  const barCount = 4
  const slotW = innerW / barCount
  const barW = Math.min(36, slotW * 0.55)

  function y(value: number): number {
    return PAD_TOP + innerH - (value / maxCharge) * innerH
  }

  const targetY = target != null ? y(target) : null

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[16px] text-trail-text"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
        >
          CHARGE PLANIFIÉE
        </h3>
        {overshoot && (
          <span
            className="px-[8px] py-[3px] rounded-full text-[10px] font-semibold whitespace-nowrap"
            style={{
              backgroundColor: `${colors.seriesYellow}26`,
              color: colors.seriesYellow,
            }}
            aria-label="Écart supérieur à 20% par rapport à la cible"
          >
            Écart &gt;20% / cible
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height={VB_H}
        role="img"
        aria-label="Charge planifiée sur 4 semaines"
        style={{ overflow: 'visible' }}
      >
        {/* Ligne pointillée cible */}
        {targetY != null && (
          <>
            <line
              x1={PAD_X}
              x2={VB_W - PAD_X}
              y1={targetY}
              y2={targetY}
              stroke={colors.subtleText as string}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <text
              x={VB_W - PAD_X}
              y={Math.max(targetY - 4, PAD_TOP + 8)}
              textAnchor="end"
              fontSize="9"
              fill={colors.subtleText as string}
              style={{ fontWeight: 600 }}
            >
              cible {target}
            </text>
          </>
        )}

        {/* Barres */}
        {(loaded ? buckets : buildWeekBuckets(new Date()).map(b => b.week)).map((b, i) => {
          const cx = PAD_X + slotW * (i + 0.5)
          const x  = cx - barW / 2
          const barY = y(b.charge)
          const barH = Math.max(2, PAD_TOP + innerH - barY)
          const color = chargeColor(b.charge)
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={barY}
                width={barW}
                height={barH}
                rx={3}
                fill={color}
                opacity={b.charge > 0 ? 1 : 0.25}
              />
              {b.charge > 0 && (
                <text
                  x={cx}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill={colors.text as string}
                  style={{ fontWeight: 600 }}
                >
                  {Math.round(b.charge)}
                </text>
              )}
              <text
                x={cx}
                y={VB_H - 8}
                textAnchor="middle"
                fontSize="10"
                fill={colors.subtleText as string}
                style={{ fontWeight: 600 }}
              >
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
