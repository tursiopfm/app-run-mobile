import webpush from 'web-push'

export type PushTarget  = { endpoint: string; p256dh: string; auth: string }
export type PushPayload = { title: string; body: string; url: string }
export type SendResult  = 'sent' | 'gone' | 'failed'

let configured = false

function configure(): void {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  )
  configured = true
}

// 404/410 : le service de push ne connaît plus cet endpoint (app désinstallée,
// permission révoquée). L'abonnement est mort, on le supprime. Tout autre code
// est transitoire — on laisse le tick suivant réessayer.
export function isGoneStatus(code: number | undefined): boolean {
  return code === 404 || code === 410
}

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<SendResult> {
  try {
    configure()
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
    )
    return 'sent'
  } catch (err) {
    return isGoneStatus((err as { statusCode?: number }).statusCode) ? 'gone' : 'failed'
  }
}
