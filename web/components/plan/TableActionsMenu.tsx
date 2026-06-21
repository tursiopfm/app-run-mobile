'use client'

// Menu d'actions de la course : Modifier la course / Modifier les lignes /
// Ré-importer / Exporter (ouvre la page d'aperçu /print). Sans état métier : le
// parent (CoursePageClient) fournit les callbacks. Les actions liées au tableau
// ne sont affichées que si un tableau existe (hasTableau) ; « Modifier la course »
// peut être masquée (showEditRace=false) pour le kebab du bloc tableau.
// Déclencheur libellé « Gérer ▾ » + menu descriptif (chaque action explique ce
// qu'elle fait) pour que l'utilisateur sache ce qu'il va trouver avant d'ouvrir.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Settings2, ChevronDown, Pencil, Rows3, Download, Share } from 'lucide-react'

type Props = {
  onEditRace?: () => void
  onEditLines: () => void
  onReimport: () => void
  onExport: () => void
  hasTableau?: boolean
  showEditRace?: boolean
  label?: string
}

export function TableActionsMenu({
  onEditRace, onEditLines, onReimport, onExport,
  hasTableau = true, showEditRace = true, label = 'Actions de la course',
}: Props) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)
  const run = (fn: () => void) => { fn(); close() }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-trail-border px-2.5 py-1.5 text-body-sm font-semibold text-trail-text hover:border-[var(--ink-500)] hover:bg-trail-border/40"
      >
        <Settings2 size={15} className="text-[var(--primary-text)]" />
        Gérer
        <ChevronDown size={14} className={`text-trail-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Scrim : assombrit la page pour faire ressortir le menu (surface théme-aware). */}
          <div className="fixed inset-0 z-40 bg-black/50" onClick={close} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-[var(--ink-500)] bg-trail-card p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.6)]"
          >
            <div className="px-2.5 pb-1.5 pt-1 text-micro font-bold uppercase tracking-wider text-trail-muted">
              {label}
            </div>
            {showEditRace && onEditRace && (
              <MenuItem
                icon={<Pencil size={17} />}
                label="Modifier la course"
                description="Nom, date, distance, D+, objectif"
                onClick={() => run(onEditRace)}
              />
            )}
            {hasTableau && (
              <>
                <MenuItem
                  icon={<Rows3 size={17} />}
                  label="Modifier les lignes"
                  description="Horaires, ravitos et D+ de chaque point"
                  onClick={() => run(onEditLines)}
                />
                <MenuItem
                  icon={<Download size={17} />}
                  label="Ré-importer"
                  description="Recharger le tracé depuis le site officiel"
                  onClick={() => run(onReimport)}
                />
                <MenuItem
                  icon={<Share size={17} />}
                  label="Exporter"
                  description="Image, PDF ou partage du tableau"
                  onClick={() => run(onExport)}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, description, onClick }: {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-[10px] p-2.5 text-left hover:bg-trail-border/40"
    >
      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-trail-border bg-trail-border/30 text-[var(--primary-text)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-body-sm font-semibold text-trail-text">{label}</span>
        <span className="block text-caption leading-snug text-trail-muted">{description}</span>
      </span>
    </button>
  )
}
