'use client'

import { useState, useMemo } from 'react'
import { colors } from '@/lib/design/colors'

// ── Types ──────────────────────────────────────────────────────────────
type PlannedSession = { dayIndex: number; title: string; isRest: boolean }
type PlanWeek = {
  weekNumber: number
  startDate: Date
  targetKm: number
  targetDPlus: number
  targetLoad: number
  objectiveLabel: string
  note: string
  sessions: PlannedSession[]
  actualKm: number
  actualDPlus: number
  actualLoad: number
}
type PlanObjective = {
  id: string
  name: string
  date: string
  importance: 'Principal' | 'Secondary'
  targetKm: number
  targetDPlus: number
  result: string
  note: string
  archived: boolean
}

// ── Utilities ──────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  m.setHours(0, 0, 0, 0)
  return m
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function addWeeks(d: Date, n: number): Date { return addDays(d, n * 7) }
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isoWeek(d: Date): number {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = u.getUTCDay() || 7
  u.setUTCDate(u.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(u.getUTCFullYear(), 0, 1))
  return Math.ceil(((u.getTime() - y.getTime()) / 86400000 + 1) / 7)
}
function fmtShort(d: Date): string { return `${d.getDate()}/${d.getMonth() + 1}` }
function fmtLong(d: Date): string {
  const M = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${d.getDate()} ${M[d.getMonth()]}`
}
function fmtDow(d: Date): string {
  return ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][d.getDay()]
}
function fmtMonthYear(d: Date): string {
  const M = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  return `${M[d.getMonth()]} ${d.getFullYear()}`
}
function fmt1(v: number): string { return (Math.round(v * 10) / 10).toFixed(1) }
function fmtObjectiveDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const M = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`
}

// ── Sample Data ────────────────────────────────────────────────────────
const TODAY = new Date()
const CURRENT_MONDAY = getMonday(TODAY)

function mkSessions(pattern: { di: number; title: string }[]): PlannedSession[] {
  return Array.from({ length: 7 }, (_, i) => {
    const p = pattern.find(x => x.di === i)
    return p ? { dayIndex: i, title: p.title, isRest: false } : { dayIndex: i, title: '', isRest: true }
  })
}

const T0 = mkSessions([{ di:0, title:'EF 10 km' }, { di:2, title:'VMA 8 km' }, { di:4, title:'Seuil 12 km' }, { di:5, title:'Sortie longue 22 km' }])
const T1 = mkSessions([{ di:0, title:'EF 12 km' }, { di:1, title:'VMA 8 km' }, { di:3, title:'Seuil 14 km' }, { di:5, title:'Sortie longue 26 km' }])
const T2 = mkSessions([{ di:0, title:'EF 8 km' }, { di:3, title:'Côtes 10 km' }, { di:5, title:'Sortie longue 18 km' }])
const T3 = mkSessions([{ di:0, title:'Récup active' }, { di:2, title:'EF 6 km' }, { di:4, title:'EF 8 km' }])

const PLAN_WEEKS: PlanWeek[] = [
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY,-3)), startDate: addWeeks(CURRENT_MONDAY,-3), targetKm:60, targetDPlus:1200, targetLoad:280, objectiveLabel:'Récup',    note:'',          sessions:T3, actualKm:55.2, actualDPlus:1050, actualLoad:240 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY,-2)), startDate: addWeeks(CURRENT_MONDAY,-2), targetKm:75, targetDPlus:1800, targetLoad:370, objectiveLabel:'Ecotrail', note:'',          sessions:T1, actualKm:72.1, actualDPlus:1720, actualLoad:345 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY,-1)), startDate: addWeeks(CURRENT_MONDAY,-1), targetKm:65, targetDPlus:1400, targetLoad:310, objectiveLabel:'Ecotrail', note:'',          sessions:T0, actualKm:63.5, actualDPlus:1320, actualLoad:295 },
  { weekNumber: isoWeek(CURRENT_MONDAY),              startDate: CURRENT_MONDAY,              targetKm:70, targetDPlus:1600, targetLoad:340, objectiveLabel:'Ecotrail', note:'Semaine de charge avant la compèt.', sessions:T1, actualKm:25.0, actualDPlus:480, actualLoad:115 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY, 1)), startDate: addWeeks(CURRENT_MONDAY, 1), targetKm:40, targetDPlus:800,  targetLoad:180, objectiveLabel:'Ecotrail', note:'Récupération post-course.', sessions:T3, actualKm:0, actualDPlus:0, actualLoad:0 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY, 2)), startDate: addWeeks(CURRENT_MONDAY, 2), targetKm:55, targetDPlus:1200, targetLoad:250, objectiveLabel:'UTMB',     note:'',          sessions:T2, actualKm:0, actualDPlus:0, actualLoad:0 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY, 3)), startDate: addWeeks(CURRENT_MONDAY, 3), targetKm:65, targetDPlus:1500, targetLoad:310, objectiveLabel:'UTMB',     note:'',          sessions:T0, actualKm:0, actualDPlus:0, actualLoad:0 },
  { weekNumber: isoWeek(addWeeks(CURRENT_MONDAY, 4)), startDate: addWeeks(CURRENT_MONDAY, 4), targetKm:75, targetDPlus:1800, targetLoad:370, objectiveLabel:'UTMB',     note:'',          sessions:T1, actualKm:0, actualDPlus:0, actualLoad:0 },
]

const PLAN_OBJECTIVES: PlanObjective[] = [
  { id:'1', name:'Ecotrail Paris 80km', date:'2026-06-28', importance:'Principal', targetKm:80, targetDPlus:5200, result:'', note:'Objectif A — viser < 12h', archived:false },
  { id:'2', name:'Ultra-Trail du Mont-Blanc', date:'2026-08-30', importance:'Secondary', targetKm:171, targetDPlus:10000, result:'', note:'Objectif B — terminer', archived:false },
  { id:'3', name:'Trail des Lavoirs', date:'2026-10-11', importance:'Secondary', targetKm:42, targetDPlus:2100, result:'', note:'', archived:false },
  { id:'4', name:'TDS — 145km', date:'2026-03-20', importance:'Principal', targetKm:145, targetDPlus:8400, result:'DNF km 98', note:'', archived:true },
]

// ── Small UI components ────────────────────────────────────────────────

function PlanNavButton({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={!enabled}
      onClick={onClick}
      style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: 10,
        backgroundColor: enabled ? colors.surface : `${colors.border}59`,
        border: `1px solid ${enabled ? colors.border : colors.border + '4D'}`,
        color: enabled ? colors.text : colors.subtleText + '73',
        fontSize: 18, fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {label}
    </button>
  )
}

function PlanSegmentButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center rounded-[10px] border"
      style={{
        height: 42,
        backgroundColor: selected ? `${colors.chargeOrange}2B` : colors.surface,
        borderColor: selected ? colors.chargeOrange : colors.border,
        color: selected ? colors.chargeOrange : colors.subtleText,
        fontSize: 11, fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function PlanMetricTile({ label, main, sub, color }: { label: string; main: string; sub: string; color: string }) {
  return (
    <div className="flex-1 rounded-[10px] px-[10px] py-[8px]" style={{ backgroundColor: colors.surface }}>
      <p className="text-[11px] text-trail-muted">{label}</p>
      <p className="text-[18px] font-bold mt-[2px]" style={{ color }}>{main}</p>
      <p className="text-[11px] text-trail-muted mt-[1px]">{sub}</p>
    </div>
  )
}

function PlanMiniBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 rounded-[10px] px-[8px] py-[6px]" style={{ backgroundColor: colors.surface }}>
      <p className="text-[11px] font-black" style={{ color }}>{label}</p>
      <p className="text-[13px] font-bold text-trail-text mt-[2px]">{value}</p>
    </div>
  )
}

function PlanProgressLine({ label, current, target, unit, color }: {
  label: string; current: number; target: number; unit: string; color: string
}) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0
  return (
    <div>
      <div className="flex justify-between mb-[6px]">
        <span className="text-[12px] text-trail-muted">{label}</span>
        <span className="text-[12px] font-semibold text-trail-text">{fmt1(current)} / {fmt1(target)} {unit}</span>
      </div>
      <div className="h-[8px] rounded-full overflow-hidden" style={{ backgroundColor: `${color}26` }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function PlanCalendarDayCell({
  date, inMonth, selected, plannedCount, onClick,
}: { date: Date; inMonth: boolean; selected: boolean; plannedCount: number; onClick: () => void }) {
  const borderColor = selected
    ? colors.chargeOrange
    : plannedCount > 0
      ? `${colors.seriesBlue}73`
      : colors.border
  const bg = selected ? `${colors.chargeOrange}26` : colors.surface
  const textColor = selected ? colors.chargeOrange : colors.text
  const opacity = inMonth ? 1 : 0.42
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, height: 54, borderRadius: 9,
        backgroundColor: bg, border: `1px solid ${borderColor}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', padding: 5, opacity,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{date.getDate()}</span>
      {plannedCount > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center' }}>
          {Array.from({ length: Math.min(plannedCount, 3) }).map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.seriesBlue }} />
          ))}
          {plannedCount > 3 && <span style={{ fontSize: 8, color: colors.subtleText }}>+{plannedCount - 3}</span>}
        </div>
      )}
    </button>
  )
}

// ── Section cards ──────────────────────────────────────────────────────

function PlanHeroCard({ week, selectedDate, weekIndex, total, onPrev, onNext, onToday }: {
  week: PlanWeek; selectedDate: Date; weekIndex: number; total: number
  onPrev: () => void; onNext: () => void; onToday: () => void
}) {
  const projected = {
    km: Math.max(0, week.targetKm - week.actualKm),
    dPlus: Math.max(0, week.targetDPlus - week.actualDPlus),
    load: Math.max(0, week.targetLoad - week.actualLoad),
  }
  const total2 = { km: week.actualKm + projected.km, load: week.actualLoad + projected.load }
  const plannedSessions = week.sessions.filter(s => !s.isRest && s.title).length
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[23px] font-black text-trail-text leading-tight">Plan d&apos;entraînement</p>
          <p className="text-[12px] text-trail-muted mt-1">
            S{week.weekNumber} — {fmtShort(week.startDate)} au {fmtShort(addDays(week.startDate, 6))} — {week.objectiveLabel}
          </p>
        </div>
        <span
          className="ml-2 flex-shrink-0 rounded-full px-2 py-[3px] text-[11px] font-bold"
          style={{ backgroundColor: `${colors.chargeOrange}26`, color: colors.chargeOrange, border: `1px solid ${colors.chargeOrange}4D` }}
        >
          {plannedSessions} séances
        </span>
      </div>

      {/* Nav row */}
      <div className="flex items-center gap-2 mt-3">
        <PlanNavButton label="<" enabled={weekIndex > 0} onClick={onPrev} />
        <div className="flex-1 rounded-[10px] flex flex-col items-center py-2" style={{ backgroundColor: colors.surface }}>
          <span className="text-[11px] text-trail-muted">{fmtDow(selectedDate)}</span>
          <span className="text-[15px] font-bold text-trail-text">{fmtLong(selectedDate)}</span>
        </div>
        <PlanNavButton label=">" enabled={weekIndex < total - 1} onClick={onNext} />
        <button onClick={onToday} style={{ color: colors.chargeOrange, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Metric tiles */}
      <div className="flex gap-2 mt-[14px]">
        <PlanMetricTile label="Objectif" main={`${fmt1(week.targetKm)} km`} sub={`${week.targetDPlus} m D+`} color={colors.chargeOrange} />
        <PlanMetricTile label="Prévus" main={`${fmt1(week.targetKm)} km`} sub={`${plannedSessions} séances`} color={colors.seriesBlue} />
        <PlanMetricTile label="Restant" main={`${fmt1(projected.km)} km`} sub={`${projected.dPlus} m D+`} color={colors.greenOk} />
      </div>

      {/* Progress lines */}
      <div className="mt-3 space-y-2">
        <PlanProgressLine label="Volume semaine" current={total2.km} target={week.targetKm} unit="km" color={colors.chargeOrange} />
        <PlanProgressLine label="Dénivelé" current={week.actualDPlus + projected.dPlus} target={week.targetDPlus} unit="m" color={colors.seriesBlue} />
        <PlanProgressLine label="Charge prévue vs cible" current={total2.load} target={week.targetLoad} unit="pts" color={colors.seriesYellow} />
      </div>

      {/* Mini badges */}
      <div className="flex gap-2 mt-3">
        <PlanMiniBadge label="Réalisé" value={`${fmt1(week.actualKm)} km`} color={colors.greenOk} />
        <PlanMiniBadge label="Planifié" value={`${fmt1(total2.km)} km`} color={colors.seriesBlue} />
        <PlanMiniBadge label="Restant" value={`${fmt1(projected.km)} km`} color={colors.chargeOrange} />
      </div>

      {week.note && (
        <p className="text-[12px] text-trail-muted mt-[10px] leading-[17px]">{week.note}</p>
      )}
    </div>
  )
}


function PlanCalendarCard({ weeks, visibleMonth, selectedDate, onMonthChange, onSelectDate }: {
  weeks: PlanWeek[]
  visibleMonth: Date
  selectedDate: Date
  onMonthChange: (d: Date) => void
  onSelectDate: (d: Date) => void
}) {
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const startDow = firstOfMonth.getDay()
  const calStart = addDays(firstOfMonth, startDow === 0 ? -6 : 1 - startDow)
  const planStart = weeks[0].startDate
  const planEnd = addDays(weeks[weeks.length - 1].startDate, 6)

  const rows = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      const date = addDays(calStart, row * 7 + col)
      const week = weeks.find(w => date >= w.startDate && date <= addDays(w.startDate, 6))
      const plannedCount = week?.sessions.filter(s => s.dayIndex === (date.getDay() === 0 ? 6 : date.getDay() - 1) && !s.isRest && s.title).length ?? 0
      const inPlan = date >= planStart && date <= planEnd
      return { date, inMonth: date.getMonth() === visibleMonth.getMonth(), plannedCount, inPlan }
    })
  )

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <PlanNavButton label="<" enabled onClick={() => { const d = new Date(visibleMonth); d.setMonth(d.getMonth()-1); onMonthChange(d) }} />
        <p className="text-[17px] font-black text-trail-text">{fmtMonthYear(visibleMonth)}</p>
        <PlanNavButton label=">" enabled onClick={() => { const d = new Date(visibleMonth); d.setMonth(d.getMonth()+1); onMonthChange(d) }} />
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-[5px] mb-[6px]">
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <p key={i} className="text-[11px] font-bold text-trail-muted text-center">{d}</p>
        ))}
      </div>
      {/* Day cells */}
      <div className="space-y-[5px]">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-[5px]">
            {row.map(({ date, inMonth, plannedCount, inPlan }) => (
              <PlanCalendarDayCell
                key={date.toISOString()}
                date={date}
                inMonth={inMonth && inPlan}
                selected={sameDay(date, selectedDate)}
                plannedCount={plannedCount}
                onClick={() => inPlan && onSelectDate(date)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanDayPlanner({ week, selectedDate }: { week: PlanWeek; selectedDate: Date }) {
  const dayIndex = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1
  const session = week.sessions.find(s => s.dayIndex === dayIndex)
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[10px]">
        <p className="text-[15px] font-bold text-trail-text">{fmtDow(selectedDate)} {fmtLong(selectedDate)}</p>
        <span className="text-[11px] text-trail-muted">Séance planifiée</span>
      </div>
      {session && !session.isRest && session.title ? (
        <div className="rounded-[10px] p-[10px]" style={{ backgroundColor: colors.surface }}>
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.chargeOrange, flexShrink: 0 }} />
            <p className="text-[15px] font-semibold text-trail-text">{session.title}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-[10px] p-[10px] flex items-center gap-2" style={{ backgroundColor: colors.surface }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.border, flexShrink: 0 }} />
          <p className="text-[14px] text-trail-muted">Repos / jour libre</p>
        </div>
      )}
    </div>
  )
}

function PlanObjectiveStrip({ objectives, selectedLabel, onSelect }: {
  objectives: PlanObjective[]
  selectedLabel: string
  onSelect: (label: string) => void
}) {
  const active = useMemo(() => objectives.filter(o => !o.archived).sort((a, b) => a.date.localeCompare(b.date)), [objectives])
  if (active.length === 0) return null
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <p className="text-[15px] font-bold text-trail-text mb-[10px]">Objectifs</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {active.map(obj => {
          const sel = obj.name.split(' ')[0] === selectedLabel || selectedLabel === obj.name.split(' ').slice(0,2).join(' ')
          const color = obj.importance === 'Principal' ? colors.chargeOrange : colors.seriesBlue
          return (
            <button
              key={obj.id}
              onClick={() => onSelect(obj.name)}
              className="flex-shrink-0 rounded-[10px] px-3 py-[6px] border text-left"
              style={{
                backgroundColor: sel ? `${color}26` : colors.surface,
                borderColor: sel ? color : colors.border,
                cursor: 'pointer',
              }}
            >
              <p className="text-[11px] font-bold" style={{ color }}>{obj.importance === 'Principal' ? '★' : '○'} {obj.name}</p>
              <p className="text-[10px] text-trail-muted">{fmtObjectiveDate(obj.date)}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PlanRacesTab({ objectives }: { objectives: PlanObjective[] }) {
  const active = objectives.filter(o => !o.archived).sort((a, b) => a.date.localeCompare(b.date))
  const archived = objectives.filter(o => o.archived).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-[10px]">
      {/* Records placeholder */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[11px] font-black" style={{ color: colors.chargeOrange }}>Records</p>
        <div className="flex gap-2 mt-2">
          {[['Trail', colors.seriesBlue], ['Ultra', colors.seriesYellow]].map(([label, color]) => (
            <div key={label} className="flex-1 rounded-[10px] px-[8px] py-[6px]" style={{ backgroundColor: colors.surface }}>
              <p className="text-[11px] font-black" style={{ color }}>{label}</p>
              <p className="text-[13px] text-trail-muted">à renseigner</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-trail-muted mt-2">Base prévue pour stocker les meilleurs temps, distances et D+.</p>
      </div>

      {/* Active objectives */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[14px] font-bold text-trail-text mb-2">Objectifs actifs</p>
        {active.length === 0
          ? <p className="text-[12px] text-trail-muted">Aucune course active.</p>
          : active.map(obj => <RaceRow key={obj.id} obj={obj} />)
        }
      </div>

      {/* Archived */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[14px] font-bold text-trail-text mb-2">Archivées</p>
        {archived.length === 0
          ? <p className="text-[12px] text-trail-muted">Les courses terminées apparaîtront ici.</p>
          : archived.map(obj => <RaceRow key={obj.id} obj={obj} />)
        }
      </div>
    </div>
  )
}

function RaceRow({ obj }: { obj: PlanObjective }) {
  const color = obj.importance === 'Principal' ? colors.chargeOrange : colors.seriesBlue
  return (
    <div className="rounded-[12px] p-3 mb-2 border" style={{ backgroundColor: colors.surface, borderColor: `${color}47` }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-trail-text">{obj.name}</p>
          <p className="text-[11px] font-semibold" style={{ color }}>{fmtObjectiveDate(obj.date)} — {obj.importance}</p>
        </div>
        {obj.archived && <span className="text-[11px] font-semibold text-trail-muted ml-2 flex-shrink-0">Archivée</span>}
      </div>
      <p className="text-[12px] text-trail-muted mt-2">{fmt1(obj.targetKm)} km — {obj.targetDPlus} m D+</p>
      {obj.result && <p className="text-[12px] font-semibold mt-1" style={{ color: colors.greenOk }}>Résultat : {obj.result}</p>}
      {obj.note && <p className="text-[11px] text-trail-muted mt-1">{obj.note}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function PlanClient() {
  const initialIndex = useMemo(() => {
    const idx = PLAN_WEEKS.findIndex(w => sameDay(w.startDate, CURRENT_MONDAY) || (TODAY >= w.startDate && TODAY <= addDays(w.startDate, 6)))
    return idx >= 0 ? idx : Math.max(0, PLAN_WEEKS.findIndex(w => w.startDate > TODAY))
  }, [])

  const [view, setView] = useState<'Calendar' | 'Races'>('Calendar')
  const [weekIndex, setWeekIndex] = useState(initialIndex)
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [visibleMonth, setVisibleMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))

  const week = PLAN_WEEKS[weekIndex]

  function selectDate(d: Date) {
    setSelectedDate(d)
    setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    const idx = PLAN_WEEKS.findIndex(w => d >= w.startDate && d <= addDays(w.startDate, 6))
    if (idx >= 0) setWeekIndex(idx)
  }

  function goToToday() {
    selectDate(TODAY)
  }

  return (
    /* Android: contentPadding=12dp, spacedBy=12dp */
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">

      {/* View tabs (Calendrier / Courses) */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[6px]">
        <div className="flex gap-2">
          <PlanSegmentButton label="Calendrier" selected={view === 'Calendar'} onClick={() => setView('Calendar')} />
          <PlanSegmentButton label="Courses" selected={view === 'Races'} onClick={() => setView('Races')} />
        </div>
      </div>

      {view === 'Races' ? (
        <PlanRacesTab objectives={PLAN_OBJECTIVES} />
      ) : (
        <>
          <PlanHeroCard
            week={week}
            selectedDate={selectedDate}
            weekIndex={weekIndex}
            total={PLAN_WEEKS.length}
            onPrev={() => {
              const i = Math.max(0, weekIndex - 1)
              setWeekIndex(i)
              selectDate(PLAN_WEEKS[i].startDate)
            }}
            onNext={() => {
              const i = Math.min(PLAN_WEEKS.length - 1, weekIndex + 1)
              setWeekIndex(i)
              selectDate(PLAN_WEEKS[i].startDate)
            }}
            onToday={goToToday}
          />

          <PlanCalendarCard
            weeks={PLAN_WEEKS}
            visibleMonth={visibleMonth}
            selectedDate={selectedDate}
            onMonthChange={setVisibleMonth}
            onSelectDate={selectDate}
          />

          <PlanDayPlanner week={week} selectedDate={selectedDate} />

          <PlanObjectiveStrip
            objectives={PLAN_OBJECTIVES}
            selectedLabel={week.objectiveLabel}
            onSelect={() => {}}
          />
        </>
      )}
    </div>
  )
}
