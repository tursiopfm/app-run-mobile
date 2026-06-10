import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { extractWaypoints, type ExtractInput } from '@/lib/race-import/extract'
import { fetchRaceHtml } from '@/lib/race-import/fetch-url'
import { parsePdfText } from '@/lib/race-import/parse-pdf'
import { findParserForUrl } from '@/lib/race-import/sources'
import '@/lib/race-import/sources/livetrail'  // side-effect: registerParser
import '@/lib/race-import/sources/utmb'        // side-effect: registerParser

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/race-import
// Body (multipart si pdf/image, sinon JSON) :
// - source: 'url' | 'pdf' | 'image' | 'text'
// - url / text : champ texte
// - file : champ fichier (PDF ou image)
//
// PAS de persistance ici : renvoie le JSON extrait pour preview client.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ct = request.headers.get('content-type') || ''
  let source = ''
  let input: Partial<ExtractInput> = {}

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      source = String(form.get('source') || '')
      const file = form.get('file') as File | null

      if (source === 'pdf') {
        if (!file) throw new Error('Fichier PDF manquant')
        if (file.size > 5_000_000) throw new Error('PDF > 5 Mo')
        const buf = Buffer.from(await file.arrayBuffer())
        const pdfText = await parsePdfText(buf)
        input = { pdfText }
      } else if (source === 'image') {
        if (!file) throw new Error('Fichier image manquant')
        if (file.size > 4_000_000) throw new Error('Image > 4 Mo')
        const mime = file.type as 'image/png' | 'image/jpeg' | 'image/webp'
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
          throw new Error(`Format image non supporté : ${mime}`)
        }
        const buf = Buffer.from(await file.arrayBuffer())
        input = { imageBase64: buf.toString('base64'), imageMime: mime }
      } else {
        throw new Error(`source invalide pour multipart : ${source}`)
      }
    } else {
      const body = await request.json() as { source: string; url?: string; text?: string }
      source = body.source

      if (source === 'url') {
        if (!body.url) throw new Error('URL manquante')

        // Tenter d'abord un parser site-spécifique (extraction déterministe, 0 LLM).
        const parser = findParserForUrl(body.url)
        if (parser) {
          try {
            const data = await parser.parse(body.url)
            return NextResponse.json({ data })
          } catch (err) {
            // Parser a échoué → on log et on tombe sur le fallback LLM ci-dessous.
            console.warn(`[race-import] parser ${parser.id} failed:`, (err as Error).message)
          }
        }

        // Fallback : fetch HTML + LLM (comportement original).
        const html = await fetchRaceHtml(body.url)
        input = { html }
      } else if (source === 'text') {
        if (!body.text || !body.text.trim()) throw new Error('Texte manquant')
        input = { text: body.text }
      } else {
        throw new Error(`source invalide : ${source}`)
      }
    }

    const data = await extractWaypoints(input)
    return NextResponse.json({ data })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
