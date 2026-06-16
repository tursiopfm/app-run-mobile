'use client'

import { useState, type ReactNode } from 'react'
import { useBlockContext } from '@/components/blocks/BlockGrid'
import { BlockHelpSheet } from './BlockHelpSheet'
import { BlockMenu } from './BlockMenu'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  title:     string
  helpTitle: string
  helpBody:  ReactNode
  children:  ReactNode
  rightSlot?: ReactNode
  titleClassName?: string
}

export function BlockCard({ title, helpTitle, helpBody, children, rightSlot, titleClassName }: Props) {
  const C = useT().common
  const { hideSelf } = useBlockContext()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className={titleClassName ?? 'text-[15px] font-semibold text-trail-muted font-display'}>{title}</h3>
        <div className="flex items-center gap-1">
          {rightSlot}
          <button
            aria-label={C.blockHelpAria}
            onClick={() => setShowHelp(true)}
            className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-body"
          >ⓘ</button>
          <BlockMenu onHide={hideSelf} />
        </div>
      </div>
      {children}
      {showHelp && <BlockHelpSheet title={helpTitle} body={helpBody} onClose={() => setShowHelp(false)} />}
    </div>
  )
}
