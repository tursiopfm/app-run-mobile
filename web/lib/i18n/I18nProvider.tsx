'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getDict, LANG_COOKIE, type Lang, type LangChoice, type Dict } from './index'

const ONE_YEAR = 60 * 60 * 24 * 365

type Ctx = {
  lang: Lang
  choice: LangChoice
  setLang: (choice: LangChoice) => void
  t: Dict
}

const I18nContext = createContext<Ctx | null>(null)

function readChoiceCookie(): LangChoice {
  if (typeof document === 'undefined') return 'system'
  const match = document.cookie.match(/(?:^|;\s*)tc_lang_choice=(fr|en|system)/)
  return (match?.[1] as LangChoice | undefined) ?? 'system'
}

function resolveSystemLang(): Lang {
  if (typeof navigator === 'undefined') return 'fr'
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

function writeCookies(choice: LangChoice, effective: Lang) {
  if (typeof document === 'undefined') return
  document.cookie = `${LANG_COOKIE}=${effective}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`
  document.cookie = `tc_lang_choice=${choice}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`
  document.documentElement.lang = effective
}

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: ReactNode
}) {
  // SSR/CSR must match, so initial state comes from the cookie read on the server.
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [choice, setChoiceState] = useState<LangChoice>(initialLang)

  useEffect(() => {
    // After mount, reconcile with the `choice` cookie (which can be 'system').
    const stored = readChoiceCookie()
    if (stored !== choice) {
      setChoiceState(stored)
      const effective: Lang = stored === 'system' ? resolveSystemLang() : stored
      if (effective !== lang) setLangState(effective)
      // Re-write `tc_lang` so the server sees the resolved value next time.
      writeCookies(stored, effective)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setLang(next: LangChoice) {
    const effective: Lang = next === 'system' ? resolveSystemLang() : next
    setChoiceState(next)
    setLangState(effective)
    writeCookies(next, effective)
  }

  const value = useMemo<Ctx>(() => ({
    lang,
    choice,
    setLang,
    t: getDict(lang),
  }), [lang, choice])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export function useT(): Dict {
  return useI18n().t
}

export function useLang() {
  const { lang, choice, setLang } = useI18n()
  return { lang, choice, setLang }
}
