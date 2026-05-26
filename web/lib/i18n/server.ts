// Server-side helper for reading the current language inside Server Components,
// Route Handlers, and Server Actions.
//
// The user's choice is stored as a cookie ('fr' | 'en'). If the cookie is unset
// or holds an unexpected value, we fall back to French.

import { cookies } from 'next/headers'
import { getDict, LANG_COOKIE, type Lang } from './index'

export function getServerLang(): Lang {
  const value = cookies().get(LANG_COOKIE)?.value
  return value === 'en' ? 'en' : 'fr'
}

export function getServerT() {
  return getDict(getServerLang())
}
