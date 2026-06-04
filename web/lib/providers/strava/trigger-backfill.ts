import { waitUntil } from '@vercel/functions'

// Déclenche le cron backfill streams en fire-and-forget (ne bloque pas l'appelant).
// Utilisé par le webhook pour upgrader une nouvelle activité en SP-2 sans attendre
// le run planifié. keepalive + waitUntil garantissent le dispatch même si la
// fonction serverless se termine juste après (cf. pattern du cron d'import).
export function triggerStreamsBackfill(): void {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const secret = process.env.CRON_SECRET
  if (!secret) return
  try {
    const req = fetch(`${appUrl}/api/cron/strava-streams-backfill`, {
      headers: { Authorization: `Bearer ${secret}` },
      keepalive: true,
    }).catch(() => {})
    waitUntil(Promise.race([req, new Promise((r) => setTimeout(r, 50))]))
  } catch {
    /* best-effort : ne jamais propager */
  }
}
