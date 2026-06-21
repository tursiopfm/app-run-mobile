// Retour haptique léger au tap (navigation). Repose sur la Web Vibration API :
// fonctionne sur Android (Chrome/PWA), no-op silencieux sur iOS (Safari/PWA ne
// supportent pas navigator.vibrate). try/catch car l'appel peut lever hors d'un
// geste utilisateur ou en iframe cross-origin.
//
// 15 ms : tap léger mais perceptible. Sous ~10 ms les moteurs à actionneur
// linéaire (Pixel/Samsung) n'ont pas le temps de monter en régime.
export function hapticTap() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15)
    }
  } catch {
    /* vibration indisponible — on ignore */
  }
}
