import { Brain, Send } from 'lucide-react'

const SUGGESTIONS = [
  'Quelle est ma forme du moment ?',
  'Suis-je prêt pour un ultra ?',
  'Combien de km cette semaine ?',
]

export default function CoachPage() {
  return (
    <div className="flex flex-col px-4 py-4 min-h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 mb-6 p-4 bg-trail-card border border-trail-border rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-trail-accent/15 flex items-center justify-center flex-shrink-0">
            <Brain size={20} className="text-trail-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-trail-text">Coach Trail</p>
            <p className="text-xs text-trail-muted">Analyse basée sur tes données réelles</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              className="w-full text-left px-4 py-3 bg-trail-surface border border-trail-border rounded-xl text-sm text-trail-text hover:border-trail-primary/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <div className="flex-1 bg-trail-surface border border-trail-border rounded-xl px-4 py-3 text-sm text-trail-muted">
            Pose ta question au coach...
          </div>
          <button className="w-11 h-11 rounded-xl bg-trail-primary flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
            <Send size={18} className="text-white" />
          </button>
        </div>
        <p className="text-center text-xs text-trail-muted mt-3">
          Coach IA disponible après connexion Strava
        </p>
    </div>
  )
}
