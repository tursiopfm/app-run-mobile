'use client'
import { useCallback, useEffect, useState } from 'react'

function storageKey(date: string): string {
  return `morning_report_seen_${date}`
}

export function useMorningReportSeen(date: string) {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(storageKey(date)) === '1')
    } catch {
      setSeen(false)
    }
  }, [date])

  const markSeen = useCallback(() => {
    try { localStorage.setItem(storageKey(date), '1') } catch {}
    setSeen(true)
  }, [date])

  return { seen, markSeen }
}
