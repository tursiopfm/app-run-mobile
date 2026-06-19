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
  // Coiffe éditoriale du « rapport matinal » : posée directement sur le dégradé
  // aube du takeover (pas de carte), titre sur 2 lignes pour différencier
  // franchement l'écran d'un onglet de l'app.
  return (
    <div className="flex items-start justify-between px-1">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-trail-muted">{dateLabel}</p>
        <h1
          className="mt-1.5 leading-[0.95]"
          style={{ fontFamily: 'var(--font-data)', fontSize: '38px', letterSpacing: '-0.01em' }}
        >
          <span className="block text-trail-text font-semibold">Bonjour</span>
          {firstName && <span className="block text-trail-primary font-bold">{firstName}</span>}
        </h1>
      </div>
      {raceName && daysToRace != null && (
        <div
          className="text-right rounded-[12px] border border-trail-border px-3 py-2 mt-1"
          style={{ background: 'rgba(11,15,20,0.4)' }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-trail-muted">{raceName}</p>
          <p
            className="text-h1 leading-none text-trail-primary"
            style={{ fontFamily: 'var(--font-data)' }}
          >
            J-{daysToRace}
          </p>
          {weekIndex != null && totalWeeks != null && (
            <p className="text-[10px] mt-0.5 text-trail-muted">Sem {weekIndex}/{totalWeeks}</p>
          )}
        </div>
      )}
    </div>
  )
}
