// Nettoyage léger d'HTML pour réduire le bruit envoyé au LLM.
// Stratégie : supprimer head, script, style, noscript, svg, puis convertir
// les balises restantes en texte avec normalisation des espaces.
// Pas de dépendance externe — regex suffisantes pour ce besoin.

export function stripHtmlForLlm(html: string): string {
  let s = html

  // Retirer les sections lourdes et sans intérêt textuel.
  s = s.replace(/<head[\s\S]*?<\/head>/gi, ' ')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')

  // Convertir les balises de bloc en saut de ligne pour préserver la structure
  // tabulaire (chaque <tr>/<li>/<p> = nouvelle ligne).
  s = s.replace(/<\/(tr|li|p|div|h[1-6]|br|td|th)>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')

  // Retirer toutes les balises restantes.
  s = s.replace(/<[^>]+>/g, ' ')

  // Decode des entités HTML les plus courantes.
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")

  // Normaliser les espaces : runs d'espaces → 1 espace, runs de \n → 1 \n max.
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/\n[ \t]*/g, '\n')
  s = s.replace(/\n{2,}/g, '\n')

  return s.trim()
}
