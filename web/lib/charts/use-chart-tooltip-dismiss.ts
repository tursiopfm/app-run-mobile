'use client'

import { useEffect, useRef } from 'react'

// Recharts ne masque pas sa tooltip après une interaction tactile : il n'y a
// pas de mouseleave une fois le doigt relevé, et la tooltip reste figée même
// quand on scrolle la page. Ce hook attache au div passé en ref des handlers
// qui forcent la fermeture quand :
//   - le doigt quitte le graphique (touchend / touchcancel)
//   - la page scrolle (immédiat)
//   - aucun mouvement n'a eu lieu depuis autoDismissMs (laisse le temps de lire)
//
// La fermeture est faite en dispatchant des évènements mouseout/mouseleave sur
// le wrapper Recharts — React 17+ synthétise mouseleave à partir de mouseout.
export function useChartTooltipDismiss(autoDismissMs = 2000) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const dismiss = () => {
      const wrapper = el.querySelector('.recharts-wrapper') as HTMLElement | null
      if (!wrapper) return
      wrapper.dispatchEvent(new MouseEvent('mouseout', {
        bubbles: true, cancelable: true, relatedTarget: document.body,
      }))
      wrapper.dispatchEvent(new MouseEvent('mouseleave', {
        bubbles: false, cancelable: true, relatedTarget: document.body,
      }))
    }

    const clearTimer = () => {
      if (timer) { clearTimeout(timer); timer = null }
    }
    const scheduleDismiss = () => {
      clearTimer()
      timer = setTimeout(() => { dismiss(); timer = null }, autoDismissMs)
    }

    const onTouchStart  = () => clearTimer()
    const onTouchMove   = () => clearTimer()
    const onTouchEnd    = () => scheduleDismiss()
    const onTouchCancel = () => { dismiss(); clearTimer() }
    const onScroll      = () => { dismiss(); clearTimer() }

    el.addEventListener('touchstart',  onTouchStart,  { passive: true })
    el.addEventListener('touchmove',   onTouchMove,   { passive: true })
    el.addEventListener('touchend',    onTouchEnd,    { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })

    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('scroll', onScroll, true)
      clearTimer()
    }
  }, [autoDismissMs])

  return ref
}
