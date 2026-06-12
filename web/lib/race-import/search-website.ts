// Recherche web OpenAI → URL du site officiel de l'organisation d'une course.
// Léger : on ne valide PAS distance/D+ (une page d'accueil n'a pas de waypoints),
// contrairement au pipeline find-race. Isolé pour testabilité (cf. search-openai.ts).
import 'server-only'
import OpenAI from 'openai'

export interface WebsiteTarget {
  name: string
  date: string   // ISO YYYY-MM-DD
}

export async function searchOfficialWebsite(target: WebsiteTarget): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Donne uniquement l'URL du site officiel de l'organisation de la course de ` +
    `trail « ${target.name} » (édition ${year}). La page d'accueil du site officiel, ` +
    `PAS une page de chronométrage, de résultats ou d'inscription tierce.`
  // web_search_options non typé selon la version du SDK → cast any localisé.
  const res = await client.chat.completions.create({
    model: 'gpt-4o-search-preview',
    web_search_options: { search_context_size: 'high' },
    messages: [{ role: 'user', content: prompt }],
  } as any)
  const msg: any = res.choices[0]?.message
  for (const a of msg?.annotations ?? []) {
    if (a?.type === 'url_citation' && a.url_citation?.url) return a.url_citation.url
  }
  const content: string = msg?.content ?? ''
  const m = content.match(/https?:\/\/[^\s)\]"'<>]+/)
  // Retire la ponctuation de fin de phrase collée à l'URL (« …com. », « …com, »).
  return m ? m[0].replace(/[.,;!]+$/, '') : null
}
