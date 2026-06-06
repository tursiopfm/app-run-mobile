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

  // Navigations (documents HTML) : stale-while-revalidate. On peint depuis le
  // cache instantanément (démarrage PWA quasi immédiat dès la 2e ouverture) puis
  // on revalide le réseau en tâche de fond. Cache vide → réseau (aucun
  // ralentissement vs avant). Pas de gel : le HTML caché référence des chunks
  // hashés eux-mêmes cachés (cache-first) → version interne cohérente ; le bump
  // de VERSION au déploiement purge les caches (activate) → fraîcheur garantie au
  // lancement suivant. Compromis assumé : 1 lancement sur l'ancienne version
  // juste après un déploiement.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE)
      const cached = await cache.match(req)
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone()).catch(() => {})
        return res
      })
      if (cached) {
        event.waitUntil(network.catch(() => {})) // revalidation en arrière-plan
        return cached
      }
      try {
        return await network
      } catch {
        return (await cache.match(req)) || (await caches.match('/'))
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
