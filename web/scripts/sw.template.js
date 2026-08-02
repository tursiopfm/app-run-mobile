// Trail Cockpit - Service Worker
// VERSION est injectée par scripts/generate-sw.js au build (SHA du commit).
// Ne pas modifier manuellement le placeholder.
const VERSION = '__SW_VERSION__'
const STATIC_CACHE = `trail-static-${VERSION}`
const RUNTIME_CACHE = `trail-runtime-${VERSION}`

const PRECACHE_URLS = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Assets hashés par Next.js : URL contient le hash du contenu, donc une URL =
// un contenu unique. Safe en cache-first, le cache ne peut pas être stale.
function isHashedAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

// Âge maximal d'un document HTML servi depuis le cache. Le HTML d'une page Next
// embarque son payload RSC, donc les DONNÉES du rendu serveur — et l'App Router
// ne refetche jamais ce RSC initial à l'hydratation. Servir un vieux document =
// afficher de vieux chiffres (incident 2026-07-25 : Cockpit figé 4 jours sur
// l'état du 21/07).
const NAV_MAX_STALE_MS = 5 * 60 * 1000

// Fraîcheur d'une réponse stockée, d'après son en-tête Date (toujours émis par
// Vercel). Date absente ou illisible → périmée : on préfère le réseau.
function isFreshDocument(res) {
  const at = Date.parse(res.headers.get('date') || '')
  return Number.isFinite(at) && Date.now() - at < NAV_MAX_STALE_MS
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Hard-reload (Ctrl+Shift+R) ou no-cache : on bypass complètement le SW et
  // on laisse le navigateur faire un fetch direct. Sinon le SW continuerait
  // de servir l'ancien depuis CacheStorage malgré le hard-reload utilisateur.
  if (req.cache === 'reload' || req.cache === 'no-cache' || req.cache === 'no-store') {
    return  // pas de respondWith → fetch direct par le browser
  }

  // RSC payloads (?rsc=...) : streams dynamiques, jamais mis en cache.
  // Cloner un RSC stream pendant sa lecture cause "Error in input stream".
  if (url.searchParams.has('_rsc') || url.searchParams.has('rsc')) return

  // Assets Next.js hashés : cache-first (URL garantit la fraîcheur)
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
        return res
      }))
    )
    return
  }

  // Navigations (documents HTML) : stale-while-revalidate BORNÉ dans le temps.
  // Copie de moins de NAV_MAX_STALE_MS → peinte instantanément (démarrage PWA
  // quasi immédiat) puis revalidée en tâche de fond. Au-delà → réseau d'abord,
  // avec repli sur la copie périmée si le réseau échoue (hors ligne).
  // Le plafond est indispensable : la revalidation d'arrière-plan n'aboutit pas
  // sur iOS (WebKit suspend le worker dès la réponse livrée, event.waitUntil est
  // coupé avant cache.put), l'entrée restait donc figée jusqu'au déploiement
  // suivant. Le chemin réseau, lui, écrit toujours — c'est la réponse livrée à
  // la page, le worker ne peut pas mourir avant → il resynchronise le cache.
  // Cohérence interne préservée : le HTML caché référence des chunks hashés
  // eux-mêmes cachés (cache-first), et le bump de VERSION purge tout (activate).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE)
      const cached = await cache.match(req)
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone()).catch(() => {})
        return res
      })
      if (cached && isFreshDocument(cached)) {
        event.waitUntil(network.catch(() => {})) // revalidation en arrière-plan
        return cached
      }
      try {
        return await network
      } catch {
        return cached || (await caches.match('/'))
      }
    })())
    return
  }

  // Tout le reste (RSC payloads, /api, /icons, manifest) : network-first.
  // Le cache n'est utilisé qu'en fallback offline.
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
      return res
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})

// ─── Web Push ───
// Un push reçu DOIT afficher une notification : un push silencieux fait
// révoquer l'abonnement par le navigateur. D'où le repli si le payload est
// absent ou illisible.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = {}
  }
  const title = payload.title || 'Rapport matinal'
  const body  = payload.body  || 'Ton rapport matinal est prêt.'
  const url   = payload.url   || '/rapport-matinal'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   'morning-report',   // une notif remplace la précédente
      data:  { url },
    })
  )
})

// Tap sur la notification : refocalise un onglet déjà ouvert sur la cible,
// sinon en ouvre un.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/rapport-matinal'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
