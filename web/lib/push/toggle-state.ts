export type PushEnvironment = {
  supported:  boolean   // 'serviceWorker' in navigator && 'PushManager' in window
  standalone: boolean   // PWA lancée depuis l'écran d'accueil
  iosLike:    boolean   // iOS / iPadOS : pas de push hors mode standalone
  permission: NotificationPermission | null
  subscribed: boolean
}

export type PushToggleState = 'hidden' | 'install-required' | 'denied' | 'on' | 'off'

// L'ordre compte : sur iOS Safari, PushManager est absent, donc `supported`
// est faux. Tester iOS EN PREMIER est ce qui permet d'afficher la consigne
// d'installation au lieu de masquer le bloc.
export function pushToggleState(env: PushEnvironment): PushToggleState {
  if (env.iosLike && !env.standalone) return 'install-required'
  if (!env.supported)                 return 'hidden'
  if (env.permission === 'denied')    return 'denied'
  return env.subscribed ? 'on' : 'off'
}
