'use client'

export function WeatherPrimingBlock({ onRequest }: { onRequest: () => void }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 flex flex-col items-center text-center gap-2">
      <span className="text-display leading-none">📍</span>
      <h3 className="text-body-sm font-semibold text-trail-text">Activer la météo locale</h3>
      <p className="text-micro text-trail-muted max-w-[300px]">
        Votre position est utilisée <span className="text-trail-text font-semibold">uniquement</span> pour afficher
        la météo de ce rapport matinal. Aucun autre usage, rien n&apos;est partagé.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="mt-1 rounded-[10px] bg-trail-primary px-4 py-2.5 text-body font-semibold text-white hover:bg-trail-primary-dim transition-colors"
      >
        Autoriser la météo
      </button>
    </div>
  )
}
