import type { SessionZone, TrainingZone, RepeatZone } from '@/types/plan'

describe('zones JSONB shape compatibility', () => {
  it('accepts a legacy TrainingZone without mode/intensityMode', () => {
    const legacy: TrainingZone = {
      id: 'z1',
      kind: 'main',
      durationMin: 30,
      intensity: 3,
    }
    const zones: SessionZone[] = [legacy]
    expect(zones[0].kind).toBe('main')
  })

  it('accepts a new TrainingZone with distance/pace', () => {
    const modern: TrainingZone = {
      id: 'z2',
      kind: 'main',
      mode: 'distance',
      durationMin: 0,
      distanceM: 1000,
      intensity: 5,
      intensityMode: 'pace',
      paceSecPerKm: 270,
    }
    const zones: SessionZone[] = [modern]
    expect(zones[0]).toMatchObject({ mode: 'distance', distanceM: 1000 })
  })

  it('accepts a RepeatZone with steps', () => {
    const repeat: RepeatZone = {
      id: 'r1',
      kind: 'repeat',
      repeats: 4,
      steps: [
        { id: 's1', stepKind: 'effort', mode: 'distance', distanceM: 400, intensityMode: 'level', intensity: 5 },
        { id: 's2', stepKind: 'recovery', mode: 'duration', durationMin: 1, intensityMode: 'level', intensity: 1 },
      ],
    }
    const zones: SessionZone[] = [repeat]
    expect(zones[0].kind).toBe('repeat')
  })
})
