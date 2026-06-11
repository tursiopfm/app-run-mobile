// Recherche web OpenAI → URLs candidates (citations + filet regex). Isolé pour testabilité.
import 'server-only'
import OpenAI from 'openai'
import type { RaceTarget } from './find-race'

// Note : web_search_options / annotations pas toujours typés selon la version du SDK → cast any localisés.
export async function searchRaceUrls(target: RaceTarget): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Trouve les pages web de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne en priorité : (1) sa page de chronométrage LiveTrail ` +
    `(livetrail.net / livetrail.run) ou UTMB (utmb.world), ET (2) son site officiel ` +
    `ou sa page de résultats. Liste toutes les URLs directes pertinentes.`
  const res = await client.chat.completions.create({
    model: 'gpt-4o-search-preview',
    web_search_options: { search_context_size: 'high' },
    messages: [{ role: 'user', content: prompt }],
  } as any)
  const msg: any = res.choices[0]?.message
  const urls: string[] = []
  for (const a of msg?.annotations ?? []) {
    if (a?.type === 'url_citation' && a.url_citation?.url) urls.push(a.url_citation.url)
  }
  const content: string = msg?.content ?? ''
  for (const m of Array.from(content.matchAll(/https?:\/\/[^\s)\]"'<>]+/g))) urls.push(m[0])
  return urls
}
