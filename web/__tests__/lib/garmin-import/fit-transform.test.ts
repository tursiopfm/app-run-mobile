import { recordsToStreamSet, deriveGrade } from '@/lib/garmin-import/fit-transform'

test('deriveGrade : pente = Δaltitude/Δdistance en %', () => {
  const grade = deriveGrade([100, 110, 120], [0, 100, 200])
  expect(grade[0]).toBe(0)
  expect(grade[1]).toBeCloseTo(10, 1)
  expect(grade[2]).toBeCloseTo(10, 1)
})

test('deriveGrade : distance plate → 0 %', () => {
  const grade = deriveGrade([100, 100], [0, 0])
  expect(grade).toEqual([0, 0])
})

test('recordsToStreamSet : mappe records → arrays, time relatif au 1er, enhanced prioritaire', () => {
  const t0 = 1_600_000_000_000
  const records = [
    { timestamp: new Date(t0),        heartRate: 120, enhancedAltitude: 100, enhancedSpeed: 2.0, distance: 0 },
    { timestamp: new Date(t0 + 5000), heartRate: 130, enhancedAltitude: 105, enhancedSpeed: 2.5, distance: 12 },
  ]
  const s = recordsToStreamSet(records)
  expect(s.time).toEqual([0, 5])
  expect(s.heartrate).toEqual([120, 130])
  expect(s.altitude).toEqual([100, 105])
  expect(s.velocity).toEqual([2.0, 2.5])
  expect(s.distance).toEqual([0, 12])
  expect(s.grade?.length).toBe(2)
})

test('recordsToStreamSet : champ absent sur tous les points → canal omis (undefined)', () => {
  const t0 = 1_600_000_000_000
  const records = [
    { timestamp: new Date(t0),        enhancedAltitude: 100, enhancedSpeed: 2.0, distance: 0 },   // pas de heartRate
    { timestamp: new Date(t0 + 5000), enhancedAltitude: 105, enhancedSpeed: 2.5, distance: 12 },
  ]
  const s = recordsToStreamSet(records)
  expect(s.heartrate).toBeUndefined()
  expect(s.altitude).toEqual([100, 105])
})

test('recordsToStreamSet : fallback altitude/speed non-enhanced', () => {
  const t0 = 1_600_000_000_000
  const records = [{ timestamp: new Date(t0), altitude: 50, speed: 1.5, distance: 0, heartRate: 100 }]
  const s = recordsToStreamSet(records)
  expect(s.altitude).toEqual([50])
  expect(s.velocity).toEqual([1.5])
})

test('downsample5s : garde 1 point / 5 s + le dernier', () => {
  const { downsample5s } = require('@/lib/garmin-import/fit-transform')
  const s = { time: [0, 1, 2, 5, 6, 10], heartrate: [1, 2, 3, 4, 5, 6] }
  const d = downsample5s(s, 5)
  expect(d.time).toEqual([0, 5, 10])
  expect(d.heartrate).toEqual([1, 4, 6])
})

test('recordsToStreamSet : positionLat/Long (semicircles) → latlng en degrés', () => {
  const t0 = 1_600_000_000_000
  // 45.0° lat, 6.0° lng en semicircles : deg / (180/2^31)
  const SEMI = 2 ** 31 / 180
  const records = [
    { timestamp: new Date(t0),        positionLat: Math.round(45 * SEMI), positionLong: Math.round(6 * SEMI), distance: 0 },
    { timestamp: new Date(t0 + 5000), positionLat: Math.round(45.001 * SEMI), positionLong: Math.round(6.001 * SEMI), distance: 12 },
  ]
  const s = recordsToStreamSet(records)
  expect(s.latlng).toHaveLength(2)
  expect(s.latlng![0][0]).toBeCloseTo(45, 4)
  expect(s.latlng![0][1]).toBeCloseTo(6, 4)
})

test('recordsToStreamSet : sans GPS → latlng undefined', () => {
  const t0 = 1_600_000_000_000
  const records = [{ timestamp: new Date(t0), heartRate: 120, distance: 0 }]
  const s = recordsToStreamSet(records)
  expect(s.latlng).toBeUndefined()
})

test('downsample5s : downsample aussi latlng (aligné au time)', () => {
  const { downsample5s } = require('@/lib/garmin-import/fit-transform')
  const s = { time: [0, 1, 5, 10], latlng: [[1, 1], [2, 2], [3, 3], [4, 4]] as [number, number][] }
  const d = downsample5s(s, 5)
  expect(d.time).toEqual([0, 5, 10])
  expect(d.latlng).toEqual([[1, 1], [3, 3], [4, 4]])
})
