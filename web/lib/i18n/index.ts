// Public i18n surface. Components import from here:
//   - useT() / useLang() / setLang() in client components
//   - getServerT() in server components
//
// Storage: cookie `tc_lang` ('fr' | 'en'). Read by the server during SSR and by the
// I18nProvider on the client. `system` is resolved on the client at write time.

import { fr } from './dictionaries/fr'
import { en } from './dictionaries/en'

export type Lang = 'fr' | 'en'
export type LangChoice = Lang | 'system'

export const LANG_COOKIE = 'tc_lang'

export function getDict(lang: Lang) {
  return lang === 'en' ? en : fr
}

export type Dict = typeof fr
