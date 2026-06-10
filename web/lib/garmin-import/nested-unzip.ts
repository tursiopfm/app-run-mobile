import { unzipSync } from 'fflate'

const FIT_RE = /\.fit$/i
const ZIP_RE = /\.zip$/i

/**
 * Pour chaque .fit de l'export Garmin, appelle onFit(basename, bytes).
 * Cherche les .fit PARTOUT :
 *  1) directement dans l'outer-zip (certains exports),
 *  2) dans TOUS les .zip imbriqués (UploadedFiles_*.zip MAIS AUSSI les autres dossiers
 *     où Garmin range les FIT des activités récentes — sinon seules les vieilles années
 *     enregistrées via fichiers uploadés sont trouvées).
 * Le tri activité/monitoring se fait ensuite au décodage (file_id.type === 'activity').
 * Mémoire ≈ taille d'un zip imbriqué + ses .fit décompressés (traités un par un).
 */
export async function forEachFit(
  outerZip: Uint8Array,
  onFit: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<void> {
  // 1) .fit directement dans l'outer-zip
  const directFits = unzipSync(outerZip, { filter: f => FIT_RE.test(f.name) })
  let directCount = 0
  for (const name of Object.keys(directFits)) {
    directCount++
    await onFit(name.split('/').pop()!, directFits[name])
  }

  // 2) .fit dans tous les .zip imbriqués
  const nestedZips = unzipSync(outerZip, { filter: f => ZIP_RE.test(f.name) })
  const nestedNames = Object.keys(nestedZips)
  // eslint-disable-next-line no-console
  console.log('[garmin-fit] zips imbriqués:', nestedNames.length, '| .fit directs:', directCount)
  for (const nestedName of nestedNames) {
    let inner: Record<string, Uint8Array>
    try {
      inner = unzipSync(nestedZips[nestedName], { filter: f => FIT_RE.test(f.name) })
    } catch {
      continue // zip imbriqué illisible → on passe au suivant sans casser tout l'enrichissement
    }
    for (const fitPath of Object.keys(inner)) {
      await onFit(fitPath.split('/').pop()!, inner[fitPath])
    }
  }
}
