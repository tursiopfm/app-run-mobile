import { AppShell } from '@/components/navigation/AppShell'
import { Activity, ChevronRight } from 'lucide-react'

const SPORT_LABEL: Record<string, string> = {
  Run: 'Course', TrailRun: 'Trail', GravelRide: 'Gravel',
  Ride: 'Vélo', VirtualRide: 'Home trainer', Swim: 'Natation',
}

const MOCK_ACTIVITIES = [
  { id: '1', name: 'Trail du Matin',  type: 'TrailRun',   date: '2026-05-02', distanceKm: 12.4, dPlus: 450, ces: 87  },
  { id: '2', name: 'Footing EF',      type: 'Run',        date: '2026-05-01', distanceKm: 9.2,  dPlus: 80,  ces: 48  },
  { id: '3', name: 'Sortie Gravel',   type: 'GravelRide', date: '2026-04-30', distanceKm: 65.0, dPlus: 800, ces: 112 },
  { id: '4', name: 'Natation',        type: 'Swim',       date: '2026-04-28', distanceKm: 2.0,  dPlus: 0,   ces: 55  },
]

export default function ActivitiesPage() {
  return (
    <AppShell title="Activités">
      <div className="px-4 py-4 space-y-2">
        {MOCK_ACTIVITIES.map((a) => (
          <div key={a.id} className="bg-trail-card border border-trail-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-trail-primary/15 flex items-center justify-center flex-shrink-0">
              <Activity size={18} className="text-trail-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-trail-text truncate">{a.name}</p>
              <p className="text-xs text-trail-muted mt-0.5">
                {SPORT_LABEL[a.type] ?? a.type} · {a.distanceKm} km · D+ {a.dPlus} m
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-trail-primary">{a.ces} CES</span>
              <span className="text-xs text-trail-muted">{a.date.slice(5)}</span>
            </div>
            <ChevronRight size={16} className="text-trail-muted flex-shrink-0" />
          </div>
        ))}
        <p className="text-center text-trail-muted text-xs pt-4">
          Connecte Strava dans Réglages pour importer tes activités
        </p>
      </div>
    </AppShell>
  )
}
