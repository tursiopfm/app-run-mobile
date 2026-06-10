import polyline from '@mapbox/polyline'
import { streamsToPolyline, streamsToSplits } from '@/lib/garmin-import/fit-derive'

test('streamsToPolyline : encode le latlng, décodable en retour', () => {
  const latlng: [number, number][] = [[45.0, 6.0], [45.001, 6.001], [45.002, 6.002]]
  const enc = streamsToPolyline({ latlng })!
  expect(typeof enc).toBe('string')
  const dec = polyline.decode(enc)
  expect(dec).toHaveLength(3)
  expect(dec[0][0]).toBeCloseTo(45.0, 4)
  expect(dec[0][1]).toBeCloseTo(6.0, 4)
})

test('streamsToPolyline : filtre les paires NaN', () => {
  const latlng: [number, number][] = [[45, 6], [NaN, NaN], [45.001, 6.001]]
  const enc = streamsToPolyline({ latlng })!
  expect(polyline.decode(enc)).toHaveLength(2)
})

test('streamsToPolyline : pas de latlng ou < 2 points → null', () => {
  expect(streamsToPolyline({})).toBeNull()
  expect(streamsToPolyline({ latlng: [[45, 6]] })).toBeNull()
})

test('streamsToSplits : un split par km + reliquat final', () => {
  const s = {
    distance: [0, 500, 1000, 1500, 2000, 2300],
    time:     [0, 300, 600, 900, 1200, 1380],
    altitude: [100, 110, 120, 115, 118, 130],
  }
  const splits = streamsToSplits(s)
  expect(splits.map(x => x.split)).toEqual([1, 2, 3])
  expect(splits[0]).toMatchObject({ split: 1, distance: 1000, moving_time: 600, elevation_difference: 20 })
  expect(splits[1]).toMatchObject({ split: 2, distance: 1000, moving_time: 600, elevation_difference: -2 })
  // reliquat 2000→2300 = 300 m
  expect(splits[2]).toMatchObject({ split: 3, distance: 300, moving_time: 180 })
  expect(splits[0].average_speed).toBeCloseTo(1000 / 600, 3)
})

test('streamsToSplits : pas de distance/temps → []', () => {
  expect(streamsToSplits({ time: [0, 5] })).toEqual([])
  expect(streamsToSplits({ distance: [0, 500] })).toEqual([])
})
