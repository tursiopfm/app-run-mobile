// Fetch HTML sécurisé pour l'extraction de roadbook.
// - Whitelist http(s) uniquement (refus de file:, data:, etc.)
// - Timeout 10s
// - Limite taille 3 Mo (les sites de course officiels font souvent > 1 Mo)
import 'server-only'

const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 10_000

export class FetchUrlError extends Error {}

export async function fetchRaceHtml(rawUrl: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new FetchUrlError('URL invalide')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchUrlError(`Protocole non autorisé : ${parsed.protocol}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TrailCockpitBot/1.0' },
    })
  } catch (err) {
    clearTimeout(timer)
    throw new FetchUrlError(`Fetch échoué : ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new FetchUrlError(`HTTP ${res.status}`)
  }

  // Lecture en streaming pour borner la taille.
  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new FetchUrlError('Réponse trop volumineuse')
    return text
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      total += value.length
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new FetchUrlError('Réponse trop volumineuse (>1 Mo)')
      }
      chunks.push(value)
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))))
}
