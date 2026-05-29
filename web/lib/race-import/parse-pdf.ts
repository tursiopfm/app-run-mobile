// Extraction texte depuis un PDF en mémoire.
import 'server-only'
import pdfParse from 'pdf-parse'

export class ParsePdfError extends Error {}

export async function parsePdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer)
    const text = (result.text || '').trim()
    if (!text) {
      throw new ParsePdfError(
        'Aucun texte extrait — PDF scanné ou vide. Essaye l\'onglet Image.',
      )
    }
    return text
  } catch (err) {
    if (err instanceof ParsePdfError) throw err
    throw new ParsePdfError(`Erreur PDF : ${(err as Error).message}`)
  }
}
