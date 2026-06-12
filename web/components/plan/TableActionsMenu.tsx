'use client'

// Menu d'actions (⋮) de la course : Modifier la course / Modifier les lignes /
// Ré-importer / Exporter (ouvre la page d'aperçu /print). Sans état métier : le
// parent (CoursePageClient) fournit les callbacks. Les actions liées au tableau
// ne sont affichées que si un tableau existe (hasTableau).
import { useState } from 'react'
import type { ReactNode } from 'react'
import { MoreVertical, Pencil, Rows3, Download, Share } from 'lucide-react'

type Props = {
  onEditRace: () => void
  onEditLines: () => void
  onReimport: () => void
  onExport: () => void
  hasTableau?: boolean
}

export function TableActionsMenu({ onEditRace, onEditLines, onReimport, onExport, hasTableau = true }: Props) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)
  const run = (fn: () => void) => { fn(); close() }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Actions de la course"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mr-1.5 rounded-md p-1.5 text-trail-muted hover:text-trail-text"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <>
          {/* Scrim sombre : assombrit la page pour faire ressortir le menu (fond bleu nuit ≈ surface). */}
          <div className="fixed inset-0 z-40 bg-black/50" onClick={close} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[210px] rounded-[10px] border border-[var(--ink-500)] bg-trail-card p-1 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <MenuItem icon={<Pencil size={15} />} label="Modifier la course" onClick={() => run(onEditRace)} />
            {hasTableau && (
              <>
                <MenuItem icon={<Rows3 size={15} />} label="Modifier les lignes" onClick={() => run(onEditLines)} />
                <MenuItem icon={<Download size={15} />} label="Ré-importer" onClick={() => run(onReimport)} />
                <MenuItem icon={<Share size={15} />} label="Exporter" onClick={() => run(onExport)} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, trailing, onClick }: {
  icon: ReactNode
  label: string
  trailing?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-body-sm font-medium text-trail-text hover:bg-trail-border/30"
    >
      <span className="text-trail-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  )
}
