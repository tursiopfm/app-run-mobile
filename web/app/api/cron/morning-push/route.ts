import { NextResponse } from 'next/server'
import { isMorningWindow, dateInTimeZone, buildMorningNotification } from '@/lib/push/morning-message'
import {
  fetchPendingSubscriptions, markNotified, deleteSubscriptionById,
} from '@/lib/push/subscriptions'
import { getMorningPushData, type MorningPushData } from '@/lib/push/morning-data'
import { sendPush } from '@/lib/push/send'

export const runtime = 'nodejs'
export const maxDuration = 60

// Une année d'activités + EWMA par utilisateur : le lot est borné pour tenir
// dans maxDuration. Le reste part au tick suivant (10 min plus tard).
const BATCH_SIZE = 25

// Notification du rapport matinal. Déclenché en externe (Bearer) sur une plage
// de ticks ; la garde horaire choisit ceux qui tombent dans la matinée de
// Paris, quelle que soit la saison.
//
// `?force=1` court-circuite la garde horaire. Réservé au déclenchement manuel :
// la garde protège d'un envoi « matinal » égaré en pleine journée, or un appel
// manuel EST une intention explicite. Sans ce paramètre, tester la chaîne
// complète imposait d'attendre le lendemain matin. L'appel reste protégé par
// le Bearer, et l'idempotence continue de s'appliquer : forcer deux fois le
// même jour n'envoie rien la seconde fois.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = new URL(request.url).searchParams.get('force') === '1'
  const now = new Date()
  if (!force && !isMorningWindow(now)) {
    return NextResponse.json({ skipped: true, reason: 'outside-window' })
  }

  const today = dateInTimeZone(now)
  const subs  = await fetchPendingSubscriptions(today, BATCH_SIZE)

  // Un utilisateur peut avoir plusieurs appareils : on ne recalcule pas sa
  // charge pour chacun, c'est le poste coûteux.
  const dataByUser = new Map<string, MorningPushData>()
  let sent = 0, removed = 0, failed = 0

  for (const sub of subs) {
    try {
      let data = dataByUser.get(sub.user_id)
      if (!data) {
        data = await getMorningPushData(sub.user_id, today, now)
        dataByUser.set(sub.user_id, data)
      }
      const result = await sendPush(sub, buildMorningNotification(data.status, data.session))
      if (result === 'sent') {
        await markNotified(sub.id, today)
        sent++
      } else if (result === 'gone') {
        await deleteSubscriptionById(sub.id)
        removed++
      } else {
        failed++
      }
    } catch (err) {
      console.error('[cron morning-push]', sub.id, err)
      failed++
    }
  }

  return NextResponse.json({ sent, removed, failed, batch: subs.length })
}
