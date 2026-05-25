'use client'

import { useRef, useState, type ReactNode } from 'react'

type Slide = { key: string; node: ReactNode }

type Props = {
  idx: number
  onIdxChange: (i: number) => void
  slides: Slide[]
  /** Distance min en px pour valider un swipe. En dessous : retour à la page courante. */
  threshold?: number
}

export function SportsCarousel({ idx, onIdxChange, slides, threshold = 50 }: Props) {
  const startXRef    = useRef(0)
  const startIdxRef  = useRef(0)
  const draggingRef  = useRef(false)
  const capturedRef  = useRef(false)
  const [dragX, setDragX]           = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const count = slides.length
  if (count === 0) return null

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    startXRef.current   = e.clientX
    startIdxRef.current = idx
    draggingRef.current = true
    capturedRef.current = false
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - startXRef.current
    // 6px de slack avant de capturer pour ne pas voler les clics
    if (!capturedRef.current && Math.abs(dx) > 6) {
      capturedRef.current = true
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      setIsDragging(true)
    }
    if (capturedRef.current) setDragX(dx)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (!capturedRef.current) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    const dx = dragX
    setDragX(0)
    setIsDragging(false)
    capturedRef.current = false
    if (Math.abs(dx) > threshold) {
      const dir = dx < 0 ? 1 : -1
      const newIdx = Math.max(0, Math.min(count - 1, startIdxRef.current + dir))
      if (newIdx !== idx) onIdxChange(newIdx)
    }
  }

  const offsetPct = -idx * (100 / count)

  return (
    <div
      className="overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="flex"
        style={{
          width: `${count * 100}%`,
          transform: `translate3d(calc(${offsetPct}% + ${dragX}px), 0, 0)`,
          transition: isDragging ? 'none' : 'transform 250ms ease-out',
        }}
      >
        {slides.map(({ key, node }) => (
          <div key={key} style={{ flexShrink: 0, width: `${100 / count}%` }}>
            {node}
          </div>
        ))}
      </div>
    </div>
  )
}
