/**
 * @jest-environment node
 *
 * Handler `navigate` du service worker (source : scripts/sw.template.js).
 *
 * Incident 2026-07-25 : le Cockpit repartait à chaque lancement sur l'état du
 * 21/07. Le document HTML d'une page Next.js embarque son payload RSC, donc les
 * DONNÉES du rendu serveur → servir un vieux document = afficher de vieux
 * chiffres, et l'App Router ne refetche jamais le RSC initial. La revalidation
 * d'arrière-plan (event.waitUntil) n'aboutissant pas sur iOS, l'entrée était en
 * pratique write-once : figée jusqu'au déploiement suivant (bump de VERSION).
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { runInNewContext } from 'vm'

const TEMPLATE_PATH = join(__dirname, '..', '..', 'scripts', 'sw.template.js')
const ORIGIN = 'https://trailcockpit.run'
const DASHBOARD = `${ORIGIN}/dashboard`

type SwRequest = { url: string; method: string; mode: string; cache: string }

class FakeCache {
  readonly store = new Map<string, Response>()

  async match(req: SwRequest): Promise<Response | undefined> {
    const hit = this.store.get(req.url)
    return hit ? hit.clone() : undefined
  }

  async put(req: SwRequest, res: Response): Promise<void> {
    this.store.set(req.url, res)
  }
}

function makeCaches() {
  const named = new Map<string, FakeCache>()
  return {
    named,
    async open(name: string) {
      if (!named.has(name)) named.set(name, new FakeCache())
      return named.get(name)!
    },
    async match(req: SwRequest) {
      for (const cache of Array.from(named.values())) {
        const hit = await cache.match(req)
        if (hit) return hit
      }
      return undefined
    },
    async keys() {
      return Array.from(named.keys())
    },
    async delete(name: string) {
      return named.delete(name)
    },
  }
}

/** Charge le template dans un faux ServiceWorkerGlobalScope et rend ses listeners. */
function loadServiceWorker(caches: ReturnType<typeof makeCaches>, fetchMock: jest.Mock) {
  const source = readFileSync(TEMPLATE_PATH, 'utf8').replace(/__SW_VERSION__/g, 'testsha')
  const listeners: Record<string, (event: unknown) => void> = {}
  const self = {
    addEventListener: (type: string, cb: (event: unknown) => void) => {
      listeners[type] = cb
    },
    location: { origin: ORIGIN },
    skipWaiting: jest.fn(),
    clients: { claim: jest.fn() },
  }
  runInNewContext(source, { self, caches, fetch: fetchMock, URL })
  return listeners
}

function navigateEvent(url = DASHBOARD) {
  const request: SwRequest = { url, method: 'GET', mode: 'navigate', cache: 'default' }
  const waits: Promise<unknown>[] = []
  let responded: Promise<Response> | undefined
  const event = {
    request,
    respondWith(value: Response | Promise<Response>) {
      responded = Promise.resolve(value)
    },
    waitUntil(value: Promise<unknown>) {
      waits.push(Promise.resolve(value).catch(() => undefined))
    },
  }
  return {
    event,
    request,
    response: () => responded,
    settle: () => Promise.all(waits),
  }
}

function htmlResponse(body: string, ageMs: number) {
  return new Response(body, {
    status: 200,
    headers: {
      date: new Date(Date.now() - ageMs).toUTCString(),
      'content-type': 'text/html; charset=utf-8',
    },
  })
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

describe('service worker — handler navigate', () => {
  it('ignore un document caché périmé et sert le réseau', async () => {
    const caches = makeCaches()
    const runtime = await caches.open('trail-runtime-testsha')
    await runtime.put({ url: DASHBOARD } as SwRequest, htmlResponse('cockpit du 21 juillet', 4 * DAY))

    const fetchMock = jest.fn().mockResolvedValue(htmlResponse('cockpit du 25 juillet', 0))
    const listeners = loadServiceWorker(caches, fetchMock)

    const nav = navigateEvent()
    listeners.fetch!(nav.event)
    const res = await nav.response()!

    expect(await res.text()).toBe('cockpit du 25 juillet')
  })

  it('réécrit le cache avec la réponse réseau quand la copie était périmée', async () => {
    const caches = makeCaches()
    const runtime = await caches.open('trail-runtime-testsha')
    await runtime.put({ url: DASHBOARD } as SwRequest, htmlResponse('cockpit du 21 juillet', 4 * DAY))

    const fetchMock = jest.fn().mockResolvedValue(htmlResponse('cockpit du 25 juillet', 0))
    const listeners = loadServiceWorker(caches, fetchMock)

    const nav = navigateEvent()
    listeners.fetch!(nav.event)
    await nav.response()
    await nav.settle()

    const stored = await runtime.match({ url: DASHBOARD } as SwRequest)
    expect(await stored!.text()).toBe('cockpit du 25 juillet')
  })

  it('sert instantanément le document caché quand il est récent, et revalide en fond', async () => {
    const caches = makeCaches()
    const runtime = await caches.open('trail-runtime-testsha')
    await runtime.put({ url: DASHBOARD } as SwRequest, htmlResponse('copie récente', MINUTE))

    const fetchMock = jest.fn().mockResolvedValue(htmlResponse('réseau', 0))
    const listeners = loadServiceWorker(caches, fetchMock)

    const nav = navigateEvent()
    listeners.fetch!(nav.event)
    const res = await nav.response()!

    expect(await res.text()).toBe('copie récente')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sert la copie périmée en dernier recours quand le réseau échoue (hors ligne)', async () => {
    const caches = makeCaches()
    const runtime = await caches.open('trail-runtime-testsha')
    await runtime.put({ url: DASHBOARD } as SwRequest, htmlResponse('copie hors ligne', 4 * DAY))

    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'))
    const listeners = loadServiceWorker(caches, fetchMock)

    const nav = navigateEvent()
    listeners.fetch!(nav.event)
    const res = await nav.response()!

    expect(await res.text()).toBe('copie hors ligne')
  })

  it('ne sert jamais un document caché sans en-tête Date', async () => {
    const caches = makeCaches()
    const runtime = await caches.open('trail-runtime-testsha')
    await runtime.put(
      { url: DASHBOARD } as SwRequest,
      new Response('sans date', { status: 200 }),
    )

    const fetchMock = jest.fn().mockResolvedValue(htmlResponse('réseau', 0))
    const listeners = loadServiceWorker(caches, fetchMock)

    const nav = navigateEvent()
    listeners.fetch!(nav.event)
    const res = await nav.response()!

    expect(await res.text()).toBe('réseau')
  })
})
