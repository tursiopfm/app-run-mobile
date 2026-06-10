import { unzipSync } from 'fflate'

const NESTED_RE = /DI-Connect-Uploaded-Files\/UploadedFiles_.*\.zip$/i
const FIT_RE = /\.fit$/i

/**
 * Pour chaque .fit des UploadedFiles_*.zip imbriqués, appelle onFit(basename, bytes).
 * Traite un nested-zip à la fois ; le filtre garantit qu'on ne décompresse que les
 * nested-zips ciblés (pas les autres dossiers de l'export). Mémoire ≈ taille d'un
 * nested-zip + ses .fit décompressés.
 */
export async function forEachFit(
  outerZip: Uint8Array,
  onFit: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<void> {
  const nestedZips = unzipSync(outerZip, { filter: f => NESTED_RE.test(f.name) })
  for (const nestedName of Object.keys(nestedZips)) {
    const inner = unzipSync(nestedZips[nestedName], { filter: f => FIT_RE.test(f.name) })
    for (const fitPath of Object.keys(inner)) {
      await onFit(fitPath.split('/').pop()!, inner[fitPath])
    }
  }
}
