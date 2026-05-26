'use client'

export function CoachAiBlock() {
  return (
    <div
      className="rounded-[12px] p-[10px] border"
      style={{
        background:  'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(56,189,248,0.06))',
        borderColor: 'rgba(139,92,246,0.30)',
      }}
    >
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🧠</span>
          <h3 className="text-[15px] font-semibold text-trail-muted">Mot du coach</h3>
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--trail-pie-cotes)' }}
        >
          IA · bientôt
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-trail-muted italic">
        Bientôt — un mot personnalisé chaque matin selon ta forme, ta séance et la météo.
      </p>
    </div>
  )
}
