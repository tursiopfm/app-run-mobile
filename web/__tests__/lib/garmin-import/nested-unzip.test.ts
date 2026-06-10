import { zipSync, strToU8 } from 'fflate'
import { forEachFit } from '@/lib/garmin-import/nested-unzip'

test('itère les .fit des UploadedFiles_*.zip imbriqués, ignore le reste', async () => {
  const nested = zipSync({ '1.fit': strToU8('FITDATA-1'), '2.fit': strToU8('FITDATA-2'), 'note.txt': strToU8('x') })
  const outer = zipSync({
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': nested,
    'DI_CONNECT/DI-Connect-Fitness/x_summarizedActivities.json': strToU8('[]'),
  })
  const seen: { name: string; len: number }[] = []
  await forEachFit(outer, async (name, bytes) => { seen.push({ name, len: bytes.length }) })
  expect(seen.map(s => s.name).sort()).toEqual(['1.fit', '2.fit'])
  expect(seen.every(s => s.len > 0)).toBe(true)
})

test('plusieurs UploadedFiles_*.zip imbriqués', async () => {
  const n0 = zipSync({ 'a.fit': strToU8('A') })
  const n1 = zipSync({ 'b.fit': strToU8('B') })
  const outer = zipSync({
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': n0,
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_1.zip': n1,
  })
  const names: string[] = []
  await forEachFit(outer, async (name) => { names.push(name) })
  expect(names.sort()).toEqual(['a.fit', 'b.fit'])
})

test('le nom passé au callback est le basename (sans chemin interne)', async () => {
  const nested = zipSync({ 'sub/dir/123.fit': strToU8('X') })
  const outer = zipSync({ 'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': nested })
  const names: string[] = []
  await forEachFit(outer, async (name) => { names.push(name) })
  expect(names).toEqual(['123.fit'])
})

test('aucun UploadedFiles → callback jamais appelé', async () => {
  const outer = zipSync({ 'DI_CONNECT/DI-Connect-Fitness/x_summarizedActivities.json': strToU8('[]') })
  let calls = 0
  await forEachFit(outer, async () => { calls++ })
  expect(calls).toBe(0)
})
