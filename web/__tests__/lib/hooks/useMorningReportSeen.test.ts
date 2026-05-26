import { renderHook, act } from '@testing-library/react'
import { useMorningReportSeen } from '@/lib/hooks/useMorningReportSeen'

beforeEach(() => { localStorage.clear() })

describe('useMorningReportSeen', () => {
  it('renvoie seen=false par défaut', () => {
    const { result } = renderHook(() => useMorningReportSeen('2026-05-26'))
    expect(result.current.seen).toBe(false)
  })

  it('persiste seen=true via markSeen() pour la date donnée', () => {
    const { result } = renderHook(() => useMorningReportSeen('2026-05-26'))
    act(() => { result.current.markSeen() })
    expect(result.current.seen).toBe(true)
    expect(localStorage.getItem('morning_report_seen_2026-05-26')).toBe('1')
  })

  it('renvoie seen=false pour une autre date', () => {
    localStorage.setItem('morning_report_seen_2026-05-26', '1')
    const { result } = renderHook(() => useMorningReportSeen('2026-05-27'))
    expect(result.current.seen).toBe(false)
  })
})
