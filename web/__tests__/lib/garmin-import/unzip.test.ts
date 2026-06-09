// web/__tests__/lib/garmin-import/unzip.test.ts
import { zipSync, strToU8 } from 'fflate'
import { extractSummaries } from '@/lib/garmin-import/unzip'

function buildZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content)
  return zipSync(entries)
}

test('lit uniquement les *summarizedActivities*.json et ignore le reste', () => {
  const summaries = JSON.stringify([{ summarizedActivitiesExport: [{ activityId: 1 }, { activityId: 2 }] }])
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/foo_0_summarizedActivities.json': summaries,
    'DI_CONNECT/DI-Connect-User/user_profile.json': '{"x":1}',
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': 'binaire-ignoré',
  })
  const acts = extractSummaries(zip)
  expect(acts.map(a => a.activityId)).toEqual([1, 2])
})

test('supporte un tableau racine sans wrapper', () => {
  const zip = buildZip({ 'DI_CONNECT/DI-Connect-Fitness/x_summarizedActivities.json': JSON.stringify([{ activityId: 9 }]) })
  expect(extractSummaries(zip).map(a => a.activityId)).toEqual([9])
})

test('plusieurs fichiers summarized → concaténés', () => {
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/a_0_summarizedActivities.json': JSON.stringify([{ activityId: 1 }]),
    'DI_CONNECT/DI-Connect-Fitness/a_1_summarizedActivities.json': JSON.stringify([{ activityId: 2 }]),
  })
  expect(extractSummaries(zip).map(a => a.activityId).sort()).toEqual([1, 2])
})

test('JSON corrompu dans un fichier → ignoré sans throw', () => {
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/ok_summarizedActivities.json': JSON.stringify([{ activityId: 5 }]),
    'DI_CONNECT/DI-Connect-Fitness/bad_summarizedActivities.json': '{ pas du json',
  })
  expect(extractSummaries(zip).map(a => a.activityId)).toEqual([5])
})
