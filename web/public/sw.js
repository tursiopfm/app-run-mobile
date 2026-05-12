// Trail Cockpit - Service Worker
const VERSION = 'v2'
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

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
        return res
      }).catch(() => caches.match(req))
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
          return res
        }).catch(() => cached)
        return cached || networkFetch
      })
    )
    return
  }

  event.respondWith(
    fetch(req).then((res) => {
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
      return res
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})
