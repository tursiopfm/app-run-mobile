'use client'

import { useState, useMemo } from 'react'
import { colors } from '@/lib/design/colors'

// ── Types ──────────────────────────────────────────────────────────────
type Sport = 'Running' | 'Cycling' | 'Swimming'
type RecordSource = 'Auto' | 'Manual'
type RecordType = 'BestTime' | 'LongestDistance' | 'HighestElevation' | 'BestPace' | 'BestSpeed' | 'Custom'
type RecordFilter = 'All' | 'Distance' | 'Global' | 'Manual'

type Race = {
  id: string
  title: string
  date: string       // YYYY-MM-DD
  sport: Sport
  distanceKm: number
  dPlus: number
  durationSec: number
  source: RecordSource
}

type PersonalRecord = {
  id: string
  sport: Sport
  label: string
  recordType: RecordType
  valueLabel: string  // pre-formatted display value
  distanceKm?: number
  date?: string
  source: RecordSource
}

// ── Utilities ──────────────────────────────────────────────────────────
function fmt1(v: number): string { return (Math.round(v * 10) / 10).toFixed(1) }

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}h${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const M = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`
}

const SPORT_LABEL: Record<Sport, string> = { Running: 'Trail', Cycling: 'Vélo', Swimming: 'Natation' }
const SPORT_COLOR: Record<Sport, string> = { Running: colors.chargeOrange, Cycling: colors.seriesBlue, Swimming: colors.pieVma }

// ── Sample Data ────────────────────────────────────────────────────────
const SAMPLE_RACES: Race[] = [
  { id:'r1', title:'Ecotrail Paris 80km', date:'2025-06-14', sport:'Running', distanceKm:80.2, dPlus:5200, durationSec:44640, source:'Auto' },
  { id:'r2', title:'Trail des Lavoirs 42km', date:'2025-10-05', sport:'Running', distanceKm:42.5, dPlus:2100, durationSec:18720, source:'Auto' },
  { id:'r3', title:'TDS — 145km', date:'2025-08-26', sport:'Running', distanceKm:97.0, dPlus:6200, durationSec:0, source:'Manual' },
  { id:'r4', title:'Diagonale des Fous', date:'2024-10-18', sport:'Running', distanceKm:163.0, dPlus:9641, durationSec:0, source:'Manual' },
  { id:'r5', title:'Ultra-Trail Côte d\'Azur', date:'2024-04-28', sport:'Running', distanceKm:50.0, dPlus:3200, durationSec:25560, source:'Auto' },
]

const SAMPLE_RECORDS: PersonalRecord[] = [
  { id:'p1', sport:'Running', label:'10 km',         recordType:'BestTime',          valueLabel:'42:15',     distanceKm:10,    date:'2024-09-21', source:'Auto' },
  { id:'p2', sport:'Running', label:'Semi-marathon',  recordType:'BestTime',          valueLabel:'1h38:45',   distanceKm:21.1,  date:'2024-11-03', source:'Auto' },
  { id:'p3', sport:'Running', label:'Marathon',       recordType:'BestTime',          valueLabel:'3h24:00',   distanceKm:42.195,date:'2023-04-23', source:'Manual' },
  { id:'p4', sport:'Running', label:'Plus longue distance', recordType:'LongestDistance', valueLabel:'163 km', distanceKm:163, date:'2024-10-18', source:'Auto' },
  { id:'p5', sport:'Running', label:'Plus grand D+',  recordType:'HighestElevation',  valueLabel:'9 641 m',                     date:'2024-10-18', source:'Auto' },
  { id:'p6', sport:'Cycling', label:'Meilleure vitesse moy.', recordType:'BestSpeed', valueLabel:'38.4 km/h',distanceKm:120,  date:'2024-07-06', source:'Auto' },
  { id:'p7', sport:'Running', label:'Meilleure allure', recordType:'BestPace',        valueLabel:'3:48/km',  distanceKm:5,     date:'2023-09-30', source:'Auto' },
]

// ── Small components ───────────────────────────────────────────────────
function SegmentButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center rounded-[10px] border"
      style={{
        height: 42, fontSize: 11, fontWeight: 700, cursor: 'pointer',
        backgroundColor: selected ? `${colors.chargeOrange}2B` : colors.surface,
        borderColor: selected ? colors.chargeOrange : colors.border,
        color: selected ? colors.chargeOrange : colors.subtleText,
      }}
    >
      {label}
    </button>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 rounded-[10px] px-[8px] py-[6px] text-center" style={{ backgroundColor: colors.surface }}>
      <p className="text-[18px] font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-trail-muted mt-[2px]">{label}</p>
    </div>
  )
}

function MetricTile({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-[10px] px-[10px] py-[8px] flex-shrink-0" style={{ backgroundColor: colors.surface }}>
      <p className="text-[11px] text-trail-muted">{label}</p>
      <div className="flex items-baseline gap-[3px] mt-[2px]">
        <span className="text-[17px] font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-[11px] text-trail-muted">{unit}</span>}
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-3 py-[5px] border text-[12px] font-semibold"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}26` : colors.surface,
        borderColor: active ? colors.chargeOrange : colors.border,
        color: active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ── RaceCard ───────────────────────────────────────────────────────────
function RaceCard({ race }: { race: Race }) {
  const hasDuration = race.durationSec > 0
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold truncate" style={{ color: colors.chargeOrange }}>{race.title}</p>
          <p className="text-[12px] text-trail-muted mt-[2px]">{fmtDate(race.date)}</p>
        </div>
        <div className="flex items-center gap-[6px] flex-shrink-0">
          <SourceBadge source={race.source} />
          <span className="text-[12px] font-semibold" style={{ color: SPORT_COLOR[race.sport] }}>{SPORT_LABEL[race.sport]}</span>
        </div>
      </div>
      {/* Metrics */}
      <div className="flex gap-[6px] overflow-x-auto pb-0.5">
        <MetricTile label="Distance" value={fmt1(race.distanceKm)} unit="km" color={colors.chargeOrange} />
        <MetricTile label="D+"       value={race.dPlus > 0 ? race.dPlus.toString() : '—'} unit="m" color={colors.seriesBlue} />
        <MetricTile label="Chrono"   value={hasDuration ? fmtDuration(race.durationSec) : '—'} unit="" color={colors.greenOk} />
      </div>
    </div>
  )
}

// ── RecordCard ─────────────────────────────────────────────────────────
function RecordCard({ record }: { record: PersonalRecord }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Source + sport header */}
      <div className="flex items-center justify-between mb-[4px]">
        <div className="flex items-center gap-[6px]">
          <span className="text-[11px] font-black" style={{ color: colors.chargeOrange }}>Record</span>
          <SourceBadge source={record.source} />
          <span className="text-[11px] text-trail-muted">{SPORT_LABEL[record.sport]}</span>
        </div>
        {record.date && <span className="text-[11px] text-trail-muted">{fmtDate(record.date)}</span>}
      </div>
      {/* Label */}
      <p className="text-[14px] font-semibold text-trail-text mb-[6px]">{record.label}</p>
      {/* Value tile(s) */}
      <div className="flex gap-[6px]">
        <MetricTile label={record.label} value={record.valueLabel} unit="" color={colors.chargeOrange} />
        {record.distanceKm && (
          <MetricTile label="Distance" value={fmt1(record.distanceKm)} unit="km" color={colors.subtleText} />
        )}
      </div>
    </div>
  )
}

// ── Courses summary + list ─────────────────────────────────────────────
function CoursesView({ races }: { races: Race[] }) {
  const totalKm = races.reduce((s, r) => s + r.distanceKm, 0)
  const maxDPlus = Math.max(...races.map(r => r.dPlus), 0)
  const lastDate = races.length > 0 ? fmtDate(races[0].date) : '—'

  return (
    <div className="space-y-3">
      {/* Summary pills */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex gap-2">
          <SummaryPill label="courses"   value={races.length.toString()}  color={colors.chargeOrange} />
          <SummaryPill label="km total"  value={Math.round(totalKm).toString()} color={colors.seriesBlue} />
          <SummaryPill label="dernière"  value={lastDate}                  color={colors.greenOk} />
          <SummaryPill label="max D+"    value={`${maxDPlus} m`}           color={colors.seriesYellow} />
        </div>
      </div>

      {/* List */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[15px] font-bold text-trail-text mb-[10px]">Liste des courses</p>
        {races.length === 0 ? (
          <p className="text-[13px] text-trail-muted">Aucune course enregistrée.</p>
        ) : (
          <div className="space-y-[10px]">
            {races.map(r => <RaceCard key={r.id} race={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Records summary + list ─────────────────────────────────────────────
const FILTER_LABELS: Record<RecordFilter, string> = {
  All: 'Tous', Distance: 'Distance', Global: 'Globaux', Manual: 'Manuel',
}

function RecordsView({ records }: { records: PersonalRecord[] }) {
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
      {/* Summary pills */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex gap-2">
          <SummaryPill label="records"   value={records.length.toString()}  color={colors.chargeOrange} />
          <SummaryPill label="auto"      value={autoCount.toString()}        color={colors.seriesBlue} />
          <SummaryPill label="sports"    value="3"                           color={colors.seriesYellow} />
        </div>
      </div>

      {/* Filter chips + list */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <p className="text-[15px] font-bold text-trail-text mb-[10px]">Records</p>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-[10px]">
          {(Object.keys(FILTER_LABELS) as RecordFilter[]).map(f => (
            <FilterChip key={f} label={FILTER_LABELS[f]} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-trail-muted">Aucun record dans cette catégorie.</p>
        ) : (
          <div className="space-y-[10px]">
            {filtered.map(r => <RecordCard key={r.id} record={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function CoursesClient() {
  const [view, setView] = useState<'Races' | 'Records'>('Races')

  const sortedRaces = useMemo(() =>
    [...SAMPLE_RACES].sort((a, b) => b.date.localeCompare(a.date)),
  [])

  return (
    /* Android: contentPadding=12dp, spacedBy=12dp */
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">

      {/* Segment tabs */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[6px]">
        <div className="flex gap-2">
          <SegmentButton label="Courses" selected={view === 'Races'}   onClick={() => setView('Races')} />
          <SegmentButton label="Records" selected={view === 'Records'} onClick={() => setView('Records')} />
        </div>
      </div>

      {view === 'Races'
        ? <CoursesView races={sortedRaces} />
        : <RecordsView records={SAMPLE_RECORDS} />
      }
    </div>
  )
}
