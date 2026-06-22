import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddTrackDialog } from '@/components/plan/AddTrackDialog'

describe('AddTrackDialog', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('collage d\'URL → POST { gpxUrl } puis onSaved(track)', async () => {
    const track = { raceId: 'r1', profile: { d: [0, 1], e: [10, 20] }, pointCount: 2, source: 'gpx_url', distanceM: 1000, createdAt: 'x' }
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ track }),
    } as any)
    global.fetch = fetchMock as any
    const onSaved = jest.fn()
    render(<AddTrackDialog raceId="r1" open onClose={() => {}} onSaved={onSaved} />)

    fireEvent.change(screen.getByPlaceholderText(/https/i), { target: { value: 'https://visugpx.com/x.gpx' } })
    fireEvent.click(screen.getByRole('button', { name: /importer/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(track))
    expect(fetchMock).toHaveBeenCalledWith('/api/races/r1/track', expect.objectContaining({ method: 'POST' }))
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body)
    expect(sentBody).toEqual({ gpxUrl: 'https://visugpx.com/x.gpx' })
  })
})
