'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

// Menu kebab « ⋮ » → « Masquer ». Extrait de BlockCard pour être réutilisé
// par les blocs qui ne passent pas par BlockCard (ex. PlanHeroCard).
export function BlockMenu({ onHide, className }: { onHide: () => void; className?: string }) {
  const C = useT().common
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handle(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [showMenu])

  return (
    <div className={`relative ${className ?? ''}`} ref={menuRef}>
      <button
        aria-label={C.blockMenuAria}
        onClick={() => setShowMenu(s => !s)}
        className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-h2 leading-none"
      >⋮</button>
      {showMenu && (
        <div className="absolute right-0 mt-1 w-32 rounded-[8px] bg-trail-surface border border-trail-border shadow-lg z-30">
          <button
            onClick={() => { setShowMenu(false); onHide() }}
            className="w-full px-3 py-2 text-left text-caption text-trail-text hover:bg-trail-card"
          >{C.blockHide}</button>
        </div>
      )}
    </div>
  )
}
