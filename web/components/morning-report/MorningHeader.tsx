'use client'

type Props = {
  date:        Date
  firstName?:  string | null
  raceName?:   string
  daysToRace?: number | null
  weekIndex?:  number | null
  totalWeeks?: number | null
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatDate(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function MorningHeader({ date, firstName, raceName, daysToRace, weekIndex, totalWeeks }: Props) {
  const dateLabel = formatDate(date)
  const greeting = firstName ? `Bonjour ${firstName}` : 'Bonjour'
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-trail-muted">{dateLabel}</p>
          <h1
            className="text-[26px] leading-none mt-1 text-trail-text"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
          >
            {greeting}
          </h1>
        </div>
        {raceName && daysToRace != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-trail-muted">{raceName}</p>
            <p
              className="text-[22px] leading-none text-trail-primary"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              J-{daysToRace}
            </p>
            {weekIndex != null && totalWeeks != null && (
              <p className="text-[10px] mt-0.5 text-trail-muted">Sem {weekIndex}/{totalWeeks}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
