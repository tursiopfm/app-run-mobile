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

  // Tout le reste (HTML, RSC payloads, /api, /icons, manifest) : network-first.
  // Le cache n'est utilisé qu'en fallback offline. Critique pour récupérer le
  // nouveau code après un déploiement sans avoir à clear site data.
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
      return res
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})
