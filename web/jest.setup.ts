import '@testing-library/jest-dom'

// JSDOM defaults to 'en-US'; tests that wrap with <I18nProvider initialLang="fr">
// need navigator.language to resolve as French so the useEffect in I18nProvider
// doesn't switch back to 'en' after mount.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
}
