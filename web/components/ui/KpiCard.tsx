type KpiCardProps = {
  label: string
  value: string | number
  unit?: string
  sub?: string
  accent?: boolean
}

export function KpiCard({ label, value, unit, sub, accent }: KpiCardProps) {
  return (
    <div className={`rounded-2xl p-4 border ${
      accent
        ? 'bg-trail-primary/10 border-trail-primary/30'
        : 'bg-trail-card border-trail-border'
    }`}>
      <p className="text-trail-muted text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-trail-primary' : 'text-trail-text'}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1 text-trail-muted">{unit}</span>}
      </p>
      {sub && <p className="text-trail-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}
