'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityCard, ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'
import {
  INTENSITY_OPTIONS,
  WORKOUT_TYPE_OPTIONS,
  effectiveWorkoutType,
  guessIntensity,
  intensityWithWorkoutFloor,
  type IntensityKey,
  type WorkoutType,
} from '@/lib/activities/intensity'
import {
  INTENSITY_KEY_TO_LEVEL,
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
  SESSION_TYPE_COLORS,
  SESSION_TYPE_LABELS,
} from '@/lib/activities/indicators'
import { IntensityGauge, TypeIcon, UnknownTypeIcon } from '@/components/activity/indicatorIcons'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'

// ── Types ──────────────────────────────────────────────────────────────────────
type SearchField = 'Titre' | 'Distance' | 'Durée' | 'D+'
type SortField = 'sport' | 'date' | 'distance' | 'pace' | 'duration' | 'dplus'
type SortDir = 'asc' | 'desc'

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
  sport:       string
  intensity:   string
  workoutType: string
  dateFrom:    string  // YYYY-MM-DD (from <input type="date">)
  dateTo:    string
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
  intensity: 'Toutes',
  workoutType: 'Toutes',
  dateFrom: '', dateTo: '',
  distFrom: '', distTo: '',
  paceFrom: '', paceTo: '',
  durFrom: '', durTo: '',
  dPlusFrom: '', dPlusTo: '',
  sortField: 'date', sortDir: 'desc',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// TrailRun is grouped with Run under the "Course" label in the Activités tab.
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

// YYYY-MM-DD from <input type="date">
function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return new Date(`${s}T00:00:00`)
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

// ── Small UI atoms ─────────────────────────────────────────────────────────────
function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12L12 19M5 12L12 5"
        stroke={colors.subtleText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        cursor:          'pointer',
      }}
    >
      {label}
    </button>
  )
}

// Chip that pairs an SVG icon with a label. Used in the filter panel to mirror
// the visual identity of the activity-card mini indicators.
function FilterChip({
  label,
  active,
  onClick,
  icon,
  color,
}: {
  label:    string
  active:   boolean
  onClick:  () => void
  icon?:    React.ReactNode
  color?:   string
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
        cursor:          'pointer',
        padding:         '4px 10px 4px 6px',
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
        cursor:          'pointer',
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
  const L = useT().activities
  return (
    <div>
      <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-micro text-trail-muted shrink-0 mr-1">{L.fromLabel}</span>
        {left}
        <span className="text-micro text-trail-muted shrink-0 mx-1">{L.toLabel}</span>
        {right}
        <SortButtons field={sortField} activeField={activeField} activeDir={activeDir} onSort={onSort} />
      </div>
    </div>
  )
}

// ── Search Panel ───────────────────────────────────────────────────────────────
const SEARCH_RENDER_BATCH = 50

function SearchPanel({ state, setState, activities, onClose, onNavigate, onReset }: {
  state:      SearchState
  setState:   (s: SearchState) => void
  activities: ActivityRow[]
  onClose:    () => void
  onNavigate: (id: string) => void
  onReset:    () => void
}) {
  const L = useT().activities
  const FIELDS: SearchField[] = ['Titre', 'Distance', 'Durée', 'D+']
  const fieldLabel = (f: SearchField): string => (
    f === 'Titre'    ? L.fieldTitle :
    f === 'Distance' ? L.distanceLabel :
    f === 'Durée'    ? L.durationLabel :
                       L.dPlusLabel
  )
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
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text font-display">{L.headerSearch}</span>
        </button>
        <button
          onClick={onClose}
          className="text-body font-bold"
          style={{ color: colors.chargeOrange, cursor: 'pointer' }}
        >
          {L.apply}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg md:max-w-4xl mx-auto w-full space-y-3">

        {/* Search card */}
        <div
          className="rounded-[12px] border p-4 space-y-4"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-body font-semibold text-trail-text">{L.searchByLabel}</p>

          <div className="flex gap-2 flex-wrap">
            {FIELDS.map(f => (
              <Chip key={f} label={fieldLabel(f)} active={state.field === f}
                onClick={() => setState({ ...state, field: f })} />
            ))}
          </div>

          {state.field === 'Titre' && (
            <div>
              <p className="text-caption text-trail-muted mb-1">{L.searchTitleLabel}</p>
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
              <p className="text-caption text-trail-muted">{L.searchDistanceLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{L.fromLabel}</span>
                <input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{L.toLabel}</span>
                <input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'Durée' && (
            <div className="space-y-2">
              <p className="text-caption text-trail-muted">{L.searchDurationLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{L.fromLabel}</span>
                <input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{L.toLabel}</span>
                <input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'D+' && (
            <div className="space-y-2">
              <p className="text-caption text-trail-muted">{L.searchElevationLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-micro text-trail-muted">{L.fromLabel}</span>
                <input type="text" value={state.dPlusFrom} onChange={e => setState({ ...state, dPlusFrom: e.target.value })} placeholder="m" className={inputCls} style={si} />
                <span className="text-micro text-trail-muted">{L.toLabel}</span>
                <input type="text" value={state.dPlusTo}   onChange={e => setState({ ...state, dPlusTo: e.target.value })}   placeholder="m" className={inputCls} style={si} />
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full py-2 rounded-[10px] border text-body-sm font-semibold"
            style={{ borderColor: colors.border, color: colors.subtleText, backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            {L.reset}
          </button>
        </div>

        {/* Live results */}
        {hasInput && (
          <>
            <p className="text-body-sm text-trail-muted px-1">{L.resultsCount(results.length)}</p>
            {results.length === 0 ? (
              <div
                className="rounded-[12px] border p-[10px]"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
              >
                <p className="text-body-sm" style={{ color: colors.subtleText }}>{L.noResults}</p>
              </div>
            ) : (
              <div className="space-y-[10px]">
                {visibleResults.map(a => <ActivityCard key={a.id} activity={a} onClick={() => onNavigate(a.id)} />)}
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

// ── Filter Panel ───────────────────────────────────────────────────────────────
function FilterPanel({ state, setState, sportTypes, onClose, onReset }: {
  state:      FilterState
  setState:   (s: FilterState) => void
  sportTypes: string[]
  onClose:    () => void
  onReset:    () => void
}) {
  const t = useT()
  const sportLabel = t.sportLabel
  const L = t.activities
  const si = inputStyle()

  const handleSort = (field: SortField, dir: SortDir) =>
    setState({ ...state, sortField: field, sortDir: dir })

  const af = state.sortField
  const ad = state.sortDir

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Header — no Appliquer here */}
      <div
        className="flex items-center px-4 py-2 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text font-display">{L.headerFilter}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 max-w-lg md:max-w-4xl mx-auto w-full space-y-2">
        <div
          className="rounded-[12px] border p-3 space-y-3"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-body font-bold text-trail-text">{L.sortFilterTitle}</p>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{L.activityFieldLabel}</p>
            <div className="flex items-center gap-2">
              <select
                value={state.sport}
                onChange={e => setState({ ...state, sport: e.target.value })}
                className="rounded-[8px] border px-3 py-[5px] text-body-sm flex-1"
                style={{ ...si, cursor: 'pointer' }}
              >
                <option value="Toutes">{L.allOption}</option>
                {sportTypes.map(s => (
                  <option key={s} value={s}>{sportLabel[s] ?? s}</option>
                ))}
              </select>
              <SortButtons field="sport" activeField={af} activeDir={ad} onSort={handleSort} />
            </div>
          </div>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{L.intensityFieldLabel}</p>
            <div className="flex gap-[6px] overflow-x-auto pb-1">
              <FilterChip
                label={L.allOption}
                active={state.intensity === 'Toutes'}
                onClick={() => setState({ ...state, intensity: 'Toutes' })}
              />
              {INTENSITY_OPTIONS.map(opt => {
                const level = INTENSITY_KEY_TO_LEVEL[opt.key]
                return (
                  <FilterChip
                    key={opt.key}
                    label={L.intensityLevelLabels[level]}
                    color={INTENSITY_LEVEL_COLORS[level]}
                    icon={<IntensityGauge level={level} size={20} idSuffix={`flt-${opt.key}`} />}
                    active={state.intensity === opt.key}
                    onClick={() => setState({ ...state, intensity: opt.key })}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{L.sessionTypeFieldLabel}</p>
            <div className="flex gap-[6px] overflow-x-auto pb-1">
              <FilterChip
                label={L.allMascAria}
                active={state.workoutType === 'Toutes'}
                onClick={() => setState({ ...state, workoutType: 'Toutes' })}
              />
              {WORKOUT_TYPE_OPTIONS.map(opt => (
                <FilterChip
                  key={opt.value}
                  label={L.sessionTypeLabels[opt.value]}
                  color={SESSION_TYPE_COLORS[opt.value]}
                  icon={<TypeIcon type={opt.value} size={20} />}
                  active={state.workoutType === opt.value}
                  onClick={() => setState({ ...state, workoutType: opt.value })}
                />
              ))}
              <FilterChip
                label={L.sessionTypeUndefined}
                color="#6B7280"
                icon={<UnknownTypeIcon size={20} />}
                active={state.workoutType === '__none__'}
                onClick={() => setState({ ...state, workoutType: '__none__' })}
              />
            </div>
          </div>

          <div>
            <p className="text-body-sm font-semibold text-trail-text mb-[3px]">{L.dateLabel}</p>
            <div className="flex items-center gap-2">
              <span className="text-micro text-trail-muted shrink-0 mr-1">{L.fromLabel}</span>
              <input
                type="date"
                value={state.dateFrom}
                onChange={e => setState({ ...state, dateFrom: e.target.value })}
                className={dateInputCls}
                style={si}
              />
              <span className="text-micro text-trail-muted shrink-0 mx-1">{L.toLabel}</span>
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
            label={L.distanceLabel}
            left={<input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />}
            right={<input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />}
            sortField="distance" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={L.paceLabel}
            left={<input type="text" value={state.paceFrom} onChange={e => setState({ ...state, paceFrom: e.target.value })} placeholder="mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.paceTo}   onChange={e => setState({ ...state, paceTo: e.target.value })}   placeholder="mm:ss" className={inputCls} style={si} />}
            sortField="pace" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={L.durationLabel}
            left={<input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />}
            sortField="duration" activeField={af} activeDir={ad} onSort={handleSort}
          />

          <FilterRow
            label={L.dPlusLabel}
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
            {L.reset}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-[12px] text-body font-bold"
            style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
          >
            {L.apply}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
const RENDER_BATCH = 50

type AthleteHrProfile = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
  hr_zone_method?:      string | null
  hr_zones_custom?:     { zone: number; min: number | null; max: number | null }[] | null
} | null

export default function ActivitiesClient({
  initial,
  hasMore,
  athleteProfile,
  initialDate,
}: {
  initial:        ActivityRow[]
  hasMore:        boolean
  athleteProfile: AthleteHrProfile
  initialDate?:   string  // YYYY-MM-DD : filtre « sorties de ce jour » (depuis le Cockpit Mission)
}) {
  const L_main = useT().activities
  const [localActivities, setLocalActivities] = useState<ActivityRow[]>(initial)
  // Filtre jour exact (clé = YYYY-MM-DD comparée à start_time.slice(0,10)).
  // Indépendant du filtre date-range du panneau, et retirable via la bannière.
  const [dayFilter, setDayFilter] = useState<string | null>(initialDate ?? null)
  const [loadingMore,     setLoadingMore]     = useState<boolean>(hasMore)
  const [panel,           setPanel]           = useState<'none' | 'search' | 'filter'>('none')
  const [search,          setSearch]          = useState<SearchState>(DEFAULT_SEARCH)
  const [filter,          setFilter]          = useState<FilterState>(DEFAULT_FILTER)
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null)
  const [hrZones,         setHrZones]         = useState<HrZone[]>([])
  const [visibleCount,    setVisibleCount]    = useState<number>(RENDER_BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fetch in background the activities older than the last one received via SSR.
  // This keeps the initial paint fast while still loading the full history.
  useEffect(() => {
    if (!hasMore) return
    const oldest = initial[initial.length - 1]?.start_time
    if (!oldest) { setLoadingMore(false); return }

    let cancelled = false
    fetch(`/api/activities?olderThan=${encodeURIComponent(oldest)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((body: { activities: ActivityRow[] }) => {
        if (cancelled) return
        setLocalActivities(curr => [...curr, ...body.activities])
      })
      .catch(() => { /* swallow — UX gracefully degrades to initial 300 */ })
      .finally(() => { if (!cancelled) setLoadingMore(false) })

    return () => { cancelled = true }
  }, [hasMore, initial])

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
    const savedSearch = sessionStorage.getItem('tc_activities_search')
    const savedFilter = sessionStorage.getItem('tc_activities_filter')
    const savedPanel  = sessionStorage.getItem('tc_activities_panel')
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

  function navigateToActivity(id: string) {
    sessionStorage.setItem('tc_activities_search', JSON.stringify(search))
    sessionStorage.setItem('tc_activities_filter', JSON.stringify(filter))
    sessionStorage.setItem('tc_activities_panel',  panel)
    router.push(`/activities/${id}`)
  }

  function handleSaved(updated: ActivityRow) {
    setLocalActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditingActivity(null)
  }

  function handleDeleted(id: string) {
    setLocalActivities(prev => prev.filter(a => a.id !== id))
    setEditingActivity(null)
  }

  const sportTypes = useMemo(() => {
    const seen = new Set<string>()
    for (const a of localActivities) seen.add(normalizeSportType(a.sport_type))
    return Array.from(seen).sort()
  }, [localActivities])

  const filtered = useMemo(() => {
    let list = applySearch([...localActivities], search)

    if (dayFilter) list = list.filter(a => a.start_time.slice(0, 10) === dayFilter)

    if (filter.sport !== 'Toutes') {
      list = list.filter(a => normalizeSportType(a.sport_type) === filter.sport)
    }
    if (filter.intensity !== 'Toutes') {
      list = list.filter(a => {
        if (a.manual_intensity) return a.manual_intensity === filter.intensity
        const raw = guessIntensity(a.avg_hr, hrZones, {
          activityMaxHr: a.max_hr,
          movingTimeSec: a.manual_moving_time_sec ?? a.moving_time_sec,
        })
        const wt = effectiveWorkoutType(a.manual_workout_type, a.name, a.sport_type)
        return intensityWithWorkoutFloor(raw, wt) === filter.intensity
      })
    }
    if (filter.workoutType !== 'Toutes') {
      list = list.filter(a => {
        const sport = a.manual_sport_type ?? a.sport_type
        const key = effectiveWorkoutType(a.manual_workout_type, a.name, sport)
        if (filter.workoutType === '__none__') return key === null
        return key === filter.workoutType
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
  }, [localActivities, search, filter, dayFilter])

  // Reset the progressive render window whenever the filtered set changes,
  // so the user always starts at the top of the new result list.
  useEffect(() => { setVisibleCount(RENDER_BATCH) }, [search, filter, dayFilter])

  // Reveal more cards as the sentinel approaches the viewport.
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
    || filter.intensity !== 'Toutes'
    || filter.workoutType !== 'Toutes'
    || filter.dateFrom !== '' || filter.dateTo !== ''
    || filter.distFrom !== '' || filter.distTo !== ''
    || filter.paceFrom !== '' || filter.paceTo !== ''
    || filter.durFrom  !== '' || filter.durTo  !== ''
    || filter.dPlusFrom !== '' || filter.dPlusTo !== ''

  return (
    <>
      {panel === 'search' && (
        <SearchPanel
          state={search}
          setState={setSearch}
          activities={localActivities}
          onClose={() => setPanel('none')}
          onNavigate={navigateToActivity}
          onReset={() => {
            sessionStorage.removeItem('tc_activities_search')
            sessionStorage.removeItem('tc_activities_panel')
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
            sessionStorage.removeItem('tc_activities_search')
            sessionStorage.removeItem('tc_activities_filter')
            setFilter(DEFAULT_FILTER)
            setPanel('none')
          }}
        />
      )}

      <div className="px-3 py-3 max-w-lg md:max-w-4xl mx-auto">
        {/* SearchFilterBar */}
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
              {L_main.headerSearch}
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

        {dayFilter && (
          <div className="flex items-center justify-between rounded-[10px] border border-trail-border bg-trail-card px-3 py-2 mb-[8px]">
            <span className="text-body-sm text-trail-text">
              {L_main.dayFilterPrefix}{' '}
              <span className="font-semibold">
                {new Date(`${dayFilter}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setDayFilter(null)}
              className="text-trail-muted text-[15px] leading-none px-1"
              aria-label={L_main.dayFilterClear}
            >
              ✕
            </button>
          </div>
        )}

        {(hasActiveSearch || hasActiveFilter) && (
          <p className="text-body-sm text-trail-muted px-1 mb-[6px]">
            {L_main.resultsCount(filtered.length)}
            {loadingMore ? L_main.historyLoadingHint : ''}
          </p>
        )}
        {loadingMore && !(hasActiveSearch || hasActiveFilter) && (
          <p className="text-caption text-trail-muted px-1 mb-[6px]">
            {L_main.historyLoading}
          </p>
        )}

        {filtered.length === 0 ? (
          <div
            className="rounded-[12px] border p-[10px]"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
          >
            <p className="text-body" style={{ color: colors.subtleText }}>
              {localActivities.length === 0
                ? L_main.connectStravaImport
                : L_main.noActivityMatch}
            </p>
          </div>
        ) : (
          <div className="space-y-[10px]">
            {visible.map(a => (
              <ActivityCard key={a.id} activity={a} hrZones={hrZones} onEdit={setEditingActivity} onClick={() => navigateToActivity(a.id)} />
            ))}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                <span className="text-caption" style={{ color: colors.subtleText }}>…</span>
              </div>
            )}
          </div>
        )}
      </div>
      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          hrZones={hrZones}
          onSaved={handleSaved}
          onDeleted={() => handleDeleted(editingActivity.id)}
          onClose={() => setEditingActivity(null)}
        />
      )}
    </>
  )
}
