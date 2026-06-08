'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'
import { effectiveWorkoutType } from '@/lib/activities/intensity'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import { getRaces } from '@/lib/plan/storage'
import type { Race } from '@/types/plan'
import { BlockGrid, type BlockDef } from '@/components/blocks/BlockGrid'
import { BlockCard } from '@/components/blocks/BlockCard'

// ── Types ──────────────────────────────────────────────────────────────────────
type Sport = 'Running' | 'Cycling' | 'Swimming'
type RecordSource = 'Auto' | 'Manual'
type RecordType = 'BestTime' | 'LongestDistance' | 'HighestElevation' | 'BestPace' | 'BestSpeed' | 'Custom'
type RecordFilter = 'All' | 'Distance' | 'Global' | 'Manual'

type PersonalRecord = {
  id: string
  sport: Sport
  label: string
  recordType: RecordType
  valueLabel: string
  distanceKm?: number
  date?: string
  source: RecordSource
}

type SearchField = 'Titre' | 'Distance' | 'Durée' | 'D+'
type SortField = 'sport' | 'date' | 'distance' | 'pace' | 'duration' | 'dplus'
type SortDir = 'asc' | 'desc'
type DistanceType = 'Toutes' | 'TenKm' | 'Semi' | 'Marathon' | 'TrailLong' | 'Ultra'

const DISTANCE_TYPE_OPTIONS: { key: DistanceType; label: string }[] = [
  { key: 'Toutes',    label: 'Toutes' },
  { key: 'TenKm',     label: '10 km' },
  { key: 'Semi',      label: 'Semi' },
  { key: 'Marathon',  label: 'Marathon' },
  { key: 'TrailLong', label: 'Trail long' },
  { key: 'Ultra',     label: 'Ultra trail' },
]

function matchesDistanceType(km: number | null, type: DistanceType): boolean {
  if (type === 'Toutes') return true
  if (km == null) return false
  const isMarathon = km >= 40 && km <= 44
  switch (type) {
    case 'TenKm':     return km >= 9  && km <= 11
    case 'Semi':      return km >= 20 && km <= 22
    case 'Marathon':  return isMarathon
    case 'TrailLong': return km >= 35 && km < 80 && !isMarathon
    case 'Ultra':     return km >= 80
    default:          return false
  }
}

interface SearchState {
  field:     SearchField
  title:     string
  distFrom:  string
  distTo:    string
  durFrom:   string
  durTo:     string
  dPlusFrom: string
  dPlusTo:   string
}

interface FilterState {
  sport:         string
  distanceType:  DistanceType
  dateFrom:      string
  dateTo:        string
  distFrom:  string
  distTo:    string
  paceFrom:  string
  paceTo:    string
  durFrom:   string
  durTo:     string
  dPlusFrom: string
  dPlusTo:   string
  sortField: SortField
  sortDir:   SortDir
}

const DEFAULT_SEARCH: SearchState = {
  field: 'Titre', title: '',
  distFrom: '', distTo: '',
  durFrom: '', durTo: '',
  dPlusFrom: '', dPlusTo: '',
}

const DEFAULT_FILTER: FilterState = {
  sport: 'Toutes',
  distanceType: 'Toutes',
  dateFrom: '', dateTo: '',
  distFrom: '', distTo: '',
  paceFrom: '', paceTo: '',
  durFrom: '', durTo: '',
  dPlusFrom: '', dPlusTo: '',
  sortField: 'date', sortDir: 'desc',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizeSportType(s: string): string {
  return s === 'TrailRun' ? 'Run' : s
}

function parsePaceSec(s: string): number | null {
  const m = s.match(/^(\d+):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

function parseDurSec(s: string): number | null {
  const m = s.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
}

function getPaceSec(a: ActivityRow): number | null {
  if (!a.distance_m || !a.moving_time_sec || a.distance_m < 1) return null
  return a.moving_time_sec / (a.distance_m / 1000)
}

function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return new Date(`${s}T00:00:00`)
}

function fmt1(v: number): string { return (Math.round(v * 10) / 10).toFixed(1) }

function fmtDateLong(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function fmtChrono(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function applySearch(list: ActivityRow[], search: SearchState): ActivityRow[] {
  if (search.field === 'Titre' && search.title.trim()) {
    const q = search.title.trim().toLowerCase()
    list = list.filter(a => a.name.toLowerCase().includes(q))
  }
  if (search.field === 'Distance') {
    const from = parseFloat(search.distFrom)
    const to   = parseFloat(search.distTo)
    if (!isNaN(from)) list = list.filter(a => a.distance_m != null && a.distance_m / 1000 >= from)
    if (!isNaN(to))   list = list.filter(a => a.distance_m != null && a.distance_m / 1000 <= to)
  }
  if (search.field === 'Durée') {
    const from = parseDurSec(search.durFrom)
    const to   = parseDurSec(search.durTo)
    if (from != null) list = list.filter(a => a.moving_time_sec != null && a.moving_time_sec >= from)
    if (to   != null) list = list.filter(a => a.moving_time_sec != null && a.moving_time_sec <= to)
  }
  if (search.field === 'D+') {
    const from = parseFloat(search.dPlusFrom)
    const to   = parseFloat(search.dPlusTo)
    if (!isNaN(from)) list = list.filter(a => a.elevation_gain_m != null && a.elevation_gain_m >= from)
    if (!isNaN(to))   list = list.filter(a => a.elevation_gain_m != null && a.elevation_gain_m <= to)
  }
  return list
}

// ── Sample Records (vue Records inchangée pour l'instant) ──────────────────────
const SPORT_LABEL: Record<Sport, string> = { Running: 'Trail', Cycling: 'Vélo', Swimming: 'Natation' }

const SAMPLE_RECORDS: PersonalRecord[] = [
  { id:'p1', sport:'Running', label:'10 km',          recordType:'BestTime',          valueLabel:'42:15',     distanceKm:10,    date:'2024-09-21', source:'Auto' },
  { id:'p2', sport:'Running', label:'Semi-marathon',  recordType:'BestTime',          valueLabel:'1h38:45',   distanceKm:21.1,  date:'2024-11-03', source:'Auto' },
  { id:'p3', sport:'Running', label:'Marathon',       recordType:'BestTime',          valueLabel:'3h24:00',   distanceKm:42.195,date:'2023-04-23', source:'Manual' },
  { id:'p4', sport:'Running', label:'Plus longue distance', recordType:'LongestDistance', valueLabel:'163 km', distanceKm:163, date:'2024-10-18', source:'Auto' },
  { id:'p5', sport:'Running', label:'Plus grand D+',  recordType:'HighestElevation',  valueLabel:'9 641 m',                     date:'2024-10-18', source:'Auto' },
  { id:'p6', sport:'Cycling', label:'Meilleure vitesse moy.', recordType:'BestSpeed', valueLabel:'38.4 km/h', distanceKm:120,   date:'2024-07-06', source:'Auto' },
  { id:'p7', sport:'Running', label:'Meilleure allure', recordType:'BestPace',        valueLabel:'3:48/km',   distanceKm:5,     date:'2023-09-30', source:'Auto' },
]

// ── Atomes UI ─────────────────────────────────────────────────────────────────
function SegmentButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center rounded-[10px] border"
      style={{
        height: 42, fontSize: 11, fontWeight: 700, cursor: 'pointer',
        backgroundColor: selected ? `${colors.chargeOrange}2B` : colors.surface,
        borderColor:     selected ? colors.chargeOrange : colors.border,
        color:           selected ? colors.chargeOrange : colors.subtleText,
      }}
    >
      {label}
    </button>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 rounded-[10px] px-[8px] py-[6px] text-center" style={{ backgroundColor: colors.surface }}>
      <p className="text-h2 font-bold font-data tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] text-trail-muted mt-[2px]">{label}</p>
    </div>
  )
}

function MetricTile({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-[10px] px-[10px] py-[8px] flex-shrink-0" style={{ backgroundColor: colors.surface }}>
      <p className="text-micro text-trail-muted">{label}</p>
      <div className="flex items-baseline gap-[3px] mt-[2px]">
        <span className="text-[17px] font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-micro text-trail-muted">{unit}</span>}
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: RecordSource }) {
  const color = source === 'Auto' ? colors.seriesBlue : colors.seriesYellow
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold"
      style={{ backgroundColor: `${color}26`, color, border: `1px solid ${color}4D` }}
    >
      {source === 'Auto' ? 'Auto' : 'Manuel'}
    </span>
  )
}

function RecordFilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-3 py-[5px] border text-caption font-semibold"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}26` : colors.surface,
        borderColor:     active ? colors.chargeOrange : colors.border,
        color:           active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-[6px] border text-body-sm font-semibold"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
        borderColor:     active ? colors.chargeOrange : colors.border,
        color:           active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function FilterIconChip({
  label, active, onClick, icon, color,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  color?: string
}) {
  const accent = color ?? colors.chargeOrange
  return (
    <button
      onClick={onClick}
      className="rounded-full border text-caption font-semibold flex items-center gap-[5px] flex-shrink-0"
      style={{
        backgroundColor: active ? `${accent}26` : 'transparent',
        borderColor:     active ? accent : colors.border,
        color:           active ? accent : colors.subtleText,
        cursor: 'pointer',
        padding: '4px 10px 4px 6px',
      }}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span>{label}</span>
    </button>
  )
}

function SortButtons({
  field, activeField, activeDir, onSort,
}: {
  field:       SortField
  activeField: SortField
  activeDir:   SortDir
  onSort:      (f: SortField, d: SortDir) => void
}) {
  const upActive   = activeField === field && activeDir === 'asc'
  const downActive = activeField === field && activeDir === 'desc'
  const btn = (dir: SortDir, symbol: string, active: boolean) => (
    <button
      onClick={() => onSort(field, dir)}
      className="w-8 h-8 flex items-center justify-center rounded-[6px] border text-body"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}26` : colors.surface,
        borderColor:     active ? colors.chargeOrange : colors.border,
        color:           active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {symbol}
    </button>
  )
  return (
    <div className="flex gap-1 flex-shrink-0">
      {btn('asc',  '↑', upActive)}
      {btn('desc', '↓', downActive)}
    </div>
  )
}

const inputCls = 'rounded-[8px] border px-3 py-[5px] text-body-sm flex-1 min-w-0'
const dateInputCls = 'rounded-[8px] border px-2 py-[5px] text-body-sm flex-1 min-w-0'

function inputStyle() {
  return {
    backgroundColor: colors.surface,
    borderColor:     colors.border,
    color:           colors.text,
    outline:         'none',
    colorScheme:     'dark' as const,
  }
}

function FilterRow({
  label, left, right, sortField, activeField, activeDir, onSort,
}: {
  label:       string
  left:        React.ReactNode
  right:       React.ReactNode
  sortField:   SortField
  activeField: SortField
  activeDir:   SortDir
  onSort:      (f: SortField, d: SortDir) => void
}) {
  const A = useT().activities
  return (
    <div>
      <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-micro text-trail-muted shrink-0 mr-1">{A.fromLabel}</span>
        {left}
        <span className="text-micro text-trail-muted shrink-0 mx-1">{A.toLabel}</span>
        {right}
        <SortButtons field={sortField} activeField={activeField} activeDir={activeDir} onSort={onSort} />
      </div>
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12L12 19M5 12L12 5"
        stroke={colors.subtleText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Ligne course passée — format "colonnes alignées" (Mockup C) ───────────────
function PastRaceCard({ activity, onClick }: { activity: ActivityRow; onClick: () => void }) {
  const distanceM  = activity.manual_distance_m       ?? activity.distance_m
  const elevation  = activity.manual_elevation_gain_m ?? activity.elevation_gain_m
  const duration   = activity.manual_moving_time_sec  ?? activity.moving_time_sec

  const hasDist = distanceM != null
  const hasElev = elevation != null && elevation > 0
  const hasDur  = duration != null && duration > 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left py-[10px] px-1 border-b border-trail-border last:border-0"
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body font-semibold text-trail-text truncate flex-1 min-w-0">{activity.name}</p>
        <span className="text-caption flex-shrink-0" style={{ color: colors.subtleText }}>
          {fmtDateShort(activity.start_time)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-[4px]">
        <div className="flex items-baseline gap-1">
          <span className="text-body-sm font-bold text-trail-text">{hasDist ? fmt1(distanceM! / 1000) : '—'}</span>
          {hasDist && <span className="text-micro text-trail-muted">km</span>}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-body-sm font-bold text-trail-text">{hasElev ? Math.round(elevation!).toString() : '—'}</span>
          {hasElev && <span className="text-micro text-trail-muted">m D+</span>}
        </div>
        <div>
          <span className="text-body-sm font-bold text-trail-text">{hasDur ? fmtChrono(duration) : '—'}</span>
        </div>
      </div>
    </button>
  )
}

// ── Panneau Recherche ─────────────────────────────────────────────────────────
const SEARCH_RENDER_BATCH = 50

function SearchPanel({ state, setState, activities, onClose, onNavigate, onReset }: {
  state:      SearchState
  setState:   (s: SearchState) => void
  activities: ActivityRow[]
  onClose:    () => void
  onNavigate: (id: string) => void
  onReset:    () => void
}) {
  const A = useT().activities
  const FIELDS: SearchField[] = ['Titre', 'Distance', 'Durée', 'D+']
  const FIELD_LABELS: Record<SearchField, string> = {
    Titre:    A.fieldTitle,
    Distance: A.distanceLabel,
    Durée:    A.durationLabel,
    'D+':     A.dPlusLabel,
  }
  const si = inputStyle()
  const [visibleCount, setVisibleCount] = useState(SEARCH_RENDER_BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasInput = state.title.trim() !== ''
    || state.distFrom !== '' || state.distTo !== ''
    || state.durFrom  !== '' || state.durTo  !== ''
    || state.dPlusFrom !== '' || state.dPlusTo !== ''

  const results = useMemo(
    () => hasInput ? applySearch(activities, state) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, state.field, state.title, state.distFrom, state.distTo,
     state.durFrom, state.durTo, state.dPlusFrom, state.dPlusTo, hasInput],
  )

  useEffect(() => { setVisibleCount(SEARCH_RENDER_BATCH) }, [
    state.field, state.title, state.distFrom, state.distTo,
    state.durFrom, state.durTo, state.dPlusFrom, state.dPlusTo,
  ])

  useEffect(() => {
    if (visibleCount >= results.length) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(c => Math.min(c + SEARCH_RENDER_BATCH, results.length))
      }
    }, { rootMargin: '600px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, results.length])

  const visibleResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.background }}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text font-display">{A.headerSearch}</span>
        </button>
        <button
          onClick={onClose}
          className="text-body font-bold"
          style={{ color: colors.chargeOrange, cursor: 'pointer' }}
        >
          {A.apply}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg md:max-w-4xl mx-auto w-full space-y-3">
        <div
          className="rounded-[12px] border p-4 space-y-4"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-body font-semibold text-trail-text">{A.searchByLabel}</p>

          <div className="flex gap-2 flex-wrap">
            {FIELDS.map(f => (
              <Chip key={f} label={FIELD_LABELS[f]} active={state.field === f}
                onClick={() => setState({ ...state, field: f })} />
            ))}
          </div>

          {state.field === 'Titre' && (
            <div>
              <p className="text-caption text-trail-muted mb-1">{A.searchTitleLabel}</p>
              <input
                autoFocus
                type="text"
                value={state.title}
                onChange={e => setState({ ...state, title: e.target.value })}
                className="rounded-[8px] border px-3 py-2 text-body w-full"
                style={si}
              />
            </div>
          )}

          {state.field === 'Distance' && (
            <div className="space-y-2">
              <p className="text-caption text-trail-muted">{A.searchDistanceLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{A.fromLabel}</span>
                <input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{A.toLabel}</span>
                <input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'Durée' && (
            <div className="space-y-2">
              <p className="text-caption text-trail-muted">{A.searchDurationLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{A.fromLabel}</span>
                <input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{A.toLabel}</span>
                <input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'D+' && (
            <div className="space-y-2">
              <p className="text-caption text-trail-muted">{A.searchElevationLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{A.fromLabel}</span>
                <input type="text" value={state.dPlusFrom} onChange={e => setState({ ...state, dPlusFrom: e.target.value })} placeholder="m" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{A.toLabel}</span>
                <input type="text" value={state.dPlusTo}   onChange={e => setState({ ...state, dPlusTo: e.target.value })}   placeholder="m" className={inputCls} style={si} />
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full py-2 rounded-[10px] border text-body-sm font-semibold"
            style={{ borderColor: colors.border, color: colors.subtleText, backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            {A.reset}
          </button>
        </div>

        {hasInput && (
          <>
            <p className="text-body-sm text-trail-muted px-1">{A.resultsCount(results.length)}</p>
            {results.length === 0 ? (
              <div
                className="rounded-[12px] border p-[10px]"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
              >
                <p className="text-body-sm" style={{ color: colors.subtleText }}>{A.noRaceFound}</p>
              </div>
            ) : (
              <div>
                {visibleResults.map(a => <PastRaceCard key={a.id} activity={a} onClick={() => onNavigate(a.id)} />)}
                {visibleCount < results.length && (
                  <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                    <span className="text-caption" style={{ color: colors.subtleText }}>…</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Panneau Filtre (sans type d'entraînement) ──────────────────────────────────
function FilterPanel({ state, setState, sportTypes, onClose, onReset }: {
  state:      FilterState
  setState:   (s: FilterState) => void
  sportTypes: string[]
  onClose:    () => void
  onReset:    () => void
}) {
  const t = useT()
  const sportLabel = t.sportLabel
  const A = t.activities
  const si = inputStyle()

  const handleSort = (field: SortField, dir: SortDir) =>
    setState({ ...state, sortField: field, sortDir: dir })

  const af = state.sortField
  const ad = state.sortDir

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: colors.background }}>
      <div
        className="flex items-center px-4 py-2 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text font-display">{A.headerFilter}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 max-w-lg md:max-w-4xl mx-auto w-full space-y-2">
        <div
          className="rounded-[12px] border p-3 space-y-3"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-body font-bold text-trail-text">{A.sortFilterTitle}</p>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{A.activityFieldLabel}</p>
            <div className="flex items-center gap-2">
              <select
                value={state.sport}
                onChange={e => setState({ ...state, sport: e.target.value })}
                className="rounded-[8px] border px-3 py-[5px] text-body-sm flex-1"
                style={{ ...si, cursor: 'pointer' }}
              >
                <option value="Toutes">{A.allOption}</option>
                {sportTypes.map(s => (
                  <option key={s} value={s}>{sportLabel[s] ?? s}</option>
                ))}
              </select>
              <SortButtons field="sport" activeField={af} activeDir={ad} onSort={handleSort} />
            </div>
          </div>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{A.distanceTypeLabel}</p>
            <div className="flex gap-[6px] overflow-x-auto pb-1">
              {DISTANCE_TYPE_OPTIONS.map(opt => (
                <FilterIconChip
                  key={opt.key}
                  label={opt.label}
                  active={state.distanceType === opt.key}
                  onClick={() => setState({ ...state, distanceType: opt.key })}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{A.dateLabel}</p>
            <div className="flex items-center gap-2">
              <span className="text-micro text-trail-muted shrink-0 mr-1">{A.fromLabel}</span>
              <input
                type="date"
                value={state.dateFrom}
                onChange={e => setState({ ...state, dateFrom: e.target.value })}
                className={dateInputCls}
                style={si}
              />
              <span className="text-micro text-trail-muted shrink-0 mx-1">{A.toLabel}</span>
              <input
                type="date"
                value={state.dateTo}
                onChange={e => setState({ ...state, dateTo: e.target.value })}
                className={dateInputCls}
                style={si}
              />
              <SortButtons field="date" activeField={af} activeDir={ad} onSort={handleSort} />
            </div>
          </div>

          <FilterRow
            label={A.distanceLabel}
            left={<input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />}
            right={<input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />}
            sortField="distance" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={A.paceLabel}
            left={<input type="text" value={state.paceFrom} onChange={e => setState({ ...state, paceFrom: e.target.value })} placeholder="mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.paceTo}   onChange={e => setState({ ...state, paceTo: e.target.value })}   placeholder="mm:ss" className={inputCls} style={si} />}
            sortField="pace" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={A.durationLabel}
            left={<input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />}
            sortField="duration" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={A.dPlusLabel}
            left={<input type="text" value={state.dPlusFrom} onChange={e => setState({ ...state, dPlusFrom: e.target.value })} placeholder="m" className={inputCls} style={si} />}
            right={<input type="text" value={state.dPlusTo}   onChange={e => setState({ ...state, dPlusTo: e.target.value })}   placeholder="m" className={inputCls} style={si} />}
            sortField="dplus" activeField={af} activeDir={ad} onSort={handleSort}
          />
        </div>

        <div className="flex gap-3 pb-4">
          <button
            onClick={onReset}
            className="flex-1 py-3 rounded-[12px] border text-body font-semibold"
            style={{ borderColor: colors.border, color: colors.subtleText, backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            {A.reset}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-[12px] text-body font-bold"
            style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
          >
            {A.apply}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carte Prochaine course ─────────────────────────────────────────────────────
function UpcomingRaceCard({ race, onClick }: { race: Race; onClick: () => void }) {
  const d = daysUntil(race.date)
  const jLabel = d === 0 ? "J" : d > 0 ? `J-${d}` : `J+${-d}`
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[12px] border p-[10px] text-left"
      style={{ backgroundColor: colors.cardBg, borderColor: colors.border, cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-trail-text truncate">{race.name}</p>
          <p className="text-caption text-trail-muted mt-[2px]">
            {fmtDateLong(race.date)}{race.location ? ` · ${race.location}` : ''}
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2 py-[3px] text-caption font-bold flex-shrink-0"
          style={{
            backgroundColor: `${colors.chargeOrange}26`,
            color: colors.chargeOrange,
            border: `1px solid ${colors.chargeOrange}4D`,
          }}
        >
          {jLabel}
        </span>
      </div>
      <div className="flex gap-[6px]">
        <MetricTile label="Distance"  value={fmt1(race.distance)} unit="km" color={colors.chargeOrange} />
        <MetricTile label="D+"        value={race.elevation > 0 ? race.elevation.toString() : '—'} unit="m" color={colors.chargeOrange} />
        {race.isMain && (
          <div className="rounded-[10px] px-[10px] py-[8px] flex-shrink-0" style={{ backgroundColor: colors.surface }}>
            <p className="text-micro text-trail-muted">Objectif</p>
            <span className="text-body font-bold" style={{ color: colors.seriesYellow }}>Principal</span>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Record card (vue Records, inchangée) ───────────────────────────────────────
function RecordCard({ record }: { record: PersonalRecord }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[4px]">
        <div className="flex items-center gap-[6px]">
          <span className="text-micro font-semibold" style={{ color: colors.chargeOrange }}>Record</span>
          <SourceBadge source={record.source} />
          <span className="text-micro text-trail-muted">{SPORT_LABEL[record.sport]}</span>
        </div>
        {record.date && <span className="text-micro text-trail-muted">{fmtDateLong(record.date)}</span>}
      </div>
      <p className="text-body font-semibold text-trail-text mb-[6px]">{record.label}</p>
      <div className="flex gap-[6px]">
        <MetricTile label={record.label} value={record.valueLabel} unit="" color={colors.chargeOrange} />
        {record.distanceKm && (
          <MetricTile label="Distance" value={fmt1(record.distanceKm)} unit="km" color={colors.subtleText} />
        )}
      </div>
    </div>
  )
}

function RecordsView({ records }: { records: PersonalRecord[] }) {
  const t = useT()
  const A = t.activities
  const RECORD_FILTER_LABELS: Record<RecordFilter, string> = A.raceRecordsFilters
  const [filter, setFilter] = useState<RecordFilter>('All')

  const filtered = useMemo(() => {
    if (filter === 'All') return records
    if (filter === 'Distance') return records.filter(r => r.distanceKm != null)
    if (filter === 'Global')   return records.filter(r => r.recordType === 'LongestDistance' || r.recordType === 'HighestElevation' || r.recordType === 'BestSpeed' || r.recordType === 'BestPace')
    if (filter === 'Manual')   return records.filter(r => r.source === 'Manual')
    return records
  }, [records, filter])

  const autoCount = records.filter(r => r.source === 'Auto').length

  return (
    <div className="space-y-3">
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex gap-2">
          <SummaryPill label={A.raceRecordsTotal} value={records.length.toString()} color={colors.chargeOrange} />
          <SummaryPill label={A.raceRecordsAuto}  value={autoCount.toString()}      color={colors.seriesBlue} />
          <SummaryPill label={A.raceRecordsSports} value="3"                        color={colors.seriesYellow} />
        </div>
      </div>

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[15px] font-bold text-trail-text mb-[10px] font-display">{A.raceRecordsTitle}</p>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-[10px]">
          {(Object.keys(RECORD_FILTER_LABELS) as RecordFilter[]).map(f => (
            <RecordFilterChip key={f} label={RECORD_FILTER_LABELS[f]} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-body-sm text-trail-muted">{A.raceRecordsEmpty}</p>
        ) : (
          <div className="space-y-[10px]">
            {filtered.map(r => <RecordCard key={r.id} record={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
const RENDER_BATCH = 50
const DEFAULT_ORDER = ['upcoming-races', 'summary', 'past-races']

type AthleteHrProfile = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
  hr_zone_method?:      string | null
  hr_zones_custom?:     { zone: number; min: number | null; max: number | null }[] | null
} | null

export default function CoursesClient({
  initial,
  hasMore,
  athleteProfile,
}: {
  initial:        ActivityRow[]
  hasMore:        boolean
  athleteProfile: AthleteHrProfile
}) {
  const router = useRouter()
  const L = useT().activities
  const [view, setView] = useState<'Races' | 'Records'>('Races')
  const [activities, setActivities] = useState<ActivityRow[]>(initial)
  const [upcomingRaces, setUpcomingRaces] = useState<Race[]>([])
  const [hrZones, setHrZones] = useState<HrZone[]>([])
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null)

  // Charge en background les activités plus anciennes que le dernier reçu en SSR,
  // pour ne manquer aucune course si l'historique dépasse la limite initiale.
  useEffect(() => {
    if (!hasMore) return
    const oldest = initial[initial.length - 1]?.start_time
    if (!oldest) return
    let cancelled = false
    fetch(`/api/activities?olderThan=${encodeURIComponent(oldest)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((body: { activities: ActivityRow[] }) => {
        if (cancelled) return
        setActivities(curr => [...curr, ...body.activities])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [hasMore, initial])

  const [panel,  setPanel]  = useState<'none' | 'search' | 'filter'>('none')
  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH)
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const [visibleCount, setVisibleCount] = useState<number>(RENDER_BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Sélection : ne garder que les activités effectivement taguées "course".
  const courseActivities = useMemo(() => {
    return activities.filter(a => {
      const sport = a.manual_sport_type ?? a.sport_type
      return effectiveWorkoutType(a.manual_workout_type, a.name, sport) === 'course'
    })
  }, [activities])

  useEffect(() => {
    if (!athleteProfile) return
    try {
      const method = (athleteProfile.hr_zone_method
        ?? localStorage.getItem('tc_hr_zone_method')
        ?? 'pct_max') as HrZoneMethod
      setHrZones(calculateHrZones({
        method,
        maxHr:              athleteProfile.max_hr,
        restingHr:          athleteProfile.resting_hr,
        aerobicThresholdHr: athleteProfile.aerobic_threshold_hr,
        thresholdHr:        athleteProfile.threshold_hr,
        birthYear:          athleteProfile.birth_year,
        customZones:        athleteProfile.hr_zones_custom,
      }).zones)
    } catch {}
  }, [athleteProfile])

  useEffect(() => {
    let cancelled = false
    getRaces()
      .then(list => {
        if (cancelled) return
        const today = todayISO()
        const upcoming = list
          .filter(r => r.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
        setUpcomingRaces(upcoming)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const savedSearch = sessionStorage.getItem('tc_courses_search')
    const savedFilter = sessionStorage.getItem('tc_courses_filter')
    const savedPanel  = sessionStorage.getItem('tc_courses_panel')
    if (savedSearch) {
      try { setSearch(JSON.parse(savedSearch)) } catch {}
    }
    if (savedFilter) {
      try { setFilter(JSON.parse(savedFilter)) } catch {}
    }
    if (savedPanel === 'search' || savedPanel === 'filter') {
      setPanel(savedPanel)
    }
  }, [])

  function persistAndNavigateActivity(id: string) {
    sessionStorage.setItem('tc_courses_search', JSON.stringify(search))
    sessionStorage.setItem('tc_courses_filter', JSON.stringify(filter))
    sessionStorage.setItem('tc_courses_panel',  panel)
    router.push(`/activities/${id}`)
  }

  function handleSaved(updated: ActivityRow) {
    setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditingActivity(null)
  }

  function handleDeleted(id: string) {
    setActivities(prev => prev.filter(a => a.id !== id))
    setEditingActivity(null)
  }

  const sportTypes = useMemo(() => {
    const seen = new Set<string>()
    for (const a of courseActivities) seen.add(normalizeSportType(a.sport_type))
    return Array.from(seen).sort()
  }, [courseActivities])

  const filtered = useMemo(() => {
    let list = applySearch([...courseActivities], search)

    if (filter.sport !== 'Toutes') {
      list = list.filter(a => normalizeSportType(a.sport_type) === filter.sport)
    }
    if (filter.distanceType !== 'Toutes') {
      list = list.filter(a => {
        const distM = a.manual_distance_m ?? a.distance_m
        const km = distM != null ? distM / 1000 : null
        return matchesDistanceType(km, filter.distanceType)
      })
    }
    const dateFrom = parseDate(filter.dateFrom)
    const dateTo   = parseDate(filter.dateTo)
    if (dateFrom) list = list.filter(a => new Date(a.start_time) >= dateFrom)
    if (dateTo)   list = list.filter(a => new Date(a.start_time) <= dateTo)
    const distFrom = parseFloat(filter.distFrom)
    const distTo   = parseFloat(filter.distTo)
    if (!isNaN(distFrom)) list = list.filter(a => a.distance_m != null && a.distance_m / 1000 >= distFrom)
    if (!isNaN(distTo))   list = list.filter(a => a.distance_m != null && a.distance_m / 1000 <= distTo)
    const paceFrom = parsePaceSec(filter.paceFrom)
    const paceTo   = parsePaceSec(filter.paceTo)
    if (paceFrom != null) list = list.filter(a => { const p = getPaceSec(a); return p != null && p >= paceFrom })
    if (paceTo   != null) list = list.filter(a => { const p = getPaceSec(a); return p != null && p <= paceTo })
    const durFrom = parseDurSec(filter.durFrom)
    const durTo   = parseDurSec(filter.durTo)
    if (durFrom != null) list = list.filter(a => a.moving_time_sec != null && a.moving_time_sec >= durFrom)
    if (durTo   != null) list = list.filter(a => a.moving_time_sec != null && a.moving_time_sec <= durTo)
    const dpFrom = parseFloat(filter.dPlusFrom)
    const dpTo   = parseFloat(filter.dPlusTo)
    if (!isNaN(dpFrom)) list = list.filter(a => a.elevation_gain_m != null && a.elevation_gain_m >= dpFrom)
    if (!isNaN(dpTo))   list = list.filter(a => a.elevation_gain_m != null && a.elevation_gain_m <= dpTo)

    const dir = filter.sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (filter.sortField) {
        case 'date':     return dir * a.start_time.localeCompare(b.start_time)
        case 'distance': return dir * ((a.distance_m ?? 0) - (b.distance_m ?? 0))
        case 'pace':     return dir * ((getPaceSec(a) ?? Infinity) - (getPaceSec(b) ?? Infinity))
        case 'duration': return dir * ((a.moving_time_sec ?? 0) - (b.moving_time_sec ?? 0))
        case 'dplus':    return dir * ((a.elevation_gain_m ?? 0) - (b.elevation_gain_m ?? 0))
        case 'sport':    return dir * normalizeSportType(a.sport_type).localeCompare(normalizeSportType(b.sport_type))
        default:         return 0
      }
    })

    return list
  }, [courseActivities, search, filter])

  useEffect(() => { setVisibleCount(RENDER_BATCH) }, [search, filter])

  useEffect(() => {
    if (visibleCount >= filtered.length) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(c => Math.min(c + RENDER_BATCH, filtered.length))
      }
    }, { rootMargin: '600px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, filtered.length])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  const hasActiveSearch = search.title.trim() !== ''
    || search.distFrom !== '' || search.distTo !== ''
    || search.durFrom  !== '' || search.durTo  !== ''
    || search.dPlusFrom !== '' || search.dPlusTo !== ''

  const hasActiveFilter = filter.sport !== 'Toutes'
    || filter.distanceType !== 'Toutes'
    || filter.dateFrom !== '' || filter.dateTo !== ''
    || filter.distFrom !== '' || filter.distTo !== ''
    || filter.paceFrom !== '' || filter.paceTo !== ''
    || filter.durFrom  !== '' || filter.durTo  !== ''
    || filter.dPlusFrom !== '' || filter.dPlusTo !== ''

  const totalKm  = courseActivities.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
  const maxDPlus = courseActivities.reduce((m, a) => Math.max(m, a.elevation_gain_m ?? 0), 0)
  const lastDate = courseActivities[0]?.start_time
    ? fmtDateShort(courseActivities[0].start_time)
    : '—'

  // ── Blocs draggable / maskable ────────────────────────────────────────────
  const blocks: BlockDef[] = [
    {
      id: 'upcoming-races',
      label: L.upcomingRaces,
      emoji: '🏁',
      render: () => (
        <BlockCard
          title={L.upcomingRaces}
          helpTitle={L.upcomingRaces}
          helpBody={L.upcomingRacesHelp}
          titleClassName="text-[15px] font-semibold text-trail-text font-display"
        >
          {upcomingRaces.length === 0 ? (
            <p className="text-body-sm text-trail-muted">{L.noRacePlanned}</p>
          ) : (
            <div className="space-y-[10px]">
              {upcomingRaces.map(r => (
                <UpcomingRaceCard key={r.id} race={r} onClick={() => router.push(`/plan/courses/${r.id}`)} />
              ))}
            </div>
          )}
        </BlockCard>
      ),
    },
    {
      id: 'summary',
      label: L.summary,
      emoji: '📊',
      render: () => (
        <BlockCard
          title={L.summary}
          helpTitle={L.summary}
          helpBody={L.summaryHelp}
        >
          <div className="flex gap-2">
            <SummaryPill label={L.racesSummaryRaces}   value={courseActivities.length.toString()} color={colors.chargeOrange} />
            <SummaryPill label={L.racesSummaryTotalKm} value={Math.round(totalKm).toString()}     color={colors.seriesBlue} />
            <SummaryPill label={L.racesSummaryLastDate} value={lastDate}                          color={colors.greenOk} />
            <SummaryPill label={L.racesSummaryMaxDPlus} value={`${Math.round(maxDPlus)} m`}       color={colors.seriesYellow} />
          </div>
        </BlockCard>
      ),
    },
    {
      id: 'past-races',
      label: L.raceTabRaces,
      emoji: '🏆',
      render: () => (
        <BlockCard
          title={L.racesList}
          helpTitle={L.racesList}
          helpBody={L.racesListHelp}
        >
          <div
            className="rounded-[12px] border flex items-center mb-[10px]"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.border, padding: '4px 6px' }}
          >
            <button
              onClick={() => setPanel('search')}
              className="flex-1 flex items-center gap-2 px-[10px] py-3"
              style={{ cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke={hasActiveSearch ? colors.chargeOrange : colors.subtleText} strokeWidth="2" />
                <path d="M16.5 16.5L21 21" stroke={hasActiveSearch ? colors.chargeOrange : colors.subtleText} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-body" style={{ color: hasActiveSearch ? colors.chargeOrange : colors.subtleText }}>
                {L.headerSearch}
              </span>
            </button>

            <div className="w-px" style={{ height: 28, backgroundColor: colors.border }} />

            <button
              onClick={() => setPanel('filter')}
              className="px-[14px] py-3"
              style={{ cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke={hasActiveFilter ? colors.chargeOrange : colors.subtleText}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {(hasActiveSearch || hasActiveFilter) && (
            <p className="text-body-sm text-trail-muted px-1 mb-[6px]">
              {L.resultsCount(filtered.length)}
            </p>
          )}

          {filtered.length === 0 ? (
            <p className="text-body-sm text-trail-muted">
              {courseActivities.length === 0
                ? L.noRaceLogged
                : L.noRaceMatch}
            </p>
          ) : (
            <div>
              {visible.map(a => (
                <PastRaceCard key={a.id} activity={a} onClick={() => persistAndNavigateActivity(a.id)} />
              ))}
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                  <span className="text-caption" style={{ color: colors.subtleText }}>…</span>
                </div>
              )}
            </div>
          )}
        </BlockCard>
      ),
    },
  ]

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg md:max-w-4xl mx-auto">
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[6px]">
        <div className="flex gap-2">
          <SegmentButton label={L.raceTabRaces}    selected={view === 'Races'}   onClick={() => setView('Races')} />
          <SegmentButton label={L.raceRecordsTab}  selected={view === 'Records'} onClick={() => setView('Records')} />
        </div>
      </div>

      {view === 'Races' ? (
        <BlockGrid storageKey="courses" defaultOrder={DEFAULT_ORDER} blocks={blocks} />
      ) : (
        <div
          className="rounded-[12px] border p-8 flex flex-col items-center justify-center text-center"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border, minHeight: 200 }}
        >
          <span className="text-[32px] mb-3">🏆</span>
          <p className="text-[16px] font-bold text-trail-text mb-2 font-display">Records</p>
          <p className="text-body" style={{ color: colors.subtleText }}>Bientôt disponible</p>
        </div>
      )}

      {panel === 'search' && (
        <SearchPanel
          state={search}
          setState={setSearch}
          activities={courseActivities}
          onClose={() => setPanel('none')}
          onNavigate={persistAndNavigateActivity}
          onReset={() => {
            sessionStorage.removeItem('tc_courses_search')
            sessionStorage.removeItem('tc_courses_panel')
            setSearch(DEFAULT_SEARCH)
            setPanel('none')
          }}
        />
      )}
      {panel === 'filter' && (
        <FilterPanel
          state={filter}
          setState={setFilter}
          sportTypes={sportTypes}
          onClose={() => setPanel('none')}
          onReset={() => {
            sessionStorage.removeItem('tc_courses_search')
            sessionStorage.removeItem('tc_courses_filter')
            setFilter(DEFAULT_FILTER)
            setPanel('none')
          }}
        />
      )}

      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          hrZones={hrZones}
          onSaved={handleSaved}
          onDeleted={() => handleDeleted(editingActivity.id)}
          onClose={() => setEditingActivity(null)}
        />
      )}
    </div>
  )
}
