'use client'

import { useState, type ReactNode } from 'react'
import { useBlockContext } from '@/components/blocks/BlockGrid'
import { BlockHelpSheet } from './BlockHelpSheet'

type Props = {
  title:     string
  helpTitle: string
  helpBody:  string
  children:  ReactNode
  rightSlot?: ReactNode
}

export function BlockCard({ title, helpTitle, helpBody, children, rightSlot }: Props) {
  const { hideSelf } = useBlockContext()
  const [showHelp, setShowHelp] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[15px] font-semibold text-trail-text">{title}</h3>
        <div className="flex items-center gap-1">
          {rightSlot}
          <button
            aria-label="Aide sur ce bloc"
            onClick={() => setShowHelp(true)}
            className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-[14px]"
          >ⓘ</button>
          <div className="relative">
            <button
              aria-label="Menu du bloc"
              onClick={() => setShowMenu(s => !s)}
              className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-[18px] leading-none"
            >⋮</button>
            {showMenu && (
              <div
                className="absolute right-0 mt-1 w-32 rounded-[8px] bg-trail-surface border border-trail-border shadow-lg z-30"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => { setShowMenu(false); hideSelf() }}
                  className="w-full px-3 py-2 text-left text-[12px] text-trail-text hover:bg-trail-card"
                >Masquer</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
      {showHelp && <BlockHelpSheet title={helpTitle} body={helpBody} onClose={() => setShowHelp(false)} />}
    </div>
  )
}
