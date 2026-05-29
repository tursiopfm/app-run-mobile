import 'server-only'
import OpenAI from 'openai'
import type { ExtractedRaceData } from '@/types/plan'
import { RACE_EXTRACTION_SYSTEM_PROMPT } from './prompt'
import {
  RACE_EXTRACTION_JSON_SCHEMA,
  rawToExtractedRaceData,
  validateExtractedRaceData,
} from './schema'

export type ExtractInput =
  | { text: string }
  | { html: string }
  | { pdfText: string }
  | { imageBase64: string; imageMime: 'image/png' | 'image/jpeg' | 'image/webp' }

function isImageInput(
  i: ExtractInput,
): i is Extract<ExtractInput, { imageBase64: string }> {
  return 'imageBase64' in i
}

export async function extractWaypoints(
  input: Partial<ExtractInput> | {},
): Promise<ExtractedRaceData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY absente côté serveur')
  }

  const i = input as ExtractInput
  const hasText = 'text' in i && i.text
  const hasHtml = 'html' in i && i.html
  const hasPdf = 'pdfText' in i && i.pdfText
  const hasImage = 'imageBase64' in i && i.imageBase64
  if (!hasText && !hasHtml && !hasPdf && !hasImage) {
    throw new Error('Aucun input fourni (text / html / pdfText / imageBase64)')
  }

  const client = new OpenAI({ apiKey })

  let userContent: any
  if (isImageInput(i)) {
    userContent = [
      { type: 'text', text: 'Extrais le tableau des points de passage de cette image.' },
      {
        type: 'image_url',
        image_url: { url: `data:${i.imageMime};base64,${i.imageBase64}` },
      },
    ]
  } else if ('html' in i) {
    userContent = `Contenu HTML :\n\n${i.html.slice(0, 200_000)}`
  } else if ('pdfText' in i) {
    userContent = `Texte extrait d'un PDF :\n\n${i.pdfText.slice(0, 200_000)}`
  } else {
    userContent = `Texte fourni :\n\n${(i as any).text.slice(0, 200_000)}`
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RACE_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: RACE_EXTRACTION_JSON_SCHEMA,
    },
    temperature: 0,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Réponse OpenAI vide')
  }

  const raw = JSON.parse(content)
  return validateExtractedRaceData(rawToExtractedRaceData(raw))
}
