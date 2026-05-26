'use client'

type Props = {
  date:        Date
  raceName?:   string
  daysToRace?: number | null
  weekIndex?:  number | null
  totalWeeks?: number | null
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatDate(d: Date): { weekday: string; date: string } {
  return {
    weekday: DAYS[d.getDay()],
    date:    `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  }
}

export function MorningHeader({ date, raceName, daysToRace, weekIndex, totalWeeks }: Props) {
  const f = formatDate(date)
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-trail-muted">{f.date}</p>
          <h1
            className="text-[26px] leading-none mt-1 text-trail-text"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
          >
            Bonjour
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
