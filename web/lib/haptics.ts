// Retour haptique léger au tap (navigation). Repose sur la Web Vibration API :
// fonctionne sur Android (Chrome/PWA), no-op silencieux sur iOS (Safari/PWA ne
// supportent pas navigator.vibrate). try/catch car l'appel peut lever hors d'un
// geste utilisateur ou en iframe cross-origin.
export function hapticTap() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  } catch {
    /* vibration indisponible — on ignore */
  }
}
