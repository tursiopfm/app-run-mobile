// Utilitaire client pour l'API Push : attente bornée du Service Worker.
//
// navigator.serviceWorker.ready ne se résout QUE si une registration devient
// ACTIVE pour ce scope. En dev, ServiceWorkerRegistrar.tsx ne l'enregistre
// jamais (court-circuité hors production) : l'attente serait infinie sans
// borne. On la borne ; passé le délai, on traite l'absence de worker actif
// comme « pas de registration » au lieu de rester bloqué.
//
// Partagé entre PushNotificationToggle (interrupteur) et AccountSection
// (désabonnement à la déconnexion) : les deux ont besoin de la même attente
// bornée avant de toucher pushManager.
const READY_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(value => { clearTimeout(timer); resolve(value) })
  })
}

export async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return withTimeout<ServiceWorkerRegistration | null>(
    navigator.serviceWorker.ready, READY_TIMEOUT_MS, null,
  )
}
