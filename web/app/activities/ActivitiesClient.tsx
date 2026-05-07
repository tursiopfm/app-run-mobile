'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityCard, ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { colors } from '@/lib/design/colors'
import { sportLabel } from '@/lib/design/labels'
import { INTENSITY_OPTIONS, guessIntensity } from '@/lib/activities/intensity'

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
  sport:     string
  intensity: string
  dateFrom:  string  // YYYY-MM-DD (from <input type="date">)
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
      className="rounded-full px-4 py-[6px] border text-[13px] font-semibold"
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
      className="w-8 h-8 flex items-center justify-center rounded-[6px] border text-[14px]"
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

const inputCls = 'rounded-[8px] border px-3 py-[7px] text-[13px] flex-1 min-w-0'
const dateInputCls = 'rounded-[8px] border px-2 py-[7px] text-[13px] flex-1 min-w-0'

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
  return (
    <div>
      <p className="text-[13px] font-semibold text-trail-text mb-[6px]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-trail-muted w-4 flex-shrink-0">De</span>
        {left}
        <span className="text-[11px] text-trail-muted flex-shrink-0">à</span>
        {right}
        <SortButtons field={sortField} activeField={activeField} activeDir={activeDir} onSort={onSort} />
      </div>
    </div>
  )
}

// ── Search Panel ───────────────────────────────────────────────────────────────
function SearchPanel({ state, setState, activities, onClose, onNavigate }: {
  state:      SearchState
  setState:   (s: SearchState) => void
  activities: ActivityRow[]
  onClose:    () => void
  onNavigate: (id: string) => void
}) {
  const FIELDS: SearchField[] = ['Titre', 'Distance', 'Durée', 'D+']
  const si = inputStyle()

  const hasInput = state.title.trim() !== ''
    || state.distFrom !== '' || state.distTo !== ''
    || state.durFrom  !== '' || state.durTo  !== ''
    || state.dPlusFrom !== '' || state.dPlusTo !== ''

  const results = useMemo(
    () => hasInput ? applySearch([...activities], state) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, state.field, state.title, state.distFrom, state.distTo,
     state.durFrom, state.durTo, state.dPlusFrom, state.dPlusTo, hasInput],
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text">Rechercher</span>
        </button>
        <button
          onClick={onClose}
          className="text-[14px] font-bold"
          style={{ color: colors.chargeOrange, cursor: 'pointer' }}
        >
          Appliquer
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">

        {/* Search card */}
        <div
          className="rounded-[12px] border p-4 space-y-4"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-[14px] font-semibold text-trail-text">Rechercher par</p>

          <div className="flex gap-2 flex-wrap">
            {FIELDS.map(f => (
              <Chip key={f} label={f} active={state.field === f}
                onClick={() => setState({ ...state, field: f })} />
            ))}
          </div>

          {state.field === 'Titre' && (
            <div>
              <p className="text-[12px] text-trail-muted mb-1">Titre de l&apos;activité</p>
              <input
                autoFocus
                type="text"
                value={state.title}
                onChange={e => setState({ ...state, title: e.target.value })}
                className="rounded-[8px] border px-3 py-2 text-[14px] w-full"
                style={si}
              />
            </div>
          )}

          {state.field === 'Distance' && (
            <div className="space-y-2">
              <p className="text-[12px] text-trail-muted">Distance (km)</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-trail-muted">De</span>
                <input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />
                <span className="text-[11px] text-trail-muted">à</span>
                <input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'Durée' && (
            <div className="space-y-2">
              <p className="text-[12px] text-trail-muted">Durée (h:mm:ss)</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-trail-muted">De</span>
                <input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />
                <span className="text-[11px] text-trail-muted">à</span>
                <input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />
              </div>
            </div>
          )}

          {state.field === 'D+' && (
            <div className="space-y-2">
              <p className="text-[12px] text-trail-muted">Dénivelé positif (m)</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-trail-muted">De</span>
                <input type="text" value={state.dPlusFrom} onChange={e => setState({ ...state, dPlusFrom: e.target.value })} placeholder="m" className={inputCls} style={si} />
                <span className="text-[11px] text-trail-muted">à</span>
                <input type="text" value={state.dPlusTo}   onChange={e => setState({ ...state, dPlusTo: e.target.value })}   placeholder="m" className={inputCls} style={si} />
              </div>
            </div>
          )}
        </div>

        {/* Live results */}
        {hasInput && (
          <>
            <p className="text-[13px] text-trail-muted px-1">{results.length} résultat{results.length !== 1 ? 's' : ''}</p>
            {results.length === 0 ? (
              <div
                className="rounded-[12px] border p-[10px]"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
              >
                <p className="text-[13px]" style={{ color: colors.subtleText }}>Aucune activité trouvée.</p>
              </div>
            ) : (
              <div className="space-y-[10px]">
                {results.map(a => <ActivityCard key={a.id} activity={a} onClick={() => onNavigate(a.id)} />)}
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
  const si = inputStyle()

  const handleSort = (field: SortField, dir: SortDir) =>
    setState({ ...state, sortField: field, sortDir: dir })

  const af = state.sortField
  const ad = state.sortDir

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Header — no Appliquer here */}
      <div
        className="flex items-center px-4 py-3 border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <BackArrow />
          <span className="text-[16px] font-semibold text-trail-text">Filtre</span>
        </button>
      </div>

      {/* Body — scrollable, boutons inclus dans le flux */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">
        <div
          className="rounded-[12px] border p-4 space-y-5"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
        >
          <p className="text-[15px] font-bold text-trail-text">Trier et filtrer</p>

          {/* Activité */}
          <div>
            <p className="text-[13px] font-semibold text-trail-text mb-[6px]">Activité</p>
            <div className="flex items-center gap-2">
              <select
                value={state.sport}
                onChange={e => setState({ ...state, sport: e.target.value })}
                className="rounded-[8px] border px-3 py-[7px] text-[13px] flex-1"
                style={{ ...si, cursor: 'pointer' }}
              >
                <option value="Toutes">Toutes</option>
                {sportTypes.map(s => (
                  <option key={s} value={s}>{sportLabel[s] ?? s}</option>
                ))}
              </select>
              <SortButtons field="sport" activeField={af} activeDir={ad} onSort={handleSort} />
            </div>
          </div>

          {/* Intensité */}
          <div>
            <p className="text-[13px] font-semibold text-trail-text mb-[6px]">Intensité</p>
            <div className="flex items-center gap-2">
              <select
                value={state.intensity}
                onChange={e => setState({ ...state, intensity: e.target.value })}
                className="rounded-[8px] border px-3 py-[7px] text-[13px] flex-1"
                style={{ ...si, cursor: 'pointer' }}
              >
                <option value="Toutes">Toutes</option>
                {INTENSITY_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date — calendrier natif */}
          <div>
            <p className="text-[13px] font-semibold text-trail-text mb-[6px]">Date</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-trail-muted w-4 flex-shrink-0">De</span>
              <input
                type="date"
                value={state.dateFrom}
                onChange={e => setState({ ...state, dateFrom: e.target.value })}
                className={dateInputCls}
                style={si}
              />
              <span className="text-[11px] text-trail-muted flex-shrink-0">à</span>
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

          {/* Distance */}
          <FilterRow
            label="Distance"
            left={<input type="text" value={state.distFrom} onChange={e => setState({ ...state, distFrom: e.target.value })} placeholder="km" className={inputCls} style={si} />}
            right={<input type="text" value={state.distTo}   onChange={e => setState({ ...state, distTo: e.target.value })}   placeholder="km" className={inputCls} style={si} />}
            sortField="distance" activeField={af} activeDir={ad} onSort={handleSort}
          />

          {/* Allure */}
          <FilterRow
            label="Allure"
            left={<input type="text" value={state.paceFrom} onChange={e => setState({ ...state, paceFrom: e.target.value })} placeholder="mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.paceTo}   onChange={e => setState({ ...state, paceTo: e.target.value })}   placeholder="mm:ss" className={inputCls} style={si} />}
            sortField="pace" activeField={af} activeDir={ad} onSort={handleSort}
          />

          {/* Durée */}
          <FilterRow
            label="Durée"
            left={<input type="text" value={state.durFrom} onChange={e => setState({ ...state, durFrom: e.target.value })} placeholder="h:mm:ss" className={inputCls} style={si} />}
            right={<input type="text" value={state.durTo}   onChange={e => setState({ ...state, durTo: e.target.value })}   placeholder="h:mm:ss" className={inputCls} style={si} />}
            sortField="duration" activeField={af} activeDir={ad} onSort={handleSort}
          />

          {/* D+ */}
          <FilterRow
            label="D+"
            left={<input type="text" value={state.dPlusFrom} onChange={e => setState({ ...state, dPlusFrom: e.target.value })} placeholder="m" className={inputCls} style={si} />}
            right={<input type="text" value={state.dPlusTo}   onChange={e => setState({ ...state, dPlusTo: e.target.value })}   placeholder="m" className={inputCls} style={si} />}
            sortField="dplus" activeField={af} activeDir={ad} onSort={handleSort}
          />
        </div>

        {/* Boutons directement sous le bloc, dans le flux scrollable */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={onReset}
            className="flex-1 py-3 rounded-[12px] border text-[14px] font-semibold"
            style={{ borderColor: colors.border, color: colors.subtleText, backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            Réinitialiser
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-[12px] text-[14px] font-bold"
            style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ActivitiesClient({ activities: initialActivities }: { activities: ActivityRow[] }) {
  const [localActivities, setLocalActivities] = useState<ActivityRow[]>(initialActivities)
  const [panel,           setPanel]           = useState<'none' | 'search' | 'filter'>('none')
  const [search,          setSearch]          = useState<SearchState>(DEFAULT_SEARCH)
  const [filter,          setFilter]          = useState<FilterState>(DEFAULT_FILTER)
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null)
  const router = useRouter()

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

    if (filter.sport !== 'Toutes') {
      list = list.filter(a => normalizeSportType(a.sport_type) === filter.sport)
    }
    if (filter.intensity !== 'Toutes') {
      list = list.filter(a => {
        const key = (a.manual_intensity ?? guessIntensity(a.name, a.ces, a.manual_sport_type ?? a.sport_type))
        return key === filter.intensity
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
  }, [localActivities, search, filter])

  const hasActiveSearch = search.title.trim() !== ''
    || search.distFrom !== '' || search.distTo !== ''
    || search.durFrom  !== '' || search.durTo  !== ''
    || search.dPlusFrom !== '' || search.dPlusTo !== ''

  const hasActiveFilter = filter.sport !== 'Toutes'
    || filter.intensity !== 'Toutes'
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
          onNavigate={(id) => router.push(`/activities/${id}`)}
        />
      )}
      {panel === 'filter' && (
        <FilterPanel
          state={filter}
          setState={setFilter}
          sportTypes={sportTypes}
          onClose={() => setPanel('none')}
          onReset={() => setFilter(DEFAULT_FILTER)}
        />
      )}

      <div className="px-3 py-3 max-w-lg mx-auto">
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
            <span className="text-[14px]" style={{ color: hasActiveSearch ? colors.chargeOrange : colors.subtleText }}>
              Rechercher
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
                stroke={hasActiveFilter ? colors.seriesYellow : colors.chargeOrange}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Activity list */}
        {filtered.length === 0 ? (
          <div
            className="rounded-[12px] border p-[10px]"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
          >
            <p className="text-[14px]" style={{ color: colors.subtleText }}>
              {localActivities.length === 0
                ? 'Connecte Strava dans Réglages pour importer tes activités.'
                : 'Aucune activité ne correspond aux filtres.'}
            </p>
          </div>
        ) : (
          <div className="space-y-[10px]">
            {filtered.map(a => (
              <ActivityCard key={a.id} activity={a} onEdit={setEditingActivity} onClick={() => router.push(`/activities/${a.id}`)} />
            ))}
          </div>
        )}
      </div>
      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          onSaved={handleSaved}
          onDeleted={() => handleDeleted(editingActivity.id)}
          onClose={() => setEditingActivity(null)}
        />
      )}
    </>
  )
}
